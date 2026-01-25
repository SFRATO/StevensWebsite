/**
 * TownSearchIsland Component
 * React island for interactive town search with autocomplete
 * Used on the /areas/ page hero section
 */
import { useState, useRef, useEffect, useMemo } from 'react';

interface Town {
  name: string;
  zipcode: string;
  county: string;
  medianPrice: number | null;
  priceYoY: number | null;
  marketType: 'seller' | 'buyer' | 'balanced';
}

interface Props {
  towns: Town[];
}

export default function TownSearchIsland({ towns }: Props) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Fuzzy search function
  const fuzzyMatch = (text: string, search: string): boolean => {
    const textLower = text.toLowerCase();
    const searchLower = search.toLowerCase();

    // Direct substring match
    if (textLower.includes(searchLower)) return true;

    // Fuzzy match (all characters in order)
    let searchIndex = 0;
    for (let i = 0; i < textLower.length && searchIndex < searchLower.length; i++) {
      if (textLower[i] === searchLower[searchIndex]) {
        searchIndex++;
      }
    }
    return searchIndex === searchLower.length;
  };

  // Filter and group results
  const results = useMemo(() => {
    if (!query.trim()) return [];

    const matches = towns.filter(
      (town) =>
        fuzzyMatch(town.name, query) ||
        town.zipcode.includes(query)
    );

    // Group by county
    const grouped: Record<string, Town[]> = {};
    for (const town of matches) {
      const county = town.county.replace(' County', '');
      if (!grouped[county]) grouped[county] = [];
      grouped[county].push(town);
    }

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 4); // Limit to 4 counties max
  }, [query, towns]);

  // Flat list for keyboard navigation
  const flatResults = useMemo(() => {
    return results.flatMap(([_, countyTowns]) => countyTowns.slice(0, 3));
  }, [results]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' && query.trim()) {
        setIsOpen(true);
        setSelectedIndex(0);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < flatResults.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && flatResults[selectedIndex]) {
          navigateToTown(flatResults[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Navigate to town page
  const navigateToTown = (town: Town) => {
    window.location.href = `/market/${town.zipcode}/`;
  };

  // Format currency
  const formatPrice = (price: number | null): string => {
    if (price === null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(e.target as Node) &&
        listRef.current &&
        !listRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Open dropdown when typing
  useEffect(() => {
    if (query.trim() && results.length > 0) {
      setIsOpen(true);
      setSelectedIndex(-1);
    } else {
      setIsOpen(false);
    }
  }, [query, results.length]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const selectedEl = listRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      );
      selectedEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  let flatIndex = -1;

  return (
    <div className="town-search">
      <div className="search-input-wrapper">
        <svg
          className="search-icon"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.trim() && results.length > 0 && setIsOpen(true)}
          placeholder="Search for your town..."
          className="search-input"
          aria-label="Search for a town"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            className="clear-btn"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 18L18 6M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <ul
          ref={listRef}
          className="results-dropdown"
          role="listbox"
          aria-label="Town search results"
        >
          {results.map(([county, countyTowns]) => (
            <li key={county} className="county-group">
              <span className="county-label">{county}</span>
              <ul className="town-list">
                {countyTowns.slice(0, 3).map((town) => {
                  flatIndex++;
                  const idx = flatIndex;
                  return (
                    <li
                      key={`${town.zipcode}-${town.name}`}
                      data-index={idx}
                      className={`town-item ${selectedIndex === idx ? 'selected' : ''}`}
                      onClick={() => navigateToTown(town)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      role="option"
                      aria-selected={selectedIndex === idx}
                    >
                      <div className="town-info">
                        <span className="town-name">{town.name}</span>
                        <span className="town-zip">{town.zipcode}</span>
                      </div>
                      <div className="town-metrics">
                        <span className="town-price">
                          {formatPrice(town.medianPrice)}
                        </span>
                        <span
                          className={`market-badge badge-${town.marketType}`}
                        >
                          {town.marketType === 'seller'
                            ? "Seller's"
                            : town.marketType === 'buyer'
                              ? "Buyer's"
                              : 'Balanced'}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {isOpen && query.trim() && results.length === 0 && (
        <div className="no-results">
          <p>No towns found matching "{query}"</p>
          <a href="/contact/" className="contact-link">
            Contact me - I may still serve your area
          </a>
        </div>
      )}

      <style>{`
        .town-search {
          position: relative;
          width: 100%;
          max-width: 500px;
          margin: 0 auto;
        }

        .search-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .search-icon {
          position: absolute;
          left: 16px;
          color: #6B6B6B;
          pointer-events: none;
        }

        .search-input {
          width: 100%;
          padding: 16px 48px;
          font-size: 16px;
          border: 2px solid #E0E0E0;
          border-radius: 9999px;
          background: #FFFFFF;
          transition: all 0.25s ease;
        }

        .search-input:focus {
          outline: none;
          border-color: #C99C33;
          box-shadow: 0 0 0 4px rgba(201, 156, 51, 0.1);
        }

        .search-input::placeholder {
          color: #6B6B6B;
        }

        .clear-btn {
          position: absolute;
          right: 12px;
          padding: 8px;
          background: transparent;
          border: none;
          cursor: pointer;
          color: #6B6B6B;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.15s ease;
        }

        .clear-btn:hover {
          background: #F5F5F5;
          color: #2C2C2C;
        }

        .results-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          right: 0;
          background: #FFFFFF;
          border: 1px solid #E0E0E0;
          border-radius: 12px;
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.12);
          max-height: 400px;
          overflow-y: auto;
          z-index: 100;
          list-style: none;
          padding: 8px 0;
          margin: 0;
        }

        .county-group {
          padding: 0 8px;
        }

        .county-group:not(:last-child) {
          border-bottom: 1px solid #F5F5F5;
          padding-bottom: 8px;
          margin-bottom: 8px;
        }

        .county-label {
          display: block;
          padding: 8px 12px 4px;
          font-size: 11px;
          font-weight: 600;
          color: #6B6B6B;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .town-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .town-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          cursor: pointer;
          border-radius: 8px;
          transition: background 0.15s ease;
        }

        .town-item:hover,
        .town-item.selected {
          background: #FAFAFA;
        }

        .town-item.selected {
          background: rgba(201, 156, 51, 0.1);
        }

        .town-info {
          display: flex;
          align-items: baseline;
          gap: 8px;
        }

        .town-name {
          font-weight: 600;
          color: #2C2C2C;
        }

        .town-zip {
          font-size: 12px;
          color: #6B6B6B;
        }

        .town-metrics {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .town-price {
          font-weight: 600;
          color: #C99C33;
          font-size: 14px;
        }

        .market-badge {
          font-size: 10px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 9999px;
        }

        .badge-seller {
          background: rgba(76, 175, 80, 0.15);
          color: #2e7d32;
        }

        .badge-buyer {
          background: rgba(229, 57, 53, 0.15);
          color: #c62828;
        }

        .badge-balanced {
          background: rgba(201, 156, 51, 0.15);
          color: #B38A1F;
        }

        .no-results {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          right: 0;
          background: #FFFFFF;
          border: 1px solid #E0E0E0;
          border-radius: 12px;
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.12);
          padding: 24px;
          text-align: center;
          z-index: 100;
        }

        .no-results p {
          color: #6B6B6B;
          margin: 0 0 12px;
        }

        .contact-link {
          color: #C99C33;
          font-weight: 500;
          text-decoration: none;
        }

        .contact-link:hover {
          text-decoration: underline;
        }

        @media (max-width: 640px) {
          .town-metrics {
            flex-direction: column;
            align-items: flex-end;
            gap: 4px;
          }
        }
      `}</style>
    </div>
  );
}
