import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  fetchPokemonDetail, fetchSpecies, fetchEvolutionChain, findEvolutionNeighbors,
  officialArtwork, officialArtworkShiny, showdownSprite, showdownSpriteShiny,
} from '../api/pokeapi';
import type { EvolutionNode, MegaForm } from '../api/pokeapi';
import type { SpeechSegment } from '../hooks/useSpeech';
import { TypeBadge } from '../components/TypeBadge';
import { SpeakButton } from '../components/SpeakButton';
import { UI } from '../i18n/ui';
import { computeWeaknesses, computeAdvantages, TYPE_PT } from '../i18n/types';
import { translateCategory } from '../i18n/stats';
import { buildDescription, getManualFlavor, capitalize } from '../i18n/description';

const MIN_ID = 1;
const MAX_ID = 1025;

export function PokemonDetailPage() {
  const { id = '1' } = useParams();
  const numericId = Number(id);
  const navigate = useNavigate();
  const prevId = numericId > MIN_ID ? numericId - 1 : null;
  const nextId = numericId < MAX_ID ? numericId + 1 : null;

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && prevId) navigate(`/pokemon/${prevId}`);
      if (e.key === 'ArrowRight' && nextId) navigate(`/pokemon/${nextId}`);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [prevId, nextId, navigate]);

  // Touch swipe
  const [shiny, setShiny] = useState(false);
  useEffect(() => { setShiny(false); }, [numericId]);
  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (delta > 60 && prevId) navigate(`/pokemon/${prevId}`);
    if (delta < -60 && nextId) navigate(`/pokemon/${nextId}`);
  };

  const detailQuery = useQuery({
    queryKey: ['pokemon', id],
    queryFn: () => fetchPokemonDetail(id),
    staleTime: 1000 * 60 * 60,
  });

  const speciesQuery = useQuery({
    queryKey: ['species', detailQuery.data?.speciesUrl],
    queryFn: () => fetchSpecies(detailQuery.data!.speciesUrl),
    enabled: !!detailQuery.data,
    staleTime: 1000 * 60 * 60,
  });

  const chainQuery = useQuery({
    queryKey: ['evolution', speciesQuery.data?.evolutionChainUrl],
    queryFn: () => fetchEvolutionChain(speciesQuery.data!.evolutionChainUrl),
    enabled: !!speciesQuery.data,
    staleTime: 1000 * 60 * 60,
  });

  // For mega/variant forms, the canonical species name + a "Mega" label.
  const displayName = useMemo(() => {
    if (!detailQuery.data || !speciesQuery.data) return '';
    const mega = speciesQuery.data.megaForms.find((m) => m.id === detailQuery.data!.id);
    if (mega) return `${capitalize(speciesQuery.data.name)} ${mega.label}`;
    return capitalize(detailQuery.data.name);
  }, [detailQuery.data, speciesQuery.data]);

  // Prefer manual PT translation indexed by species id; fall back to a polished
  // structured PT description built from API data.
  const description = useMemo(() => {
    if (!detailQuery.data || !speciesQuery.data) return null;
    const manual = getManualFlavor(speciesQuery.data.id);
    if (manual) return manual;
    return buildDescription({ ...detailQuery.data, name: displayName }, speciesQuery.data);
  }, [detailQuery.data, speciesQuery.data, displayName]);

  const weaknesses = useMemo(
    () => (detailQuery.data ? computeWeaknesses(detailQuery.data.types) : []),
    [detailQuery.data]
  );
  const advantages = useMemo(
    () => (detailQuery.data ? computeAdvantages(detailQuery.data.types) : []),
    [detailQuery.data]
  );

  // Read the full Pokémon profile aloud: name (en, matches the English-derived
  // etymology) followed by description, type, size, weaknesses, advantages (pt-PT).
  const fullSpeech = useMemo<SpeechSegment[]>(() => {
    if (!detailQuery.data || !description) return [];
    const detail = detailQuery.data;
    const typeNames = detail.types.map((t) => TYPE_PT[t]);
    const typesPhrase =
      typeNames.length === 1 ? `É do tipo ${typeNames[0]}` : `É dos tipos ${typeNames[0]} e ${typeNames[1]}`;
    const list = (arr: string[]) =>
      arr.length === 0 ? null : arr.length === 1 ? arr[0] : arr.slice(0, -1).join(', ') + ' e ' + arr[arr.length - 1];
    const weakList = list(weaknesses.map((t) => TYPE_PT[t]));
    const advList = list(advantages.map((t) => TYPE_PT[t]));

    const ptParts = [
      `${typesPhrase}.`,
      description,
      weakList ? `As suas fraquezas são: ${weakList}.` : null,
      advList ? `Tem vantagem contra: ${advList}.` : null,
    ].filter(Boolean) as string[];

    return [
      { text: `${displayName}.`, lang: 'en-US' },
      { text: ptParts.join(' '), lang: 'pt-PT' },
    ];
  }, [detailQuery.data, description, displayName, weaknesses, advantages]);

  if (detailQuery.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <img src="/pokeball.svg" alt="" className="w-20 h-20 animate-spin" />
        <p className="mt-4 text-lg text-slate-600">{UI.loading}</p>
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-xl">{UI.notFound}</p>
        <Link to="/" className="mt-4 px-6 py-3 rounded-full bg-red-500 text-white font-bold">
          {UI.back}
        </Link>
      </div>
    );
  }

  const detail = detailQuery.data;
  const speciesId = speciesQuery.data?.id ?? numericId;
  const neighbors = chainQuery.data
    ? findEvolutionNeighbors(chainQuery.data, speciesId)
    : { prev: null, next: [] };
  const speciesNode: EvolutionNode = speciesQuery.data
    ? {
        id: speciesId,
        name: speciesQuery.data.name,
        spriteUrl: officialArtwork(speciesId),
        evolvesTo: [],
      }
    : { id: detail.id, name: detail.name, spriteUrl: detail.spriteUrl, evolvesTo: [] };

  return (
    <div
      className="max-w-4xl mx-auto px-4 py-6"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-slate-700 font-semibold hover:text-red-600 active:scale-95"
        >
          <span className="text-xl">←</span> {UI.back}
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => prevId && navigate(`/pokemon/${prevId}`)}
            disabled={!prevId}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-white shadow text-slate-700 font-semibold disabled:opacity-30 hover:bg-red-50 active:scale-95 transition-all"
            aria-label="Pokémon anterior"
          >
            <span>←</span>
            {prevId && <span className="text-xs text-slate-400">#{String(prevId).padStart(4, '0')}</span>}
          </button>
          <button
            onClick={() => nextId && navigate(`/pokemon/${nextId}`)}
            disabled={!nextId}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-white shadow text-slate-700 font-semibold disabled:opacity-30 hover:bg-red-50 active:scale-95 transition-all"
            aria-label="Próximo Pokémon"
          >
            {nextId && <span className="text-xs text-slate-400">#{String(nextId).padStart(4, '0')}</span>}
            <span>→</span>
          </button>
        </div>
      </div>

      {/* Hero card */}
      <div className="rounded-3xl bg-white shadow-xl overflow-hidden">
        <div className="relative bg-gradient-to-br from-red-100 via-yellow-50 to-blue-100 p-6 sm:p-8 flex flex-col items-center">
          <span className="absolute top-4 right-4 text-base font-bold text-slate-400">
            #{String(detail.id).padStart(4, '0')}
          </span>
          <img
            src={shiny ? officialArtworkShiny(detail.id) : detail.spriteUrl}
            alt={detail.name}
            className="w-64 h-64 sm:w-80 sm:h-80 object-contain drop-shadow-2xl transition-opacity duration-300"
          />
          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-4xl sm:text-5xl font-bold text-slate-800 text-center">
              {displayName}
            </h1>
            <button
              onClick={() => setShiny((s) => !s)}
              title={shiny ? 'Ver versão normal' : 'Ver versão shiny'}
              className={`text-3xl transition-all active:scale-90 ${shiny ? 'drop-shadow-[0_0_8px_gold]' : 'opacity-40 hover:opacity-80'}`}
            >
              ✨
            </button>
          </div>
          {speciesQuery.data && (
            <p className="mt-1 text-slate-600 italic">
              {translateCategory(speciesQuery.data.genus)}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            {detail.types.map((t) => <TypeBadge key={t} type={t} size="lg" />)}
          </div>

          <div className="mt-5">
            {fullSpeech.length > 0 && (
              <SpeakButton text={fullSpeech} label={UI.listen} size="lg" />
            )}
          </div>
        </div>

        {/* Description */}
        {description && (
          <section className="p-6 sm:p-8 border-t border-slate-100">
            <p className="text-lg sm:text-xl leading-relaxed text-slate-700">
              {description}
            </p>
          </section>
        )}

        {/* Weaknesses */}
        <section className="p-6 sm:p-8 border-t border-slate-100">
          <h2 className="text-xl font-bold text-slate-800 mb-3">
            🛡️ {UI.weaknesses}
          </h2>
          <div className="flex flex-wrap gap-2">
            {weaknesses.length === 0 && <p className="text-slate-500">—</p>}
            {weaknesses.map((t) => <TypeBadge key={t} type={t} size="md" />)}
          </div>
        </section>

        {/* Advantages */}
        <section className="p-6 sm:p-8 border-t border-slate-100">
          <h2 className="text-xl font-bold text-slate-800 mb-3">
            ⚔️ {UI.advantages}
          </h2>
          <div className="flex flex-wrap gap-2">
            {advantages.length === 0 && <p className="text-slate-500">—</p>}
            {advantages.map((t) => <TypeBadge key={t} type={t} size="md" />)}
          </div>
        </section>

        {/* Animated sprite */}
        <AnimatedSprite id={detail.id} name={detail.name} shiny={shiny} />

        {/* Quick facts */}
        <section className="p-6 sm:p-8 border-t border-slate-100 space-y-4">
          <HeightComparison height={detail.height} name={detail.name} spriteUrl={detail.spriteUrl} />
          <WeightComparison weight={detail.weight} />
        </section>

        {/* Evolution */}
        <section className="p-6 sm:p-8 border-t border-slate-100">
          <h2 className="text-xl font-bold text-slate-800 mb-3">
            🌱 {UI.evolution}
          </h2>
          {chainQuery.isLoading && <p className="text-slate-500">{UI.loading}</p>}
          {chainQuery.data && (
            <EvolutionView
              prev={neighbors.prev}
              species={speciesNode}
              next={neighbors.next}
              megaForms={speciesQuery.data?.megaForms ?? []}
              currentId={detail.id}
            />
          )}
        </section>
      </div>
    </div>
  );
}

// Showdown animated sprite from PokéAPI/sprites — gracefully hides itself if
// the GIF doesn't exist (rare for newest Gen 9 entries).
function AnimatedSprite({ id, name, shiny }: { id: number; name: string; shiny: boolean }) {
  const [hiddenNormal, setHiddenNormal] = useState(false);
  const [hiddenShiny, setHiddenShiny] = useState(false);
  const hidden = shiny ? hiddenShiny : hiddenNormal;
  if (hidden) return null;
  return (
    <section className="p-6 sm:p-8 border-t border-slate-100">
      <h2 className="text-xl font-bold text-slate-800 mb-3">🎬 Em movimento</h2>
      <div className="flex justify-center">
        <div className="rounded-3xl bg-gradient-to-br from-slate-50 to-slate-100 p-8 sm:p-10 inline-flex items-center justify-center min-h-[160px]">
          <img
            key={shiny ? 'shiny' : 'normal'}
            src={shiny ? showdownSpriteShiny(id) : showdownSprite(id)}
            alt={name}
            className="pixelated h-32 sm:h-40 object-contain"
            style={{ imageRendering: 'pixelated' }}
            onError={() => shiny ? setHiddenShiny(true) : setHiddenNormal(true)}
          />
        </div>
      </div>
    </section>
  );
}

/** Scans the image via canvas and returns:
 *  - contentRatio: fraction of image height that contains non-transparent pixels
 *  - bottomPadFraction: fraction of image height that is transparent below the content
 *  Falls back to sensible defaults if the image is tainted or fails. */
function useImageCrop(src: string): { contentRatio: number; bottomPadFraction: number; topPadFraction: number } {
  const [crop, setCrop] = useState({ contentRatio: 0.85, bottomPadFraction: 0.05, topPadFraction: 0.10 });
  useEffect(() => {
    setCrop({ contentRatio: 0.85, bottomPadFraction: 0.05, topPadFraction: 0.10 });
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const W = img.naturalWidth;
        const H = img.naturalHeight;
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, W, H).data;
        let top = H, bottom = 0;
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            if (data[(y * W + x) * 4 + 3] > 10) {
              if (y < top) top = y;
              if (y > bottom) bottom = y;
            }
          }
        }
        if (bottom > top) {
          setCrop({
            contentRatio: (bottom - top + 1) / H,
            bottomPadFraction: (H - 1 - bottom) / H,
            topPadFraction: top / H,
          });
        }
      } catch {
        // keep defaults
      }
    };
    img.src = src;
  }, [src]);
  return crop;
}

