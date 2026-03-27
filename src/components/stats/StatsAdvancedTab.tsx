import { useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Play,
  Pencil,
  Trash2,
  Plus,
  Database,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import api from '@/services/api';
import type {
  StatsSchema,
  StatsSchemaEntity,
  StatsBuilderBody,
  StatsTableResponse,
  SavedStatsQuery,
  StatsFilterOperator,
  StatsSelectField,
  StatsAggregation,
  StatsGroupByField,
  StatsOrderBy,
  StatsTimeGranularity,
  StatsFilterClause,
} from '@/types';
import { isAdmin } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { getApiErrorMessage } from '@/utils/apiError';
import { Card, Button, Table, Modal, Input, Badge, MessageModal, ConfirmDialog, ScrollableListRegion } from '@/components/common';

/** Stats builder: keep each added row on one line; scroll horizontally if needed. */
const STATS_EDITOR_ROW =
  'flex flex-nowrap gap-2 items-center overflow-x-auto min-w-0 pb-0.5';

/** Native `<select>` styled like `Input` (same height, border, text, focus). */
const STATS_ROW_SELECT =
  'rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 py-2.5 pl-4 pr-4 text-sm text-gray-900 dark:text-gray-100 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:focus:ring-amber-500/40 focus:outline-none';

/** Extra classes for `<Input>` in stats rows (`Input` already uses py-2.5 / borders). */
const STATS_ROW_INPUT = 'text-sm';

/** Shell (border + light gray fill) for stats editor sections. */
const STATS_EDITOR_BLOCK_SHELL =
  'rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-3';

/** Default section: shell + vertical spacing between children. */
const STATS_EDITOR_BLOCK = `${STATS_EDITOR_BLOCK_SHELL} space-y-2`;

function relationTarget(rel: { join: [string, string] }): string {
  return rel.join[1].split('.')[0] ?? '';
}

/** All valid join path strings from root (DFS). */
function collectJoinPaths(root: string, entities: StatsSchema['entities']): string[] {
  const out: string[] = [];
  function dfs(entityKey: string, pathPrefix: string[]) {
    const ent = entities[entityKey];
    if (!ent?.relations) return;
    for (const relName of Object.keys(ent.relations)) {
      const rel = ent.relations[relName];
      const target = relationTarget(rel);
      const next = [...pathPrefix, relName];
      out.push(next.join('.'));
      dfs(target, next);
    }
  }
  dfs(root, []);
  return out;
}

function entitiesInScope(root: string, joins: string[], entities: StatsSchema['entities']): Set<string> {
  const set = new Set<string>([root]);
  for (const path of joins) {
    let current = root;
    for (const seg of path.split('.')) {
      const rel = entities[current]?.relations?.[seg];
      if (!rel) break;
      const target = relationTarget(rel);
      set.add(target);
      current = target;
    }
  }
  return set;
}

interface FieldOpt {
  value: string;
  label: string;
  computed: boolean;
}

function fieldOptionsWithMeta(
  scope: Set<string>,
  entities: StatsSchema['entities'],
  t: (key: string) => string
): FieldOpt[] {
  const opts: FieldOpt[] = [];
  for (const ent of scope) {
    const f = entities[ent]?.fields;
    if (!f) continue;
    for (const [key, meta] of Object.entries(f)) {
      const value = `${ent}.${key}`;
      const computed = meta.computed === true;
      const suffix = computed ? ` — ${t('stats.advanced.computedField')}` : '';
      opts.push({ value, label: `${meta.label} (${value})${suffix}`, computed });
    }
  }
  opts.sort((a, b) => a.value.localeCompare(b.value));
  return opts;
}

function firstPhysicalDateField(physical: FieldOpt[], schema: StatsSchema): FieldOpt | undefined {
  if (physical.length === 0) return undefined;
  for (const o of physical) {
    const [ent, key] = o.value.split('.');
    const dt = schema.entities[ent]?.fields[key]?.type ?? '';
    if (isTimestampDataType(dt)) return o;
  }
  return (
    physical.find((o) => o.value.toLowerCase().includes('date')) ?? physical[0]
  );
}

function defaultAliasFromField(field: string): string {
  return field.replace(/\./g, '_');
}

function emptyBody(entity: string): StatsBuilderBody {
  return {
    entity,
    joins: [],
    select: [],
    filters: [],
    filterGroups: [],
    unionWith: [],
    aggregations: [],
    groupBy: [],
    having: [],
    timeBucket: undefined,
    orderBy: [],
    limit: 100,
    offset: 0,
  };
}

function outputAliases(body: StatsBuilderBody): string[] {
  const names: string[] = [];
  for (const s of body.select) {
    const a = (s.alias?.trim() || defaultAliasFromField(s.field)) || 'col';
    names.push(a);
  }
  for (const a of body.aggregations) {
    names.push(a.alias);
  }
  if (body.timeBucket?.field) {
    names.push(
      body.timeBucket.alias?.trim() || defaultAliasFromField(body.timeBucket.field)
    );
  }
  return names;
}

function parseFilterValue(raw: string, op: StatsFilterOperator): unknown {
  if (op === 'isNull' || op === 'isNotNull') return null;
  const t = raw.trim();
  if (t === '') return '';
  if (t.startsWith('[') || t.startsWith('{')) {
    try {
      return JSON.parse(t) as unknown;
    } catch {
      return raw;
    }
  }
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t)) return Number(t);
  return t;
}

