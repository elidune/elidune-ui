import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  Clock,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Pencil,
  CalendarOff,
  X,
  Check,
  Phone,
} from 'lucide-react';
import { Card, Button, Input, Modal } from '@/components/common';
import api from '@/services/api';
import type {
  LibraryInfo,
  SchedulePeriod,
  ScheduleSlot,
  ScheduleClosure,
  CreateSchedulePeriod,
  UpdateSchedulePeriod,
  CreateScheduleSlot,
  CreateScheduleClosure,
} from '@/types';

const DAYS_OF_WEEK = [0, 1, 2, 3, 4, 5, 6] as const;

// ─── General Tab ─────────────────────────────────────────────────────────────

function GeneralTab() {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [form, setForm] = useState<{
    name: string;
    addr_line1: string;
    addr_line2: string;
    addr_postcode: string;
    addr_city: string;
    addr_country: string;
    email: string;
    phones: string[];
  }>({
    name: '',
    addr_line1: '',
    addr_line2: '',
    addr_postcode: '',
    addr_city: '',
    addr_country: '',
    email: '',
    phones: [],
  });

  const populate = useCallback((info: LibraryInfo) => {
    setForm({
      name: info.name ?? '',
      addr_line1: info.addr_line1 ?? '',
      addr_line2: info.addr_line2 ?? '',
      addr_postcode: info.addr_postcode ?? '',
      addr_city: info.addr_city ?? '',
      addr_country: info.addr_country ?? '',
      email: info.email ?? '',
      phones: info.phones ?? [],
    });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const info = await api.getLibraryInfo();
        populate(info);
      } catch {
        setLoadError(t('errors.generic'));
      } finally {
        setLoading(false);
      }
    })();
  }, [populate, t]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const updated = await api.updateLibraryInfo({
        name: form.name || null,
        addr_line1: form.addr_line1 || null,
        addr_line2: form.addr_line2 || null,
        addr_postcode: form.addr_postcode || null,
        addr_city: form.addr_city || null,
        addr_country: form.addr_country || null,
        email: form.email || null,
        phones: form.phones.filter(Boolean),
      });
      populate(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setSaveError(t('errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  const setPhone = (index: number, value: string) => {
    setForm((f) => {
      const phones = [...f.phones];
      phones[index] = value;
      return { ...f, phones };
    });
  };

  const addPhone = () => setForm((f) => ({ ...f, phones: [...f.phones, ''] }));

  const removePhone = (index: number) =>
    setForm((f) => ({ ...f, phones: f.phones.filter((_, i) => i !== index) }));

  const field = (
    labelKey: string,
    fieldName: keyof typeof form,
    opts?: { type?: string; placeholder?: string; half?: boolean }
  ) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {t(labelKey)}
      </label>
      <Input
        type={opts?.type ?? 'text'}
        value={form[fieldName] as string}
        onChange={(e) => setForm((f) => ({ ...f, [fieldName]: e.target.value }))}
        placeholder={opts?.placeholder}
      />
    </div>
  );

  if (loading) {
    return (
      <Card padding="none">
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card padding="none">
        <div className="p-6 text-center text-red-600 dark:text-red-400 text-sm">{loadError}</div>
      </Card>
    );
  }

  return (
    <Card padding="none">
      <div className="p-6 space-y-5 max-w-lg">
        {/* Feedback */}
        {saveSuccess && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm">
            <Check className="h-4 w-4 flex-shrink-0" />
            {t('library.general.saveSuccess')}
          </div>
        )}
        {saveError && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
            {saveError}
          </div>
        )}

        {/* Name */}
        {field('library.general.name', 'name', { placeholder: t('library.general.namePlaceholder') })}

        {/* Address */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {t('library.general.address')}
          </p>
          {field('library.general.addrLine1', 'addr_line1', { placeholder: t('library.general.addrLine1Placeholder') })}
          {field('library.general.addrLine2', 'addr_line2', { placeholder: t('library.general.addrLine2Placeholder') })}
          <div className="grid grid-cols-2 gap-3">
            {field('library.general.zipCode', 'addr_postcode', { placeholder: '75001' })}
            {field('library.general.city', 'addr_city', { placeholder: 'Paris' })}
          </div>
          {field('library.general.country', 'addr_country', { placeholder: 'France' })}
        </div>

        {/* Email */}
        {field('library.general.email', 'email', { type: 'email', placeholder: 'contact@bibliotheque.fr' })}

        {/* Phones */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('library.general.phones')}
            </label>
            <button
              onClick={addPhone}
              className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              <Plus className="h-3 w-3" />
              {t('library.general.addPhone')}
            </button>
          </div>
          {form.phones.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-600 italic">
              {t('library.general.noPhones')}
            </p>
          )}
          <div className="space-y-2">
            {form.phones.map((phone, i) => (
              <div key={i} className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(i, e.target.value)}
                  placeholder="+33 1 23 45 67 89"
                  className="flex-1"
                />
                <button
                  onClick={() => removePhone(i)}
                  className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <Button onClick={handleSave} isLoading={saving} disabled={saving} className="w-full">
          {t('common.save')}
        </Button>
      </div>
    </Card>
  );
}