function HeightComparison({ height, name, spriteUrl }: { height: number; name: string; spriteUrl: string }) {
  const ADULT_M = 1.7;
  const CHILD_M = 1.0;
  const pokemonM = height / 10;
  const maxM = Math.max(pokemonM, ADULT_M);
  const BAR_H = 140;

  const adultPx  = Math.max(Math.round((ADULT_M  / maxM) * BAR_H), 12);
  const childPx  = Math.max(Math.round((CHILD_M  / maxM) * BAR_H), 12);
  const pokemonPx = Math.max(Math.round((pokemonM / maxM) * BAR_H), 12);

  // Scale the image so the visible content equals pokemonPx,
  // then clip transparent padding with overflow:hidden, offset by bottomPad
  // so the content bottom sits flush with the container bottom.
  // displayImgPx: full image height so that the visible content = pokemonPx
  // topOffset: shift the image up so the content top is flush with the container top;
  //   combined with overflow:hidden on a pokemonPx-tall container this clips both
  //   transparent top and bottom pads, leaving only the Pokémon visible.
  const { contentRatio, topPadFraction } = useImageCrop(spriteUrl);
  const displayImgPx = Math.round(pokemonPx / contentRatio);
  const topOffset = Math.round(displayImgPx * topPadFraction);

  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="text-xs uppercase font-bold text-slate-500 mb-4">📏 {UI.height}</div>
      <div className="flex items-end justify-center gap-6" style={{ height: BAR_H }}>
        {/* Adult silhouette */}
        <div className="flex flex-col items-center justify-end gap-1">
          <svg
            viewBox="0 0 30 80"
            style={{ height: adultPx, width: 'auto', minWidth: 14 }}
            className="text-slate-400"
            fill="currentColor"
          >
            <circle cx="15" cy="7" r="6" />
            <path d="M6 18 Q6 14 15 14 Q24 14 24 18 L26 48 L20 48 L15 36 L10 48 L4 48 Z" />
            <path d="M6 20 L1 40 L6 41 L10 26" />
            <path d="M24 20 L29 40 L24 41 L20 26" />
            <path d="M10 48 L8 80 L13 80 L15 60 L17 80 L22 80 L20 48" />
          </svg>
          <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
            {ADULT_M.toFixed(1).replace('.', ',')} m
          </span>
        </div>
        {/* Child silhouette */}
        <div className="flex flex-col items-center justify-end gap-1">
          <svg
            viewBox="0 0 26 80"
            style={{ height: childPx, width: 'auto', minWidth: 12 }}
            className="text-slate-300"
            fill="currentColor"
          >
            <circle cx="13" cy="8" r="7" />
            <path d="M5 22 Q5 18 13 18 Q21 18 21 22 L23 50 L17 50 L13 40 L9 50 L3 50 Z" />
            <path d="M5 24 L1 42 L6 43 L9 30" />
            <path d="M21 24 L25 42 L20 43 L17 30" />
            <path d="M9 50 L7 80 L12 80 L13 65 L14 80 L19 80 L17 50" />
          </svg>
          <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
            {CHILD_M.toFixed(1).replace('.', ',')} m
          </span>
        </div>
        {/* Pokémon — negative marginTop clips top pad; overflow:hidden clips bottom pad */}
        <div className="flex flex-col items-center justify-end gap-1">
          <div style={{ height: pokemonPx, overflow: 'hidden' }}>
            <img
              src={spriteUrl}
              alt={name}
              style={{
                display: 'block',
                height: displayImgPx,
                width: 'auto',
                marginTop: -topOffset,
              }}
              className="drop-shadow"
            />
          </div>
          <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
            {pokemonM % 1 === 0
              ? `${pokemonM.toFixed(0)} m`
              : `${pokemonM.toFixed(1).replace('.', ',')} m`}
          </span>
        </div>
      </div>
    </div>
  );
}

