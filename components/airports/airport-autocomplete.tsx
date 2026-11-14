"use client";

import * as React from "react";
import { Building2, MapPin, PlaneTakeoff, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Airport } from "@/types/database";

let cachedAirports: Airport[] | null = null;
let loadPromise: Promise<Airport[]> | null = null;

async function getAirports(): Promise<Airport[]> {
  if (cachedAirports) return cachedAirports;
  if (!loadPromise) {
    loadPromise = fetch("/data/airports.json")
      .then((res) => res.json())
      .then((data: Airport[]) => {
        cachedAirports = data;
        return data;
      })
      .catch(() => []);
  }
  return loadPromise;
}

interface AirportAutocompleteProps {
  id: string;
  label: string;
  value: string;
  onChange: (iata: string) => void;
  placeholder?: string;
  error?: string;
}

export function AirportAutocomplete({
  id,
  label,
  value,
  onChange,
  placeholder = "City or IATA (e.g. DEL, BOM, DXB)",
  error,
}: AirportAutocompleteProps) {
  const [airports, setAirports] = React.useState<Airport[]>(cachedAirports ?? []);
  const [query, setQuery] = React.useState(value);
  const [debouncedQuery, setDebouncedQuery] = React.useState(value);
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    getAirports().then((data) => {
      setAirports(data);
      if (value) {
        const match = data.find((a) => a.iata === value.toUpperCase());
        if (match) setQuery(`${match.city} (${match.iata})`);
      }
    });
  }, [value]);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 100);
    return () => clearTimeout(timer);
  }, [query]);

  React.useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const filtered = React.useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return airports.slice(0, 8);
    return airports
      .filter(
        (a) =>
          a.iata.toLowerCase().includes(q) ||
          a.city.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q) ||
          a.country.toLowerCase().includes(q),
      )
      .sort((a, b) => {
        const aExact = a.iata.toLowerCase() === q ? 0 : a.iata.toLowerCase().startsWith(q) ? 1 : 2;
        const bExact = b.iata.toLowerCase() === q ? 0 : b.iata.toLowerCase().startsWith(q) ? 1 : 2;
        return aExact - bExact;
      })
      .slice(0, 8);
  }, [airports, debouncedQuery]);

  function selectAirport(airport: Airport) {
    onChange(airport.iata);
    setQuery(`${airport.city} (${airport.iata})`);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === "Enter" && filtered[activeIndex]) {
      e.preventDefault();
      selectAirport(filtered[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative space-y-1.5 w-full">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          {label}
        </label>
        {value && (
          <span className="font-mono text-[11px] font-bold text-sky-400">
            {value}
          </span>
        )}
      </div>

      <div className="relative group">
        <PlaneTakeoff className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)] group-focus-within:text-sky-400 transition-colors" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id || "airport"}-listbox`}
          aria-autocomplete="list"
          value={query}
          placeholder={placeholder}
          onFocus={() => {
            setOpen(true);
            setActiveIndex(0);
          }}
          onChange={(e) => {
            const val = e.target.value;
            setQuery(val);
            setOpen(true);
            setActiveIndex(0);
            if (/^[A-Za-z]{3}$/.test(val.trim())) {
              onChange(val.trim().toUpperCase());
            } else if (!val.trim()) {
              onChange("");
            }
          }}
          onKeyDown={handleKeyDown}
          className={cn(
            "flex min-h-[42px] sm:min-h-[40px] w-full rounded-xl border border-[var(--border)] bg-[var(--glass-surface-2)] pl-10 pr-9 py-2 text-sm text-[var(--foreground)] backdrop-blur-md shadow-inner transition-all duration-200 placeholder:text-[var(--muted-foreground)]/60 hover:border-[var(--border-strong)] focus-visible:outline-none focus-visible:border-sky-500/60 focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:bg-[var(--glass-surface-3)]",
            error && "border-red-500/80 focus-visible:ring-red-500/30",
          )}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              onChange("");
              inputRef.current?.focus();
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] rounded-lg transition-colors cursor-pointer"
            aria-label="Clear airport selection"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1.5 max-h-64 w-full overflow-auto rounded-2xl glass-floating p-1.5 shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 border border-[var(--border-strong)]"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-3 text-center text-xs text-[var(--muted-foreground)]">
              No airports found matching &ldquo;{debouncedQuery}&rdquo;.
            </li>
          ) : (
            filtered.map((airport, idx) => (
              <li
                key={airport.iata}
                role="option"
                aria-selected={idx === activeIndex}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectAirport(airport);
                }}
                onMouseEnter={() => setActiveIndex(idx)}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-all duration-150",
                  idx === activeIndex
                    ? "bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30 shadow-xs"
                    : "hover:bg-[var(--glass-surface-3)] text-[var(--foreground)] border border-transparent",
                )}
              >
                <div className="min-w-0 flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div className="truncate">
                    <p className="font-bold text-xs sm:text-sm truncate">
                      {airport.city} <span className="font-normal text-[var(--muted-foreground)]">· {airport.country}</span>
                    </p>
                    <p className="text-[11px] text-[var(--muted-foreground)] truncate">
                      {airport.name}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-lg border border-sky-500/30 bg-sky-500/15 px-2.5 py-0.5 font-mono text-xs font-bold text-sky-300">
                  {airport.iata}
                </span>
              </li>
            ))
          )}
        </ul>
      )}

      {error && <p className="text-xs text-red-400 font-medium">{error}</p>}
    </div>
  );
}
