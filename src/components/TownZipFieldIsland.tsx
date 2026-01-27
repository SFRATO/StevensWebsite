/**
 * TownZipFieldIsland - React island for interactive town/zip autocomplete
 *
 * Features:
 * - Fuzzy search autocomplete for town names
 * - Bidirectional sync: town selection → zip auto-fill, zip entry → town auto-fill
 * - Keyboard navigation (arrow keys, enter, escape)
 * - Click-outside-to-close dropdown
 * - Validation for service area zipcodes
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { TownZipMapping } from '../data/town-mappings';

interface Props {
  mappings: TownZipMapping[];
  validZipcodes: string[];
  initialTown?: string;
  initialZipcode?: string;
  townFieldName?: string;
  zipcodeFieldName?: string;
  townRequired?: boolean;
  zipcodeRequired?: boolean;
}

// Simple fuzzy match - checks if query letters appear in order in target
function fuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  // First check if it starts with the query for better ranking
  if (t.startsWith(q)) return true;

  // Then check if it contains the query
  if (t.includes(q)) return true;

  // Finally do fuzzy matching
  let qIndex = 0;
  for (let i = 0; i < t.length && qIndex < q.length; i++) {
    if (t[i] === q[qIndex]) qIndex++;
  }
  return qIndex === q.length;
}

// Score matches for sorting (lower is better)
function matchScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  if (t === q) return 0;
  if (t.startsWith(q)) return 1;
  if (t.includes(q)) return 2;
  return 3;
}

export default function TownZipFieldIsland({
  mappings,
  validZipcodes,
  initialTown = '',
  initialZipcode = '',
  townFieldName = 'town',
  zipcodeFieldName = 'zipcode',
  townRequired = true,
  zipcodeRequired = true,
}: Props) {
  const [townValue, setTownValue] = useState(initialTown);
  const [zipcodeValue, setZipcodeValue] = useState(initialZipcode);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [zipcodeError, setZipcodeError] = useState('');
  const [filteredMappings, setFilteredMappings] = useState<TownZipMapping[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const townInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);

  // Filter mappings based on town input
  useEffect(() => {
    if (!townValue.trim()) {
      setFilteredMappings([]);
      return;
    }

    const matches = mappings
      .filter(m => fuzzyMatch(townValue, m.town))
      .sort((a, b) => matchScore(townValue, a.town) - matchScore(townValue, b.town))
      .slice(0, 8);

    setFilteredMappings(matches);
  }, [townValue, mappings]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle town selection from dropdown
  const selectTown = useCallback((mapping: TownZipMapping) => {
    setTownValue(mapping.displayTown);
    setZipcodeValue(mapping.zipcode);
    setShowDropdown(false);
    setHighlightedIndex(-1);
    setZipcodeError('');
  }, []);

  // Handle town input change
  const handleTownChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTownValue(value);
    setShowDropdown(value.trim().length > 0);
    setHighlightedIndex(-1);
  };

  // Handle zipcode input change with validation
  const handleZipcodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 5);
    setZipcodeValue(value);

    if (value.length === 5) {
      if (validZipcodes.includes(value)) {
        // Valid zipcode - auto-fill town
        const mapping = mappings.find(m => m.zipcode === value);
        if (mapping) {
          // Get the display town (may show multiple towns for shared zips)
          const sharedMappings = mappings.filter(m => m.zipcode === value);
          const displayTown = sharedMappings.length > 1
            ? [...new Set(sharedMappings.map(m => m.town))].join(' / ')
            : mapping.town;
          setTownValue(displayTown);
        }
        setZipcodeError('');
      } else {
        // Invalid zipcode
        setZipcodeError('This zip code is not in our service area');
      }
    } else {
      setZipcodeError('');
    }
  };

  // Handle keyboard navigation
  const handleTownKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || filteredMappings.length === 0) {
      if (e.key === 'ArrowDown' && townValue.trim()) {
        setShowDropdown(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < filteredMappings.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredMappings.length) {
          selectTown(filteredMappings[highlightedIndex]);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        setHighlightedIndex(-1);
        break;
      case 'Tab':
        setShowDropdown(false);
        break;
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && dropdownRef.current) {
      const items = dropdownRef.current.querySelectorAll('li');
      items[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  // Inline styles matching the form styling
  const styles = {
    container: {
      display: 'contents',
    } as React.CSSProperties,
    formGroup: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '0.5rem',
      position: 'relative' as const,
    },
    label: {
      fontSize: '0.875rem',
      fontWeight: 500,
      color: '#1a1a1a',
    },
    required: {
      color: '#dc2626',
    },
    input: {
      padding: '0.75rem 1rem',
      border: '1px solid #e2e8f0',
      borderRadius: '0.5rem',
      fontSize: '1rem',
      transition: 'all 0.2s ease',
      width: '100%',
      boxSizing: 'border-box' as const,
    },
    inputError: {
      borderColor: '#dc2626',
    },
    dropdown: {
      position: 'absolute' as const,
      top: '100%',
      left: 0,
      right: 0,
      marginTop: '0.25rem',
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: '0.5rem',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      zIndex: 50,
      maxHeight: '240px',
      overflowY: 'auto' as const,
      listStyle: 'none',
      margin: 0,
      padding: '0.25rem 0',
    },
    dropdownItem: {
      padding: '0.75rem 1rem',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '0.125rem',
      transition: 'background-color 0.1s ease',
    },
    dropdownItemHighlighted: {
      backgroundColor: '#f1f5f9',
    },
    townName: {
      fontWeight: 500,
      color: '#1a1a1a',
    },
    townMeta: {
      fontSize: '0.75rem',
      color: '#64748b',
    },
    error: {
      fontSize: '0.75rem',
      color: '#dc2626',
      marginTop: '0.25rem',
    },
  };

  return (
    <div ref={containerRef} style={styles.container}>
      {/* Hidden inputs for Netlify form capture */}
      <input type="hidden" name={townFieldName} value={townValue} />
      <input type="hidden" name={zipcodeFieldName} value={zipcodeValue} />

      {/* Town field with autocomplete */}
      <div className="form-group" style={styles.formGroup}>
        <label htmlFor="town-autocomplete" style={styles.label}>
          Town {townRequired && <span style={styles.required}>*</span>}
        </label>
        <input
          ref={townInputRef}
          type="text"
          id="town-autocomplete"
          value={townValue}
          onChange={handleTownChange}
          onKeyDown={handleTownKeyDown}
          onFocus={() => townValue.trim() && setShowDropdown(true)}
          placeholder="Start typing a town name..."
          autoComplete="off"
          aria-required={townRequired}
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls="town-dropdown"
          style={styles.input}
        />

        {showDropdown && filteredMappings.length > 0 && (
          <ul
            ref={dropdownRef}
            id="town-dropdown"
            role="listbox"
            style={styles.dropdown}
          >
            {filteredMappings.map((mapping, index) => (
              <li
                key={`${mapping.town}-${mapping.zipcode}`}
                role="option"
                aria-selected={index === highlightedIndex}
                onClick={() => selectTown(mapping)}
                onMouseEnter={() => setHighlightedIndex(index)}
                style={{
                  ...styles.dropdownItem,
                  ...(index === highlightedIndex ? styles.dropdownItemHighlighted : {}),
                }}
              >
                <span style={styles.townName}>{mapping.town}</span>
                <span style={styles.townMeta}>
                  {mapping.zipcode} | {mapping.county}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Zipcode field with validation */}
      <div className="form-group" style={styles.formGroup}>
        <label htmlFor="zipcode-autocomplete" style={styles.label}>
          Zip Code {zipcodeRequired && <span style={styles.required}>*</span>}
        </label>
        <input
          type="text"
          id="zipcode-autocomplete"
          value={zipcodeValue}
          onChange={handleZipcodeChange}
          placeholder="08XXX"
          maxLength={5}
          inputMode="numeric"
          pattern="[0-9]{5}"
          aria-required={zipcodeRequired}
          aria-invalid={!!zipcodeError}
          aria-describedby={zipcodeError ? 'zipcode-error' : undefined}
          style={{
            ...styles.input,
            ...(zipcodeError ? styles.inputError : {}),
          }}
        />
        {zipcodeError && (
          <span id="zipcode-error" role="alert" style={styles.error}>
            {zipcodeError}
          </span>
        )}
      </div>
    </div>
  );
}