const WEIGHT_REFS = [
  { emoji: '🍎', label: 'maçã',       labelPlural: 'maçãs',       article: 'uma', kg: 0.2    },
  { emoji: '🐱', label: 'gato',       labelPlural: 'gatos',       article: 'um',  kg: 4      },
  { emoji: '🐶', label: 'cão',        labelPlural: 'cães',        article: 'um',  kg: 30     },
  { emoji: '👨', label: 'pessoa',     labelPlural: 'pessoas',     article: 'uma', kg: 70     },
  { emoji: '🐻', label: 'urso',       labelPlural: 'ursos',       article: 'um',  kg: 250    },
  { emoji: '🐄', label: 'vaca',       labelPlural: 'vacas',       article: 'uma', kg: 500    },
  { emoji: '🚗', label: 'carro',      labelPlural: 'carros',      article: 'um',  kg: 1_500  },
  { emoji: '🐘', label: 'elefante',   labelPlural: 'elefantes',   article: 'um',  kg: 5_000  },
  { emoji: '🐋', label: 'baleia azul',labelPlural: 'baleias azuis',article: 'uma',kg: 150_000},
];

/** Greedy breakdown: repeatedly pick the largest reference that still fits,
 *  until the remaining weight is within 15% of the total or we hit 8 emojis. */