function isTimestampDataType(dataType: string): boolean {
  const d = dataType.toLowerCase();
  return d.includes('timestamp') || d === 'datetime';
}

/** Parse API cell values (ISO strings, epoch ms, YYYY-MM-DD). */
function parseToDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const day = Number(m[3]);
    const d = new Date(y, mo, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatStatsResultCell(value: unknown, dataType: string, locale: string): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return JSON.stringify(value);
  }
  if (isTimestampDataType(dataType)) {
    const d = parseToDate(value);
    if (d) {
      return d.toLocaleDateString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default function StatsAdvancedTab() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const admin = isAdmin(user?.accountType);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [saveShared, setSaveShared] = useState(false);
  const [body, setBody] = useState<StatsBuilderBody | null>(null);

  const [resultOpen, setResultOpen] = useState(false);
  const [result, setResult] = useState<StatsTableResponse | null>(null);
  const [resultTitle, setResultTitle] = useState('');
  const [lastExecutedQuery, setLastExecutedQuery] = useState<StatsBuilderBody | null>(null);
  const [messageDialog, setMessageDialog] = useState<string | null>(null);
  const [savedQueryToDelete, setSavedQueryToDelete] = useState<SavedStatsQuery | null>(null);

  const { data: schema, isLoading: schemaLoading, error: schemaError } = useQuery({
    queryKey: ['stats', 'schema'],
    queryFn: () => api.getStatsSchema(),
  });

  const { data: savedList = [], isLoading: listLoading } = useQuery({
    queryKey: ['stats', 'saved'],
    queryFn: () => api.getSavedStatsQueries(),
  });

  const firstEntity = useMemo(() => {
    if (!schema?.entities) return '';
    const keys = Object.keys(schema.entities).sort();
    return keys[0] ?? '';
  }, [schema]);

  const joinPathOptions = useMemo(() => {
    if (!schema || !body) return [];
    return collectJoinPaths(body.entity, schema.entities);
  }, [schema, body]);

  const fieldOpts = useMemo(() => {
    if (!schema || !body) return [];
    const scope = entitiesInScope(body.entity, body.joins, schema.entities);
    return fieldOptionsWithMeta(scope, schema.entities, t);
  }, [schema, body, t]);

  const fieldOptsPhysical = useMemo(() => fieldOpts.filter((o) => !o.computed), [fieldOpts]);

  const openNew = () => {
    if (!firstEntity) return;
    setEditingId(null);
    setSaveName('');
    setSaveDescription('');
    setSaveShared(false);
    setBody(emptyBody(firstEntity));
    setEditorOpen(true);
  };

  const openEdit = (row: SavedStatsQuery) => {
    setEditingId(row.id);
    setSaveName(row.name);
    setSaveDescription(row.description ?? '');
    setSaveShared(row.isShared);
    const q = JSON.parse(JSON.stringify(row.query)) as StatsBuilderBody;
    if (!q.filterGroups) q.filterGroups = [];
    if (!q.unionWith) q.unionWith = [];
    setBody(q);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setBody(null);
    setEditingId(null);
  };

  const canManage = (row: SavedStatsQuery) =>
    admin || String(user?.id) === String(row.userId);

  const runMutation = useMutation({
    mutationFn: async (payload: {
      id?: number;
      query?: StatsBuilderBody;
      queryForPaging?: StatsBuilderBody;
    }) => {
      if (payload.id != null) return api.runSavedStatsQuery(payload.id);
      if (payload.query) return api.postStatsQuery(payload.query);
      throw new Error('no query');
    },
    onSuccess: (data, vars) => {
      setResult(data);
      setResultTitle(vars.id != null ? t('stats.advanced.resultSaved') : t('stats.advanced.resultPreview'));
      if (vars.query) setLastExecutedQuery(vars.query);
      else if (vars.queryForPaging) setLastExecutedQuery(vars.queryForPaging);
      setResultOpen(true);
    },
    onError: (e) => {
      setMessageDialog(getApiErrorMessage(e, t));
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!body || !saveName.trim()) throw new Error('name');
      const write = {
        name: saveName.trim(),
        description: saveDescription.trim() || undefined,
        query: body,
        isShared: saveShared,
      };
      if (editingId != null) return api.updateSavedStatsQuery(editingId, write);
      return api.createSavedStatsQuery(write);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stats', 'saved'] });
      closeEditor();
    },
    onError: (e) => {
      setMessageDialog(getApiErrorMessage(e, t));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteSavedStatsQuery(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stats', 'saved'] });
    },
    onError: (e) => {
      setMessageDialog(getApiErrorMessage(e, t));
    },
  });

  const updateBody = useCallback((patch: Partial<StatsBuilderBody>) => {
    setBody((b) => (b ? { ...b, ...patch } : b));
  }, []);

  const setEntity = (entity: string) => {
    setBody(emptyBody(entity));
  };

  const toggleJoin = (path: string) => {
    if (!body) return;
    const has = body.joins.includes(path);
    const joins = has ? body.joins.filter((j) => j !== path) : [...body.joins, path].sort();
    setBody({ ...body, joins });
  };

  const addSelect = () => {
    if (!body || fieldOpts.length === 0) return;
    const first = fieldOpts[0].value;
    const next: StatsSelectField = {
      field: first,
      alias: defaultAliasFromField(first),
    };
    updateBody({ select: [...body.select, next] });
  };

  const patchSelect = (index: number, patch: Partial<StatsSelectField>) => {
    if (!body) return;
    const select = body.select.map((s, i) => (i === index ? { ...s, ...patch } : s));
    updateBody({ select });
  };

  const removeSelect = (index: number) => {
    if (!body) return;
    updateBody({ select: body.select.filter((_, i) => i !== index) });
  };

  const addAgg = () => {
    if (!body || fieldOptsPhysical.length === 0 || !schema) return;
    const fn = schema.aggregationFunctions[0] as StatsAggregation['fn'];
    const first = fieldOptsPhysical[0].value;
    const agg: StatsAggregation = {
      fn,
      field: first,
      alias: `${fn}_${defaultAliasFromField(first)}`,
    };
    updateBody({ aggregations: [...body.aggregations, agg] });
  };

  const patchAgg = (index: number, patch: Partial<StatsAggregation>) => {
    if (!body) return;
    const aggregations = body.aggregations.map((a, i) => (i === index ? { ...a, ...patch } : a));
    updateBody({ aggregations });
  };

  const removeAgg = (index: number) => {
    if (!body) return;
    updateBody({ aggregations: body.aggregations.filter((_, i) => i !== index) });
  };

  const addFilter = () => {
    if (!body || fieldOpts.length === 0 || !schema) return;
    const op = schema.operators[0] as StatsFilterOperator;
    updateBody({
      filters: [
        ...body.filters,
        { field: fieldOpts[0].value, op, value: '' },
      ],
    });
  };

  const patchFilter = (index: number, field: string, op: StatsFilterOperator, valueRaw: string) => {
    if (!body) return;
    const filters = body.filters.map((f, i) =>
      i === index ? { field, op, value: parseFilterValue(valueRaw, op) } : f
    );
    updateBody({ filters });
  };

  const removeFilter = (index: number) => {
    if (!body) return;
    updateBody({ filters: body.filters.filter((_, i) => i !== index) });
  };

  const addFilterGroup = () => {
    if (!body) return;
    updateBody({ filterGroups: [...(body.filterGroups ?? []), []] });
  };

  const removeFilterGroup = (groupIndex: number) => {
    if (!body) return;
    updateBody({
      filterGroups: (body.filterGroups ?? []).filter((_, i) => i !== groupIndex),
    });
  };

  const addFilterInGroup = (groupIndex: number) => {
    if (!body || fieldOpts.length === 0 || !schema) return;
    const op = schema.operators[0] as StatsFilterOperator;
    const groups = (body.filterGroups ?? []).map((g) => [...g]);
    if (!groups[groupIndex]) return;
    const row: StatsFilterClause = { field: fieldOpts[0].value, op, value: '' };
    groups[groupIndex] = [...groups[groupIndex], row];
    updateBody({ filterGroups: groups });
  };

  const patchFilterInGroup = (
    groupIndex: number,
    filterIndex: number,
    field: string,
    op: StatsFilterOperator,
    valueRaw: string
  ) => {
    if (!body) return;
    const groups = (body.filterGroups ?? []).map((g) => g.map((c) => ({ ...c })));
    const g = groups[groupIndex];
    if (!g?.[filterIndex]) return;
    g[filterIndex] = { field, op, value: parseFilterValue(valueRaw, op) };
    updateBody({ filterGroups: groups });
  };

  const removeFilterInGroup = (groupIndex: number, filterIndex: number) => {
    if (!body) return;
    const groups = (body.filterGroups ?? []).map((g, i) =>
      i === groupIndex ? g.filter((_, j) => j !== filterIndex) : [...g]
    );
    updateBody({ filterGroups: groups });
  };

  const addGroupBy = () => {
    if (!body || fieldOpts.length === 0) return;
    const f = fieldOpts[0].value;
    const g: StatsGroupByField = { field: f, alias: defaultAliasFromField(f) };
    updateBody({ groupBy: [...body.groupBy, g] });
  };

  const patchGroupBy = (index: number, patch: Partial<StatsGroupByField>) => {
    if (!body) return;
    const groupBy = body.groupBy.map((g, i) => (i === index ? { ...g, ...patch } : g));
    updateBody({ groupBy });
  };

  const removeGroupBy = (index: number) => {
    if (!body) return;
    updateBody({ groupBy: body.groupBy.filter((_, i) => i !== index) });
  };

  const addOrderBy = () => {
    if (!body) return;
    const aliases = outputAliases(body);
    const field = aliases[0] ?? 'col';
    const o: StatsOrderBy = { field, dir: 'asc' };
    updateBody({ orderBy: [...body.orderBy, o] });
  };

  const patchOrderBy = (index: number, patch: Partial<StatsOrderBy>) => {
    if (!body) return;
    const orderBy = body.orderBy.map((o, i) => (i === index ? { ...o, ...patch } : o));
    updateBody({ orderBy });
  };

  const removeOrderBy = (index: number) => {
    if (!body) return;
    updateBody({ orderBy: body.orderBy.filter((_, i) => i !== index) });
  };

  const handleRunPreview = () => {
    if (!body) return;
    runMutation.mutate({ query: body });
  };

  const handleSave = () => {
    if (!saveName.trim()) {
      setMessageDialog(t('stats.advanced.nameRequired'));
      return;
    }
    saveMutation.mutate();
  };

  const handleDelete = (row: SavedStatsQuery) => {
    if (!canManage(row)) return;
    setSavedQueryToDelete(row);
  };

  const entityKeys = schema ? Object.keys(schema.entities).sort() : [];

  const listColumns = [
    {
      key: 'name',
      header: t('stats.advanced.colName'),
      render: (row: SavedStatsQuery) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{row.name}</p>
          {row.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{row.description}</p>
          )}
        </div>
      ),
    },
    {
      key: 'flags',
      header: t('stats.advanced.colFlags'),
      render: (row: SavedStatsQuery) => (
        <div className="flex flex-wrap gap-1">
          {row.isShared && (
            <Badge variant="info">{t('stats.advanced.shared')}</Badge>
          )}
          {String(user?.id) === String(row.userId) && (
            <Badge variant="default">{t('stats.advanced.yours')}</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'updated',
      header: t('stats.advanced.colUpdated'),
      render: (row: SavedStatsQuery) => (
        <span className="text-gray-600 dark:text-gray-300">
          {new Date(row.updatedAt).toLocaleString(i18n.language)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'right' as const,
      render: (row: SavedStatsQuery) => (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() =>
              runMutation.mutate({ id: row.id, queryForPaging: row.query })
            }
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm bg-indigo-600 text-white hover:bg-indigo-700"
          >
            <Play className="h-3.5 w-3.5" />
            {t('stats.advanced.run')}
          </button>
          {canManage(row) && (
            <>
              <button
                type="button"
                onClick={() => openEdit(row)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <Pencil className="h-3.5 w-3.5" />
                {t('common.edit')}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(row)}
                title={t('common.delete')}
                aria-label={t('stats.advanced.deleteQueryAria', { name: row.name })}
                className="inline-flex items-center justify-center p-1.5 rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  if (schemaLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (schemaError || !schema) {
    return (
      <Card>
        <p className="text-sm text-red-600 dark:text-red-400">
          {getApiErrorMessage(schemaError, t)}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card padding="none" className="flex flex-col min-h-0">
        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <Database className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('stats.advanced.title')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('stats.advanced.subtitle')}</p>
            </div>
          </div>
          <Button onClick={openNew} disabled={!firstEntity}>
            <Plus className="h-4 w-4 mr-1" />
            {t('stats.advanced.addQuery')}
          </Button>
        </div>

        <ScrollableListRegion aria-label={t('stats.advanced.title')}>
          <div className="p-4 sm:p-6">
            <Table
              columns={listColumns}
              data={savedList}
              keyExtractor={(row) => String(row.id)}
              isLoading={listLoading}
              emptyMessage={t('stats.advanced.emptySaved')}
            />
          </div>
        </ScrollableListRegion>
      </Card>

      <Modal
        isOpen={editorOpen}
        onClose={closeEditor}
        title={editingId != null ? t('stats.advanced.editQuery') : t('stats.advanced.newQuery')}
        size="xl"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2 w-full">
            <Button variant="secondary" onClick={closeEditor}>
              {t('common.cancel')}
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={handleRunPreview}
                disabled={!body || runMutation.isPending}
              >
                <Play className="h-4 w-4 mr-1" />
                {t('stats.advanced.preview')}
              </Button>
              <Button onClick={handleSave} disabled={!body || saveMutation.isPending}>
                {t('stats.advanced.save')}
              </Button>
            </div>
          </div>
        }
      >
        {body && schema && (
          <div className="space-y-4 px-1 max-h-[70vh] overflow-y-auto">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                {t('stats.advanced.saveName')}
              </label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <Input value={saveName} onChange={(e) => setSaveName(e.target.value)} />
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={saveShared}
                    aria-label={t('stats.advanced.shareWithStaff')}
                    onClick={() => setSaveShared((v) => !v)}
                    className={`relative h-8 w-14 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800 ${
                      saveShared
                        ? 'bg-amber-500 dark:bg-amber-600'
                        : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`pointer-events-none absolute top-1 left-1 block h-6 w-6 rounded-full bg-white shadow transition-transform ${
                        saveShared ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {t('stats.advanced.shareWithStaff')}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                {t('stats.advanced.saveDescription')}
              </label>
              <Input value={saveDescription} onChange={(e) => setSaveDescription(e.target.value)} />
            </div>

            <section className={STATS_EDITOR_BLOCK}>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                1. {t('stats.advanced.stepEntity')}
              </h3>
              <select
                value={body.entity}
                onChange={(e) => setEntity(e.target.value)}
                className={`w-full ${STATS_ROW_SELECT}`}
              >
                {entityKeys.map((k) => (
                  <option key={k} value={k}>
                    {(schema.entities[k] as StatsSchemaEntity).label} ({k})
                  </option>
                ))}
              </select>
              {(() => {
                const unionBranches = schema.entities[body.entity]?.unionWith ?? [];
                if (unionBranches.length === 0) return null;
                const selected = new Set(body.unionWith ?? []);
                return (
                  <div className="mt-3 space-y-2 rounded-lg border border-amber-200/80 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-2.5">
                    <h4 className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                      {t('stats.advanced.stepUnionWith')}
                    </h4>
                    {schema.unionWithSemantics ? (
                      <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                        {schema.unionWithSemantics}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t('stats.advanced.unionWithHelp')}
                      </p>
                    )}
                    <div className="flex flex-col gap-2">
                      {unionBranches.map((branch) => (
                        <label
                          key={branch}
                          className="inline-flex items-center gap-2 text-sm cursor-pointer text-gray-800 dark:text-gray-200"
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(branch)}
                            onChange={() => {
                              const next = new Set(body.unionWith ?? []);
                              if (next.has(branch)) next.delete(branch);
                              else next.add(branch);
                              updateBody({ unionWith: [...next].sort() });
                            }}
                            className="rounded border-gray-300 dark:border-gray-600 text-indigo-600"
                          />
                          <span className="font-mono text-xs">{branch}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </section>

            <section className={STATS_EDITOR_BLOCK}>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                2. {t('stats.advanced.stepJoins')}
              </h3>
              <div className="flex flex-wrap gap-2">
                {joinPathOptions.map((path) => (
                  <label
                    key={path}
                    className="inline-flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={body.joins.includes(path)}
                      onChange={() => toggleJoin(path)}
                      className="rounded border-gray-300 dark:border-gray-600 text-indigo-600"
                    />
                    <span className="font-mono text-xs">{path}</span>
                  </label>
                ))}
                {joinPathOptions.length === 0 && (
                  <p className="text-xs text-gray-500">{t('stats.advanced.noJoins')}</p>
                )}
              </div>
            </section>

            <section className={STATS_EDITOR_BLOCK}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  3. {t('stats.advanced.stepSelect')}
                </h3>
                <button
                  type="button"
                  onClick={addSelect}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  + {t('stats.advanced.addRow')}
                </button>
              </div>
              {body.select.map((row, i) => (
                <div key={i} className={STATS_EDITOR_ROW}>
                  <select
                    value={row.field}
                    onChange={(e) => {
                      const field = e.target.value;
                      patchSelect(i, {
                        field,
                        alias: row.alias || defaultAliasFromField(field),
                      });
                    }}
                    className={`flex-1 min-w-[200px] ${STATS_ROW_SELECT}`}
                  >
                    {fieldOpts.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    className={`${STATS_ROW_INPUT} w-40`}
                    placeholder={t('stats.advanced.alias')}
                    value={row.alias ?? ''}
                    onChange={(e) => patchSelect(i, { alias: e.target.value })}
                  />
                  <button type="button" onClick={() => removeSelect(i)} className="p-1 text-gray-400 hover:text-red-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </section>

            <section className={STATS_EDITOR_BLOCK}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t('stats.advanced.stepAggregations')}
                </h3>
                <button
                  type="button"
                  onClick={addAgg}
                  disabled={fieldOptsPhysical.length === 0}
                  className="text-xs text-indigo-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + {t('stats.advanced.addRow')}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('stats.advanced.aggregationsPhysicalOnly')}</p>
              {body.aggregations.map((row, i) => (
                <div key={i} className={STATS_EDITOR_ROW}>
                  <select
                    value={row.fn}
                    onChange={(e) => patchAgg(i, { fn: e.target.value as StatsAggregation['fn'] })}
                    className={`shrink-0 ${STATS_ROW_SELECT}`}
                  >
                    {schema.aggregationFunctions.map((fn) => (
                      <option key={fn} value={fn}>
                        {fn}
                      </option>
                    ))}
                  </select>
                  <select
                    value={row.field}
                    onChange={(e) => patchAgg(i, { field: e.target.value })}
                    className={`flex-1 min-w-[180px] ${STATS_ROW_SELECT}`}
                  >
                    {fieldOptsPhysical.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    className={`${STATS_ROW_INPUT} w-36`}
                    placeholder="alias"
                    value={row.alias}
                    onChange={(e) => patchAgg(i, { alias: e.target.value })}
                  />
                  <button type="button" onClick={() => removeAgg(i)} className="p-1 text-gray-400 hover:text-red-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </section>

            <section className={STATS_EDITOR_BLOCK}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t('stats.advanced.stepFilters')}
                </h3>
                <button type="button" onClick={addFilter} className="text-xs text-indigo-600 hover:underline">
                  + {t('stats.advanced.addRow')}
                </button>
              </div>
              {body.filters.map((row, i) => {
                const raw =
                  row.op === 'isNull' || row.op === 'isNotNull'
                    ? ''
                    : typeof row.value === 'string' || typeof row.value === 'number'
                      ? String(row.value)
                      : JSON.stringify(row.value);
                return (
                  <div key={i} className={STATS_EDITOR_ROW}>
                    <select
                      value={row.field}
                      onChange={(e) =>
                        patchFilter(i, e.target.value, row.op, raw)
                      }
                      className={`flex-1 min-w-[160px] ${STATS_ROW_SELECT}`}
                    >
                      {fieldOpts.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={row.op}
                      onChange={(e) => {
                        const op = e.target.value as StatsFilterOperator;
                        patchFilter(i, row.field, op, raw);
                      }}
                      className={`shrink-0 ${STATS_ROW_SELECT}`}
                    >
                      {schema.operators.map((op) => (
                        <option key={op} value={op}>
                          {op}
                        </option>
                      ))}
                    </select>
                    <Input
                      className={`${STATS_ROW_INPUT} flex-1 min-w-[120px]`}
                      disabled={row.op === 'isNull' || row.op === 'isNotNull'}
                      placeholder={t('stats.advanced.filterValueHint')}
                      value={raw}
                      onChange={(e) => patchFilter(i, row.field, row.op, e.target.value)}
                    />
                    <button type="button" onClick={() => removeFilter(i)} className="p-1 text-gray-400 hover:text-red-600">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </section>

            <section className={STATS_EDITOR_BLOCK}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t('stats.advanced.stepFilterGroups')}
                </h3>
                <button type="button" onClick={addFilterGroup} className="text-xs text-indigo-600 hover:underline">
                  + {t('stats.advanced.addOrGroup')}
                </button>
              </div>
              {schema.filterGroupsSemantics ? (
                <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                  {schema.filterGroupsSemantics}
                </p>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('stats.advanced.filterGroupsHelp')}</p>
              )}
              {(body.filterGroups ?? []).map((group, gi) => (
                <div
                  key={gi}
                  className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-3 space-y-2 bg-gray-50/80 dark:bg-gray-900/20"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {t('stats.advanced.orGroupLabel', { n: gi + 1 })}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => addFilterInGroup(gi)}
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        + {t('stats.advanced.addRow')}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFilterGroup(gi)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        {t('stats.advanced.removeOrGroup')}
                      </button>
                    </div>
                  </div>
                  {group.map((row, fi) => {
                    const raw =
                      row.op === 'isNull' || row.op === 'isNotNull'
                        ? ''
                        : typeof row.value === 'string' || typeof row.value === 'number'
                          ? String(row.value)
                          : JSON.stringify(row.value);
                    return (
                      <div key={fi} className={STATS_EDITOR_ROW}>
                        <select
                          value={row.field}
                          onChange={(e) =>
                            patchFilterInGroup(gi, fi, e.target.value, row.op, raw)
                          }
                          className={`flex-1 min-w-[160px] ${STATS_ROW_SELECT}`}
                        >
                          {fieldOpts.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <select
                          value={row.op}
                          onChange={(e) => {
                            const op = e.target.value as StatsFilterOperator;
                            patchFilterInGroup(gi, fi, row.field, op, raw);
                          }}
                          className={`shrink-0 ${STATS_ROW_SELECT}`}
                        >
                          {schema.operators.map((op) => (
                            <option key={op} value={op}>
                              {op}
                            </option>
                          ))}
                        </select>
                        <Input
                          className={`${STATS_ROW_INPUT} flex-1 min-w-[120px]`}
                          disabled={row.op === 'isNull' || row.op === 'isNotNull'}
                          placeholder={t('stats.advanced.filterValueHint')}
                          value={raw}
                          onChange={(e) =>
                            patchFilterInGroup(gi, fi, row.field, row.op, e.target.value)
                          }
                        />
                        <button
                          type="button"
                          onClick={() => removeFilterInGroup(gi, fi)}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                  {group.length === 0 && (
                    <p className="text-xs text-gray-400 italic">{t('stats.advanced.emptyOrGroup')}</p>
                  )}
                </div>
              ))}
            </section>

            <section className={STATS_EDITOR_BLOCK}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t('stats.advanced.stepGroupBy')}
                </h3>
                <button type="button" onClick={addGroupBy} className="text-xs text-indigo-600 hover:underline">
                  + {t('stats.advanced.addRow')}
                </button>
              </div>
              {body.groupBy.map((row, i) => (
                <div key={i} className={STATS_EDITOR_ROW}>
                  <select
                    value={row.field}
                    onChange={(e) => {
                      const field = e.target.value;
                      patchGroupBy(i, {
                        field,
                        alias: row.alias || defaultAliasFromField(field),
                      });
                    }}
                    className={`flex-1 min-w-[200px] ${STATS_ROW_SELECT}`}
                  >
                    {fieldOpts.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    className={`${STATS_ROW_INPUT} w-40`}
                    placeholder={t('stats.advanced.alias')}
                    value={row.alias ?? ''}
                    onChange={(e) => patchGroupBy(i, { alias: e.target.value })}
                  />
                  <button type="button" onClick={() => removeGroupBy(i)} className="p-1 text-gray-400 hover:text-red-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </section>

            <section className={STATS_EDITOR_BLOCK}>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t('stats.advanced.stepTimeBucket')}
              </h3>
              <div className={STATS_EDITOR_ROW}>
                <label className="flex shrink-0 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!body.timeBucket}
                    disabled={fieldOptsPhysical.length === 0}
                    onChange={(e) => {
                      if (e.target.checked && fieldOptsPhysical.length) {
                        const f = firstPhysicalDateField(fieldOptsPhysical, schema);
                        if (!f) return;
                        updateBody({
                          timeBucket: {
                            field: f.value,
                            granularity: schema.timeGranularities[0] as StatsTimeGranularity,
                            alias: `bucket_${defaultAliasFromField(f.value)}`,
                          },
                        });
                      } else {
                        updateBody({ timeBucket: undefined });
                      }
                    }}
                    className="rounded border-gray-300 dark:border-gray-600 text-indigo-600"
                  />
                  {t('stats.advanced.enableTimeBucket')}
                </label>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('stats.advanced.timeBucketPhysicalOnly')}</p>
              {body.timeBucket && (
                <div className={STATS_EDITOR_ROW}>
                  <select
                    value={body.timeBucket.field}
                    onChange={(e) =>
                      updateBody({
                        timeBucket: {
                          ...body.timeBucket!,
                          field: e.target.value,
                        },
                      })
                    }
                    className={`flex-1 min-w-[180px] ${STATS_ROW_SELECT}`}
                  >
                    {fieldOptsPhysical.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={body.timeBucket.granularity}
                    onChange={(e) =>
                      updateBody({
                        timeBucket: {
                          ...body.timeBucket!,
                          granularity: e.target.value as StatsTimeGranularity,
                        },
                      })
                    }
                    className={`shrink-0 ${STATS_ROW_SELECT}`}
                  >
                    {schema.timeGranularities.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                  <Input
                    className={`${STATS_ROW_INPUT} w-40`}
                    placeholder="alias"
                    value={body.timeBucket.alias ?? ''}
                    onChange={(e) =>
                      updateBody({
                        timeBucket: {
                          ...body.timeBucket!,
                          alias: e.target.value,
                        },
                      })
                    }
                  />
                </div>
              )}
            </section>

            <section className={STATS_EDITOR_BLOCK}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t('stats.advanced.stepOrderBy')}
                </h3>
                <button type="button" onClick={addOrderBy} className="text-xs text-indigo-600 hover:underline">
                  + {t('stats.advanced.addRow')}
                </button>
              </div>
              {body.orderBy.map((row, i) => (
                <div key={i} className={STATS_EDITOR_ROW}>
                  <select
                    value={row.field}
                    onChange={(e) => patchOrderBy(i, { field: e.target.value })}
                    className={`flex-1 min-w-[160px] ${STATS_ROW_SELECT}`}
                  >
                    {outputAliases(body).map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                  <select
                    value={row.dir ?? 'asc'}
                    onChange={(e) =>
                      patchOrderBy(i, { dir: e.target.value as 'asc' | 'desc' })
                    }
                    className={`shrink-0 ${STATS_ROW_SELECT}`}
                  >
                    <option value="asc">asc</option>
                    <option value="desc">desc</option>
                  </select>
                  <button type="button" onClick={() => removeOrderBy(i)} className="p-1 text-gray-400 hover:text-red-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <p className="text-xs text-gray-500">{t('stats.advanced.orderByHint')}</p>
            </section>

            <section className={`${STATS_EDITOR_BLOCK_SHELL} flex flex-wrap gap-4 items-end`}>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">limit</label>
                <Input
                  type="number"
                  className="w-28"
                  value={body.limit ?? ''}
                  onChange={(e) =>
                    updateBody({ limit: e.target.value ? Number(e.target.value) : undefined })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">offset</label>
                <Input
                  type="number"
                  className="w-28"
                  value={body.offset ?? ''}
                  onChange={(e) =>
                    updateBody({ offset: e.target.value ? Number(e.target.value) : undefined })
                  }
                />
              </div>
            </section>

            {body.aggregations.length > 0 && body.groupBy.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {t('stats.advanced.warnGroupBy')}
              </p>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={resultOpen}
        onClose={() => setResultOpen(false)}
        title={resultTitle}
        size="xl"
        footer={
          <Button variant="secondary" onClick={() => setResultOpen(false)}>
            {t('common.close')}
          </Button>
        }
      >
        {result && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              {t('stats.advanced.resultMeta', {
                total: result.totalRows,
                showing: result.rows.length,
                offset: result.offset,
                limit: result.limit,
              })}
            </p>
            <div className="overflow-x-auto max-h-[55vh] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800">
                  <tr>
                    {result.columns.map((c) => (
                      <th key={c.name} className="px-2 py-2 text-left font-medium text-xs">
                        {c.label}
                        <span className="block text-[10px] font-normal text-gray-500">{c.dataType}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, ri) => (
                    <tr key={ri} className="border-t border-gray-100 dark:border-gray-800">
                      {result.columns.map((c) => (
                        <td key={c.name} className="px-2 py-1.5 whitespace-nowrap max-w-[240px] truncate">
                          {formatStatsResultCell(row[c.name], c.dataType, i18n.language)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="secondary"
                disabled={
                  !lastExecutedQuery || (lastExecutedQuery.offset ?? 0) <= 0 || runMutation.isPending
                }
                onClick={() => {
                  if (!lastExecutedQuery) return;
                  const lim = lastExecutedQuery.limit ?? 100;
                  const off = Math.max(0, (lastExecutedQuery.offset ?? 0) - lim);
                  const next = { ...lastExecutedQuery, offset: off };
                  setLastExecutedQuery(next);
                  setBody((b) => (b ? { ...b, offset: off } : b));
                  runMutation.mutate({ query: next });
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-gray-500">
                offset {result.offset} / limit {result.limit}
              </span>
              <Button
                variant="secondary"
                disabled={
                  !lastExecutedQuery ||
                  runMutation.isPending ||
                  (result.offset ?? 0) + (result.rows?.length ?? 0) >= (result.totalRows ?? 0)
                }
                onClick={() => {
                  if (!lastExecutedQuery) return;
                  const lim = lastExecutedQuery.limit ?? 100;
                  const off = (lastExecutedQuery.offset ?? 0) + lim;
                  const next = { ...lastExecutedQuery, offset: off };
                  setLastExecutedQuery(next);
                  setBody((b) => (b ? { ...b, offset: off } : b));
                  runMutation.mutate({ query: next });
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <MessageModal
        isOpen={messageDialog !== null}
        onClose={() => setMessageDialog(null)}
        message={messageDialog ?? ''}
        stackOnTop
      />

      <ConfirmDialog
        isOpen={savedQueryToDelete !== null}
        onClose={() => setSavedQueryToDelete(null)}
        onConfirm={() => {
          const row = savedQueryToDelete;
          setSavedQueryToDelete(null);
          if (row) deleteMutation.mutate(row.id);
        }}
        message={
          savedQueryToDelete
            ? t('stats.advanced.deleteConfirm', { name: savedQueryToDelete.name })
            : ''
        }
        confirmVariant="danger"
        stackOnTop
      />
    </div>
  );
}
