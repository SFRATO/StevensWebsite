/**
 * LocationPickerIsland — Shared autocomplete for tool pages
 *
 * Slim wrapper around the TownZipFieldIsland search logic.
 * Instead of rendering hidden form fields, calls onSelect with the full ZipData.
 */

import { theme } from '@utils/theme';
import { useState, useRef, useEffect, useCallback, useId } from 'react';
import type { TownZipMapping } from '../../data/town-mappings';
import type { ZipData } from '../../utils/market-analysis';
import { trackSiteSearch } from '@utils/analytics';

interface Props {
  mappings: TownZipMapping[];
  zipcodes: ZipData[];
  onSelect: (zipData: ZipData, townName: string) => void;
  placeholder?: string;
  label?: string;
}

function fuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t.startsWith(q)) return true;
  if (t.includes(q)) return true;
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

function matchScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t === q) return 0;
  if (t.startsWith(q)) return 1;
  if (t.includes(q)) return 2;
  return 3;
}

const styles = {
  wrapper: { position: 'relative' as const },
  label: { display: 'block', fontSize: '0.875rem', fontWeight: 500, color: theme.textPrimary, marginBottom: '0.5rem' },
  input: {
    width: '100%',
    padding: '0.875rem 1rem',
    border: `2px solid ${theme.ruleStrong}`,
    borderRadius: '0.5rem',
    fontSize: '1rem',
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.2s',
  },
  inputFocused: { borderColor: theme.accent },
  dropdown: {
    position: 'absolute' as const,
    top: '100%',
    left: 0,
    right: 0,
    marginTop: '0.25rem',
    background: theme.surface1,
    border: `1px solid ${theme.ruleStrong}`,
    borderRadius: '0.5rem',
    boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
    zIndex: 50,
    maxHeight: '240px',
    overflowY: 'auto' as const,
    listStyle: 'none',
    margin: 0,
    padding: '0.25rem 0',
  },
  item: { padding: '0.75rem 1rem', cursor: 'pointer', transition: 'background 0.1s' },
  itemActive: { backgroundColor: theme.accentWash },
  townName: { fontWeight: 500, color: theme.textPrimary, display: 'block' },
  townMeta: { fontSize: '0.75rem', color: theme.textSecondary },
};

export default function LocationPickerIsland({
  mappings,
  zipcodes,
  onSelect,
  placeholder = 'Start typing a town or zip code...',
  label = 'Your Location',
}: Props) {
  const [query, setQuery] = useState('');
  const [filtered, setFiltered] = useState<TownZipMapping[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [focused, setFocused] = useState(false);
  // Unique id so multiple pickers on one page don't collide (WCAG label association).
  const inputId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) { setFiltered([]); return; }
    const matches = mappings
      .filter((m) => fuzzyMatch(query, m.town) || m.zipcode.startsWith(query))
      .sort((a, b) => matchScore(query, a.town) - matchScore(query, b.town))
      .slice(0, 8);
    setFiltered(matches);
  }, [query, mappings]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const select = useCallback(
    (mapping: TownZipMapping) => {
      const zipData = zipcodes.find((z) => z.zipcode === mapping.zipcode);
      if (!zipData) return;
      setQuery(mapping.displayTown);
      setOpen(false);
      setActiveIdx(-1);
      trackSiteSearch(mapping.town, 'Tool Location Picker');
      onSelect(zipData, mapping.displayTown);
    },
    [zipcodes, onSelect],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || filtered.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, -1)); }
    if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); select(filtered[activeIdx]); }
    if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={containerRef} style={styles.wrapper}>
      <label style={styles.label} htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActiveIdx(-1); }}
        onFocus={() => { setFocused(true); if (query.trim()) setOpen(true); }}
        onBlur={() => setFocused(false)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        style={{ ...styles.input, ...(focused ? styles.inputFocused : {}) }}
      />
      {open && filtered.length > 0 && (
        <ul role="listbox" style={styles.dropdown}>
          {filtered.map((m, i) => (
            <li
              key={`${m.town}-${m.zipcode}`}
              role="option"
              aria-selected={i === activeIdx}
              onClick={() => select(m)}
              onMouseEnter={() => setActiveIdx(i)}
              style={{ ...styles.item, ...(i === activeIdx ? styles.itemActive : {}) }}
            >
              <span style={styles.townName}>{m.displayTown}</span>
              <span style={styles.townMeta}>{m.zipcode} — {m.county}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
