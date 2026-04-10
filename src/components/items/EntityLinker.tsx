import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X, Search } from 'lucide-react';
import { Input } from '@/components/common';

export interface LinkedEntry {
  /** ID of an existing entity (undefined = will be created by server via find-or-create) */
  id?: string;
  name: string;
  /** Raw string from input — parsed to int on submit */
  volumeNumber?: string;
}

interface SuggestedItem {
  id: string;
  name: string;
}

interface EntityLinkerProps {
  label: string;
  addLabel: string;
  entries: LinkedEntry[];
  onChange: (entries: LinkedEntry[]) => void;
  /** Return matching items for the query (max ~10). */
  onSearch: (query: string) => Promise<SuggestedItem[]>;
  volumeLabel?: string;
  /** When true, the top label line is omitted (e.g. when wrapped in a collapsible section title). */
  hideLabel?: boolean;
}

export function EntityLinker({
  label,
  addLabel,
  entries,
  onChange,
  onSearch,
  volumeLabel,
  hideLabel = false,
}: EntityLinkerProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestedItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setSuggestions([]);
        setIsOpen(false);
        return;
      }
      setIsSearching(true);
      try {
        const results = await onSearch(q);
        setSuggestions(results);
        setIsOpen(true);
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    },
    [onSearch]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const addEntry = (item: SuggestedItem | null) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const alreadyLinked = entries.some(
      (e) => (item ? e.id === item.id : e.name.toLowerCase() === trimmed.toLowerCase() && !e.id)
    );
    if (alreadyLinked) {
      setQuery('');
      setIsOpen(false);
      return;
    }
    onChange([
      ...entries,
      item ? { id: item.id, name: item.name } : { name: trimmed },
    ]);
    setQuery('');
    setSuggestions([]);
    setIsOpen(false);
  };

  const removeEntry = (index: number) => {
    onChange(entries.filter((_, i) => i !== index));
  };

  const updateVolume = (index: number, vol: string) => {
    const next = [...entries];
    next[index] = { ...next[index], volumeNumber: vol };
    onChange(next);
  };

  const exactMatch = suggestions.find(
    (s) => s.name.toLowerCase() === query.trim().toLowerCase()
  );

  return (
    <div className="space-y-3">
      {!hideLabel ? (
        <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      ) : null}

      {/* Linked entries */}
      {entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((entry, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center gap-2 p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
            >
              <span className="flex-1 min-w-0 text-sm font-medium text-gray-900 dark:text-white truncate">
                {entry.name}
                {!entry.id && (
                  <span className="ml-1 text-xs text-amber-600 dark:text-amber-400">({t('catalog.willCreate')})</span>
                )}
              </span>
              <div className="w-24 shrink-0">
                <Input
                  value={entry.volumeNumber ?? ''}
                  onChange={(e) => updateVolume(i, e.target.value)}
                  placeholder={volumeLabel ?? t('catalog.volumeNumber')}
                  className="text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => removeEntry(i)}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search / add input */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => query.trim() && setIsOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (exactMatch) addEntry(exactMatch);
                  else if (query.trim()) addEntry(null);
                }
                if (e.key === 'Escape') setIsOpen(false);
              }}
              placeholder={addLabel}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            )}
          </div>
          <button
            type="button"
            onClick={() => query.trim() && addEntry(exactMatch ?? null)}
            className="p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
            title={addLabel}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Dropdown */}
        {isOpen && (suggestions.length > 0 || query.trim()) && (
          <div
            ref={dropdownRef}
            className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-56 overflow-y-auto"
          >
            {suggestions.map((item) => (
              <button
                key={item.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); addEntry(item); }}
                className="w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-amber-50 dark:hover:bg-amber-900/20 flex items-center gap-2"
              >
                <Search className="h-3 w-3 text-gray-400 shrink-0" />
                {item.name}
              </button>
            ))}
            {!exactMatch && query.trim() && (
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); addEntry(null); }}
                className="w-full text-left px-3 py-2 text-sm text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 flex items-center gap-2 border-t border-gray-100 dark:border-gray-800"
              >
                <Plus className="h-3 w-3 shrink-0" />
                {t('catalog.useAndCreate', { name: query.trim() })}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