// ─── Hours Tab ────────────────────────────────────────────────────────────────

function HoursTab() {
  const { t } = useTranslation();

  const dayNames = DAYS_OF_WEEK.map((d) => t(`library.hours.days.${d}`));

  // Data
  const [periods, setPeriods] = useState<SchedulePeriod[]>([]);
  const [slots, setSlots] = useState<Record<string, ScheduleSlot[]>>({});
  const [closures, setClosures] = useState<ScheduleClosure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(new Set());

  // Period modal
  const [periodModal, setPeriodModal] = useState<{ open: boolean; editing?: SchedulePeriod }>({
    open: false,
  });
  const [periodForm, setPeriodForm] = useState<CreateSchedulePeriod & { notes: string }>({
    name: '',
    start_date: '',
    end_date: '',
    notes: '',
  });
  const [savingPeriod, setSavingPeriod] = useState(false);
  const [periodError, setPeriodError] = useState<string | null>(null);

  // Slot modal
  const [slotModal, setSlotModal] = useState<{ open: boolean; periodId?: string }>({
    open: false,
  });
  const [slotForm, setSlotForm] = useState<CreateScheduleSlot>({
    day_of_week: 0,
    open_time: '09:00',
    close_time: '17:00',
  });
  const [savingSlot, setSavingSlot] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);

  // Closure modal
  const [closureModal, setClosureModal] = useState(false);
  const [closureForm, setClosureForm] = useState<CreateScheduleClosure>({
    closure_date: '',
    reason: '',
  });
  const [savingClosure, setSavingClosure] = useState(false);
  const [closureError, setClosureError] = useState<string | null>(null);

  // Delete in-progress tracking
  const [deletingPeriod, setDeletingPeriod] = useState<string | null>(null);
  const [deletingSlot, setDeletingSlot] = useState<string | null>(null);
  const [deletingClosure, setDeletingClosure] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [perList, closList] = await Promise.all([
        api.getSchedulePeriods(),
        api.getScheduleClosures(),
      ]);
      setPeriods(perList);
      setClosures(closList.sort((a, b) => a.closure_date.localeCompare(b.closure_date)));

      const slotMap: Record<string, ScheduleSlot[]> = {};
      await Promise.all(
        perList.map(async (p) => {
          slotMap[p.id] = await api.getScheduleSlots(p.id);
        })
      );
      setSlots(slotMap);

      if (perList.length > 0) {
        setExpandedPeriods(new Set(perList.map((p) => p.id)));
      }
    } catch {
      setError(t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Period handlers ──────────────────────────────────────────────────────

  const openAddPeriod = () => {
    setPeriodForm({ name: '', start_date: '', end_date: '', notes: '' });
    setPeriodError(null);
    setPeriodModal({ open: true });
  };

  const openEditPeriod = (period: SchedulePeriod) => {
    setPeriodForm({
      name: period.name,
      start_date: period.start_date,
      end_date: period.end_date,
      notes: period.notes ?? '',
    });
    setPeriodError(null);
    setPeriodModal({ open: true, editing: period });
  };

  const savePeriod = async () => {
    if (!periodForm.name || !periodForm.start_date || !periodForm.end_date) return;
    setSavingPeriod(true);
    setPeriodError(null);
    try {
      const payload: UpdateSchedulePeriod = {
        name: periodForm.name,
        start_date: periodForm.start_date,
        end_date: periodForm.end_date,
        notes: periodForm.notes || null,
      };
      if (periodModal.editing) {
        const updated = await api.updateSchedulePeriod(periodModal.editing.id, payload);
        setPeriods((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      } else {
        const created = await api.createSchedulePeriod({
          name: periodForm.name,
          start_date: periodForm.start_date,
          end_date: periodForm.end_date,
          notes: periodForm.notes || null,
        });
        setPeriods((prev) => [...prev, created]);
        setSlots((prev) => ({ ...prev, [created.id]: [] }));
        setExpandedPeriods((prev) => new Set([...prev, created.id]));
      }
      setPeriodModal({ open: false });
    } catch {
      setPeriodError(t('errors.generic'));
    } finally {
      setSavingPeriod(false);
    }
  };

  const deletePeriod = async (id: string) => {
    setDeletingPeriod(id);
    try {
      await api.deleteSchedulePeriod(id);
      setPeriods((prev) => prev.filter((p) => p.id !== id));
      setSlots((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch {
      // silently ignore
    } finally {
      setDeletingPeriod(null);
    }
  };

  // ── Slot handlers ────────────────────────────────────────────────────────

  const openAddSlot = (periodId: string, dayOfWeek: number) => {
    setSlotForm({ day_of_week: dayOfWeek, open_time: '09:00', close_time: '17:00' });
    setSlotError(null);
    setSlotModal({ open: true, periodId });
  };

  const saveSlot = async () => {
    if (!slotModal.periodId) return;
    setSavingSlot(true);
    setSlotError(null);
    try {
      const created = await api.createScheduleSlot(slotModal.periodId, slotForm);
      setSlots((prev) => ({
        ...prev,
        [slotModal.periodId!]: [...(prev[slotModal.periodId!] ?? []), created],
      }));
      setSlotModal({ open: false });
    } catch {
      setSlotError(t('errors.generic'));
    } finally {
      setSavingSlot(false);
    }
  };

  const deleteSlot = async (slotId: string, periodId: string) => {
    setDeletingSlot(slotId);
    try {
      await api.deleteScheduleSlot(slotId);
      setSlots((prev) => ({
        ...prev,
        [periodId]: (prev[periodId] ?? []).filter((s) => s.id !== slotId),
      }));
    } catch {
      // silently ignore
    } finally {
      setDeletingSlot(null);
    }
  };

  // ── Closure handlers ─────────────────────────────────────────────────────

  const openAddClosure = () => {
    setClosureForm({ closure_date: '', reason: '' });
    setClosureError(null);
    setClosureModal(true);
  };

  const saveClosure = async () => {
    if (!closureForm.closure_date) return;
    setSavingClosure(true);
    setClosureError(null);
    try {
      const created = await api.createScheduleClosure({
        closure_date: closureForm.closure_date,
        reason: (closureForm.reason as string) || null,
      });
      setClosures((prev) =>
        [...prev, created].sort((a, b) => a.closure_date.localeCompare(b.closure_date))
      );
      setClosureModal(false);
    } catch {
      setClosureError(t('errors.generic'));
    } finally {
      setSavingClosure(false);
    }
  };

  const deleteClosure = async (id: string) => {
    setDeletingClosure(id);
    try {
      await api.deleteScheduleClosure(id);
      setClosures((prev) => prev.filter((c) => c.id !== id));
    } catch {
      // silently ignore
    } finally {
      setDeletingClosure(null);
    }
  };

  const togglePeriod = (id: string) => {
    setExpandedPeriods((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-8 text-red-600 dark:text-red-400">{error}</div>;
  }

  return (
    <div className="space-y-8">
      {/* ── Periods ──────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t('library.hours.periods')}
          </h2>
          <Button size="sm" onClick={openAddPeriod}>
            <Plus className="h-4 w-4" />
            {t('library.hours.addPeriod')}
          </Button>
        </div>

        {periods.length === 0 ? (
          <Card padding="none">
            <div className="py-10 text-center text-gray-400 dark:text-gray-600">
              <Clock className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">{t('library.hours.noPeriods')}</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {periods.map((period) => {
              const isExpanded = expandedPeriods.has(period.id);
              const periodSlots = slots[period.id] ?? [];

              return (
                <Card key={period.id} padding="none">
                  {/* Period header */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
                    onClick={() => togglePeriod(period.id)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white text-sm">
                        {period.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {period.start_date} → {period.end_date}
                        {period.notes ? ` · ${period.notes}` : ''}
                      </p>
                    </div>
                    <div
                      className="flex gap-1 flex-shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => openEditPeriod(period)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                        title={t('common.edit')}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deletePeriod(period.id)}
                        disabled={deletingPeriod === period.id}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50"
                        title={t('common.delete')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded weekly grid */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-4">
                      <div className="space-y-2">
                        {DAYS_OF_WEEK.map((day) => {
                          const daySlots = periodSlots
                            .filter((s) => s.day_of_week === day)
                            .sort((a, b) => a.open_time.localeCompare(b.open_time));

                          return (
                            <div key={day} className="flex items-center gap-3 min-h-[2.25rem]">
                              <span className="w-24 text-xs font-medium text-gray-500 dark:text-gray-400 flex-shrink-0">
                                {dayNames[day]}
                              </span>
                              <div className="flex flex-wrap gap-2 flex-1 items-center">
                                {daySlots.length === 0 && (
                                  <span className="text-xs text-gray-300 dark:text-gray-700 italic">
                                    {t('library.hours.closed')}
                                  </span>
                                )}
                                {daySlots.map((slot) => (
                                  <span
                                    key={slot.id}
                                    className="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-full px-2.5 py-1 text-xs"
                                  >
                                    {slot.open_time} – {slot.close_time}
                                    <button
                                      onClick={() => deleteSlot(slot.id, period.id)}
                                      disabled={deletingSlot === slot.id}
                                      className="ml-0.5 rounded-full p-0.5 hover:bg-indigo-200 dark:hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </span>
                                ))}
                                <button
                                  onClick={() => openAddSlot(period.id, day)}
                                  className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full px-2 py-1 transition-colors"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Closures ─────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t('library.hours.closures')}
          </h2>
          <Button size="sm" variant="secondary" onClick={openAddClosure}>
            <Plus className="h-4 w-4" />
            {t('library.hours.addClosure')}
          </Button>
        </div>

        <Card padding="none">
          {closures.length === 0 ? (
            <div className="py-10 text-center text-gray-400 dark:text-gray-600">
              <CalendarOff className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">{t('library.hours.noClosures')}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {closures.map((closure) => (
                <div key={closure.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {closure.closure_date}
                    </p>
                    {closure.reason && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {closure.reason}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => deleteClosure(closure.id)}
                    disabled={deletingClosure === closure.id}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      {/* ── Period Modal ─────────────────────────────────────────────────── */}
      <Modal
        isOpen={periodModal.open}
        onClose={() => setPeriodModal({ open: false })}
        title={periodModal.editing ? t('library.hours.editPeriod') : t('library.hours.addPeriod')}
      >
        <div className="space-y-4">
          {periodError && (
            <p className="text-sm text-red-600 dark:text-red-400">{periodError}</p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('library.hours.periodName')} *
            </label>
            <Input
              value={periodForm.name}
              onChange={(e) => setPeriodForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t('library.hours.periodName')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('library.hours.startDate')} *
              </label>
              <Input
                type="date"
                value={periodForm.start_date}
                onChange={(e) => setPeriodForm((f) => ({ ...f, start_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('library.hours.endDate')} *
              </label>
              <Input
                type="date"
                value={periodForm.end_date}
                onChange={(e) => setPeriodForm((f) => ({ ...f, end_date: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('library.hours.notes')}
            </label>
            <Input
              value={periodForm.notes}
              onChange={(e) => setPeriodForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder={t('library.hours.notes')}
            />
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <Button variant="secondary" onClick={() => setPeriodModal({ open: false })}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={savePeriod}
              isLoading={savingPeriod}
              disabled={savingPeriod || !periodForm.name || !periodForm.start_date || !periodForm.end_date}
            >
              {t('common.save')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Slot Modal ───────────────────────────────────────────────────── */}
      <Modal
        isOpen={slotModal.open}
        onClose={() => setSlotModal({ open: false })}
        title={t('library.hours.addSlot')}
      >
        <div className="space-y-4">
          {slotError && <p className="text-sm text-red-600 dark:text-red-400">{slotError}</p>}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('library.hours.day')}
            </label>
            <select
              value={slotForm.day_of_week}
              onChange={(e) =>
                setSlotForm((f) => ({ ...f, day_of_week: Number(e.target.value) }))
              }
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {DAYS_OF_WEEK.map((d) => (
                <option key={d} value={d}>
                  {dayNames[d]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('library.hours.openTime')}
              </label>
              <Input
                type="time"
                value={slotForm.open_time}
                onChange={(e) => setSlotForm((f) => ({ ...f, open_time: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('library.hours.closeTime')}
              </label>
              <Input
                type="time"
                value={slotForm.close_time}
                onChange={(e) => setSlotForm((f) => ({ ...f, close_time: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <Button variant="secondary" onClick={() => setSlotModal({ open: false })}>
              {t('common.cancel')}
            </Button>
            <Button onClick={saveSlot} isLoading={savingSlot} disabled={savingSlot}>
              {t('common.add')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Closure Modal ────────────────────────────────────────────────── */}
      <Modal
        isOpen={closureModal}
        onClose={() => setClosureModal(false)}
        title={t('library.hours.addClosure')}
      >
        <div className="space-y-4">
          {closureError && (
            <p className="text-sm text-red-600 dark:text-red-400">{closureError}</p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('library.hours.closureDate')} *
            </label>
            <Input
              type="date"
              value={closureForm.closure_date}
              onChange={(e) =>
                setClosureForm((f) => ({ ...f, closure_date: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('library.hours.closureReason')}
            </label>
            <Input
              value={closureForm.reason ?? ''}
              onChange={(e) => setClosureForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder={t('library.hours.closureReasonPlaceholder')}
            />
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <Button variant="secondary" onClick={() => setClosureModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={saveClosure}
              isLoading={savingClosure}
              disabled={savingClosure || !closureForm.closure_date}
            >
              {t('common.add')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LibraryPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'general' | 'hours'>('general');

  const tabs = [
    { id: 'general' as const, label: t('library.tabs.general'), icon: Building2 },
    { id: 'hours' as const, label: t('library.tabs.hours'), icon: Clock },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('library.title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('library.subtitle')}</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg mb-6 w-fit">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === id
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'general' && <GeneralTab />}
      {activeTab === 'hours' && <HoursTab />}
    </div>
  );
}
