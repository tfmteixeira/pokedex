import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { fetchAllPokemonNames, fetchPokemonListItem, fetchSpecialForms } from '../api/pokeapi';
import type { PokemonListItem } from '../api/pokeapi';
import { PokemonCard } from '../components/PokemonCard';
import { UI } from '../i18n/ui';
import { REGIONS } from '../i18n/regions';

const PAGE_SIZE = 30;
const SCROLL_KEY = 'pokedex_list_state';

type SortOrder = 'numeric' | 'height' | 'weight';

interface SavedListState {
  search: string;
  region: string | null;
  special: string | null;
  sort: SortOrder;
  visibleCount: number;
  scrollY: number;
}

function readSavedState(): SavedListState | null {
  try {
    const raw = sessionStorage.getItem(SCROLL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedListState;
    if (typeof parsed.scrollY !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function PokemonListPage() {
  const saved = useRef<SavedListState | null>(readSavedState()).current;
  const [search, setSearch] = useState(saved?.search ?? '');
  const [region, setRegion] = useState<string | null>(saved?.region ?? null);
  const [special, setSpecial] = useState<string | null>(saved?.special ?? null);
  const [sort, setSort] = useState<SortOrder>(saved?.sort ?? 'numeric');
  const [visibleCount, setVisibleCount] = useState(saved?.visibleCount ?? PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const pendingScrollRef = useRef<number | null>(saved?.scrollY ?? null);

  const namesQuery = useQuery({
    queryKey: ['pokemon-names'],
    queryFn: fetchAllPokemonNames,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const specialFormsQuery = useQuery({
    queryKey: ['special-forms', special],
    queryFn: () => fetchSpecialForms(special as 'mega' | 'gmax'),
    enabled: !!special,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const filteredIds = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (special) {
      if (!specialFormsQuery.data) return [];
      return specialFormsQuery.data
        .filter((p) => (q ? p.name.includes(q) : true))
        .map((p) => p.id)
        .sort((a, b) => a - b);
    }

    if (!namesQuery.data) return [];
    const sel = REGIONS.find((r) => r.key === region);
    return namesQuery.data
      .filter((p) => (q ? p.name.includes(q) : true))
      .filter((p) => (sel ? p.id >= sel.range[0] && p.id <= sel.range[1] : true))
      .map((p) => p.id)
      .sort((a, b) => a - b);
  }, [namesQuery.data, specialFormsQuery.data, search, region, special]);

  // When sorting by height/weight we need all data to sort correctly —
  // disable pagination and load everything at once.
  const idsToShow = useMemo(
    () => sort === 'numeric' ? filteredIds.slice(0, visibleCount) : filteredIds,
    [filteredIds, visibleCount, sort]
  );

  const detailQueries = useQueries({
    queries: idsToShow.map((id) => ({
      queryKey: ['pokemon-list-item', id],
      queryFn: () => fetchPokemonListItem(id),
      staleTime: 1000 * 60 * 60 * 24,
      gcTime: 1000 * 60 * 60 * 24,
      retry: 3,
    })),
  });

  const visibleItems = useMemo(() => {
    const loaded = detailQueries.map((q) => q.data).filter((x): x is PokemonListItem => !!x);
    if (sort === 'height') return [...loaded].sort((a, b) => b.height - a.height);
    if (sort === 'weight') return [...loaded].sort((a, b) => b.weight - a.weight);
    return loaded;
  }, [detailQueries, sort]);

  const stillLoading = detailQueries.some((q) => q.isLoading);

  // Reset pagination when filters change — but skip the very first run so we
  // don't clobber the visibleCount restored from sessionStorage.
  const filtersInitRef = useRef(true);
  useEffect(() => {
    if (filtersInitRef.current) { filtersInitRef.current = false; return; }
    setVisibleCount(PAGE_SIZE);
  }, [search, region, special]);

  // Restore scroll position once the page is tall enough.
  useEffect(() => {
    const target = pendingScrollRef.current;
    if (target === null) return;
    if (document.documentElement.scrollHeight >= target + window.innerHeight - 100) {
      window.scrollTo(0, target);
      pendingScrollRef.current = null;
    }
  }, [visibleItems.length]);

  // Persist scroll + filters continuously so we can restore on return. We poll
  // every 200ms because saving from useEffect cleanup is unreliable (by the
  // time React's cleanup fires, the old grid has been unmounted and
  // window.scrollY has already been clamped to the shorter detail page).
  const stateRef = useRef({ visibleCount, search, region, special, sort });
  stateRef.current = { visibleCount, search, region, special, sort };
  useEffect(() => {
    const save = () => {
      sessionStorage.setItem(SCROLL_KEY, JSON.stringify({
        ...stateRef.current,
        scrollY: window.scrollY,
      }));
    };
    save();
    const interval = window.setInterval(save, 200);
    window.addEventListener('pagehide', save);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('pagehide', save);
    };
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !stillLoading && visibleCount < filteredIds.length) {
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, filteredIds.length));
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleCount, filteredIds.length, stillLoading]);

  if (namesQuery.isLoading || (special && specialFormsQuery.isLoading)) return <CenteredSpinner message={UI.loading} />;
  if (namesQuery.isError) return <ErrorBox onRetry={() => namesQuery.refetch()} />;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl" aria-hidden>🔍</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={UI.search}
            className="w-full pl-12 pr-4 py-3 rounded-full bg-white shadow-md border-2 border-transparent focus:border-red-400 focus:outline-none text-lg"
          />
        </div>
      </div>

      <div className="mb-3 flex gap-2 items-center">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Ordenar</span>
        {([['numeric', '🔢', 'Número'], ['height', '📏', 'Altura'], ['weight', '⚖️', 'Peso']] as const).map(([key, emoji, label]) => (
          <button
            key={key}
            onClick={() => setSort(key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all active:scale-95 ${
              sort === key
                ? 'bg-red-500 text-white shadow'
                : 'bg-white text-slate-600 shadow-sm hover:bg-red-50'
            }`}
          >
            <span>{emoji}</span>{label}
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <FilterChip
          active={region === null && special === null}
          onClick={() => { setRegion(null); setSpecial(null); }}
          emoji="🌍"
          label={UI.allRegions}
        />
        {REGIONS.map((r) => (
          <FilterChip
            key={r.key}
            active={region === r.key}
            onClick={() => { setRegion(region === r.key ? null : r.key); setSpecial(null); }}
            emoji={r.emoji}
            label={r.name}
            sublabel={`Gen ${r.generation}`}
          />
        ))}
        <FilterChip
          active={special === 'mega'}
          onClick={() => { setSpecial(special === 'mega' ? null : 'mega'); setRegion(null); }}
          emoji="✨"
          label="Mega"
        />
        <FilterChip
          active={special === 'gmax'}
          onClick={() => { setSpecial(special === 'gmax' ? null : 'gmax'); setRegion(null); }}
          emoji="⚡"
          label="Gigantamax"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        {visibleItems.map((p) => (
          <PokemonCard key={p.id} pokemon={p} />
        ))}
        {stillLoading &&
          Array.from({ length: Math.max(0, idsToShow.length - visibleItems.length) })
            .slice(0, 10)
            .map((_, i) => (
              <div key={`sk-${i}`} className="aspect-[3/4] rounded-3xl bg-white/40 animate-pulse" />
            ))}
      </div>

      {sort === 'numeric' && visibleCount < filteredIds.length && <div ref={sentinelRef} className="h-8 mt-4" />}

      {!stillLoading && visibleItems.length === 0 && filteredIds.length === 0 && (
        <p className="text-center text-slate-500 py-8">
          Nenhum Pokémon encontrado.
        </p>
      )}
    </div>
  );
}

function FilterChip({
  active, onClick, emoji, label, sublabel,
}: {
  active: boolean; onClick: () => void; emoji: string; label: string; sublabel?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 inline-flex items-center gap-2 rounded-full px-4 py-2 transition-all active:scale-95 ${
        active
          ? 'bg-red-500 text-white shadow-lg'
          : 'bg-white text-slate-700 shadow-sm hover:bg-red-50'
      }`}
    >
      <span className="text-base" aria-hidden>{emoji}</span>
      <span className="text-sm font-semibold">{label}</span>
      {sublabel && (
        <span className={`text-[10px] uppercase tracking-wider ${active ? 'opacity-80' : 'opacity-60'}`}>
          {sublabel}
        </span>
      )}
    </button>
  );
}

function CenteredSpinner({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <img src="/pokeball.svg" alt="" className="w-20 h-20 animate-spin" />
      <p className="mt-4 text-lg text-slate-600">{message}</p>
    </div>
  );
}

function ErrorBox({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <p className="text-lg text-slate-700">{UI.error}</p>
      <button onClick={onRetry} className="mt-4 px-6 py-3 rounded-full bg-red-500 text-white font-bold">
        {UI.retry}
      </button>
    </div>
  );
}