function buildWeightBreakdown(kg: number) {
  const refs = [...WEIGHT_REFS].sort((a, b) => b.kg - a.kg);
  const items: (typeof WEIGHT_REFS)[number][] = [];
  let remaining = kg;
  const tolerance = kg * 0.15;

  while (remaining > tolerance && items.length < 8) {
    const ref = refs.find(r => r.kg <= remaining);
    if (!ref) break;
    items.push(ref);
    remaining -= ref.kg;
  }

  // Pokémon lighter than the smallest reference — just show 1 apple.
  if (items.length === 0) items.push(refs[refs.length - 1]);

  return items;
}

function WeightComparison({ weight }: { weight: number }) {
  const kg = weight / 10;
  const items = buildWeightBreakdown(kg);
  const kgStr = kg % 1 === 0 ? `${kg.toFixed(0)} kg` : `${kg.toFixed(1).replace('.', ',')} kg`;

  // Compact legend for parents: unique refs with their weight.
  const seen = new Set<string>();
  const legend = items
    .filter(r => { if (seen.has(r.emoji)) return false; seen.add(r.emoji); return true; })
    .map(r => `${r.emoji} = ${r.kg >= 1000 ? `${r.kg / 1000} t` : `${r.kg} kg`}`)
    .join('  ');

  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="text-xs uppercase font-bold text-slate-500 mb-1">⚖️ {UI.weight}</div>
      <div className="text-center">
        <div className="text-2xl font-bold text-slate-800 mb-3">{kgStr}</div>
        <div className="flex flex-wrap gap-1 items-center justify-center">
          {items.map((ref, i) => (
            <span key={i} className="text-3xl leading-none">{ref.emoji}</span>
          ))}
        </div>
        <div className="text-xs text-slate-400 mt-2">{legend}</div>
      </div>
    </div>
  );
}


