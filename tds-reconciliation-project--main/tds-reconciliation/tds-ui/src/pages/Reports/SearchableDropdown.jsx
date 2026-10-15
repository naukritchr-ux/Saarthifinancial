import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, ChevronDown } from 'lucide-react';

const MAX_VISIBLE = 100; // rendered rows; typing narrows the rest

/** Financial-year choices for the report filter (same order as before) */
export const FY_OPTIONS = [
  { value: 'FY 2026-27', label: 'FY 2026-27 (Saarthi 360 Era)' },
  { value: 'FY 2025-26', label: 'FY 2025-26' },
  { value: 'FY 2024-25', label: 'FY 2024-25' },
  { value: 'FY 2023-24', label: 'FY 2023-24' },
  { value: 'FY 2022-23', label: 'FY 2022-23' },
  { value: 'FY 2021-22', label: 'FY 2021-22' },
  { value: 'FY 2020-21', label: 'FY 2020-21' },
  { value: 'FY 2019-20', label: 'FY 2019-20' }
];

const norm = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
const tidy = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/**
 * One dropdown design for every report filter (Financial Year, Company Name, PAN Number).
 * The small heading above it stays in the page; this renders the box and its popup.
 *
 *  value        the selected value (or allValue when nothing is selected)
 *  options      strings, or { value, label } objects
 *  allValue     value that means "no filter"   (default 'All')
 *  allLabel     text of the first row / closed box when nothing is selected
 *  showSearch   show the search box in the popup (default true)
 *  sort         sort A-Z (default true; use false to keep the given order)
 *  mono         monospace font (PAN numbers)
 *  onChange     (value) => void
 */
export default function SearchableDropdown({
  value = 'All',
  options = [],
  allValue = 'All',
  allLabel = 'All',
  placeholder = 'Type to search...',
  showSearch = true,
  sort = true,
  mono = false,
  onChange
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const listRef = useRef(null);

  const uniqueOptions = useMemo(() => {
    const seen = new Map();
    for (const raw of options || []) {
      if (raw === null || raw === undefined) continue;
      const isObj = typeof raw === 'object';
      const val = tidy(isObj ? raw.value : raw);
      const key = norm(val);
      if (!key || seen.has(key)) continue;
      seen.set(key, { value: val, label: tidy(isObj ? (raw.label ?? raw.value) : raw) || val });
    }
    const list = [...seen.values()];
    return sort ? list.sort((a, b) => a.label.localeCompare(b.label, 'en', { sensitivity: 'base' })) : list;
  }, [options, sort]);

  const matches = useMemo(() => {
    const tokens = norm(query).split(' ').filter(Boolean);
    if (tokens.length === 0) return uniqueOptions;
    return uniqueOptions.filter((o) => {
      const hay = `${norm(o.label)} ${norm(o.value)}`;
      return tokens.every((t) => hay.includes(t));
    });
  }, [uniqueOptions, query]);

  const visible = matches.slice(0, MAX_VISIBLE);
  const rowCount = visible.length + 1; // row 0 is the "All" row

  const close = () => { setOpen(false); setQuery(''); };

  useEffect(() => {
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  useEffect(() => { setActive(query ? 1 : 0); }, [query, open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[active];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const choose = (v) => { onChange(v); close(); };

  // One keyboard handler on the wrapper (works whether the search box or the button has focus)
  const onKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, rowCount - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(active === 0 ? allValue : visible[active - 1].value);
    } else if (e.key === 'Escape') {
      close();
    }
  };

  const isAll = value === allValue;
  const selectedLabel = isAll
    ? allLabel
    : (uniqueOptions.find((o) => o.value === value)?.label ?? value);

  return (
    <div ref={rootRef} className="relative min-w-0" onKeyDown={onKeyDown}>
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-2 bg-[#F6F8FA] border text-[#1F1B2E] rounded-xl px-3 py-2 text-left text-xs focus:outline-none focus:border-[#9B87F5] cursor-pointer ${
          open ? 'border-[#9B87F5]' : 'border-[#E9E4FA]'
        } ${mono ? 'font-mono font-bold' : 'font-semibold'}`}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-[#6B6580] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[220px] rounded-xl border border-[#E9E4FA] bg-white shadow-xl overflow-hidden">
          {showSearch && (
            <div className="relative p-2 border-b border-[#E9E4FA]">
              <Search className="w-4 h-4 text-[#6B6580] absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                autoFocus
                className="w-full bg-[#F6F8FA] border border-[#E9E4FA] rounded-lg pl-8 pr-3 py-2 text-xs text-[#1F1B2E] focus:outline-none focus:border-[#9B87F5]"
              />
            </div>
          )}

          <ul ref={listRef} role="listbox" className="max-h-60 overflow-y-auto py-1 text-xs">
            <li
              role="option"
              aria-selected={isAll}
              onMouseDown={(e) => { e.preventDefault(); choose(allValue); }}
              onMouseEnter={() => setActive(0)}
              className={`px-3 py-2 cursor-pointer font-semibold ${active === 0 ? 'bg-[#F3F0FF]' : ''} ${
                isAll ? 'text-[#6B55C7] font-bold' : 'text-[#6B6580]'
              }`}
            >
              {allLabel}
            </li>

            {visible.map((o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={value === o.value}
                onMouseDown={(e) => { e.preventDefault(); choose(o.value); }}
                onMouseEnter={() => setActive(i + 1)}
                className={`px-3 py-2 cursor-pointer break-words ${mono ? 'font-mono font-bold' : 'font-semibold'} ${
                  active === i + 1 ? 'bg-[#F3F0FF]' : ''
                } ${value === o.value ? 'bg-[#E8E4FF] text-[#6B55C7]' : 'text-[#1F1B2E]'}`}
              >
                {o.label}
              </li>
            ))}

            {matches.length === 0 && (
              <li className="px-3 py-3 text-[#6B6580]">No matching options found.</li>
            )}
            {matches.length > MAX_VISIBLE && (
              <li className="px-3 py-2 text-[10px] text-[#6B6580] border-t border-[#E9E4FA]">
                Showing {MAX_VISIBLE} of {matches.length} — keep typing to narrow down
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}