function EvolutionView({
  prev, species, next, megaForms, currentId,
}: {
  prev: EvolutionNode | null;
  species: EvolutionNode;
  next: EvolutionNode[];
  megaForms: MegaForm[];
  currentId: number;
}) {
  if (!prev && next.length === 0 && megaForms.length === 0) {
    return <p className="text-slate-500">{UI.noEvolution}</p>;
  }
  const branchCount = next.length + megaForms.length;
  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
      {prev && (
        <>
          <EvoCard node={prev} highlight={prev.id === currentId} />
          <Arrow />
        </>
      )}
      <EvoCard node={species} highlight={species.id === currentId} />
      {branchCount > 0 && (
        <>
          <Arrow />
          <div className={`grid ${branchCount > 1 ? 'grid-cols-2' : 'grid-cols-1'} sm:grid-cols-1 gap-2 justify-items-center`}>
            {next.map((n) => <EvoCard key={n.id} node={n} highlight={n.id === currentId} />)}
            {megaForms.map((m) => (
              <EvoCard key={m.id} mega={m} highlight={m.id === currentId} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Arrow() {
  return (
    <span
      className="text-3xl sm:text-4xl text-red-400 select-none animate-pulse"
      aria-hidden
    >
      <span className="sm:hidden">⬇</span>
      <span className="hidden sm:inline">➜</span>
    </span>
  );
}

function EvoCard({
  node, mega, highlight = false,
}: { node?: EvolutionNode; mega?: MegaForm; highlight?: boolean }) {
  const id = mega?.id ?? node?.id ?? 0;
  const name = capitalize(node?.name ?? mega?.name.replace(/-(mega|gmax).*$/, '') ?? '');
  const sprite = mega?.spriteUrl ?? node?.spriteUrl ?? '';
  const isGmax = mega?.label === 'Gigantamax';

  const badgeClass = isGmax
    ? 'bg-gradient-to-r from-red-500 to-orange-400'
    : 'bg-gradient-to-r from-purple-500 to-pink-500';
  const badgeIcon = isGmax ? '⚡' : '✨';

  const content = (
    <>
      {mega && (
        <span className={`absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full ${badgeClass} text-white text-[10px] font-bold tracking-wider shadow-md whitespace-nowrap`}>
          {badgeIcon} {mega.label}
        </span>
      )}
      <img src={sprite} alt={name} className="w-20 h-20 sm:w-24 sm:h-24 object-contain" />
      <div className="text-center">
        <div className="text-xs text-slate-500">#{String(id).padStart(4, '0')}</div>
        <div className="font-bold text-slate-800 text-sm sm:text-base">{name}</div>
      </div>
    </>
  );

  const baseClass = `relative flex flex-col items-center gap-1 rounded-2xl p-3 transition-all w-28 sm:w-32`;
  const specialTheme = isGmax
    ? 'bg-gradient-to-br from-red-50 to-orange-50 ring-2 ring-orange-200'
    : 'bg-gradient-to-br from-purple-50 to-pink-50 ring-2 ring-purple-200';

  if (highlight) {
    const ring = isGmax ? 'ring-4 ring-orange-400' : mega ? 'ring-4 ring-purple-400' : 'ring-4 ring-red-300';
    const bg = isGmax ? 'from-red-100 to-orange-100' : mega ? 'from-purple-100 to-pink-100' : 'from-red-100 to-yellow-100';
    return (
      <div className={`${baseClass} bg-gradient-to-br ${bg} ${ring} shadow-lg`}>
        {content}
      </div>
    );
  }
  return (
    <Link
      to={`/pokemon/${id}`}
      className={`${baseClass} ${mega ? specialTheme : 'bg-slate-50 hover:bg-red-50'} active:scale-95 shadow-sm hover:shadow-md`}
    >
      {content}
    </Link>
  );
}
