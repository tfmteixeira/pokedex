import type { PokemonType } from '../i18n/types';

const BASE = 'https://pokeapi.co/api/v2';

export interface PokemonListItem {
  id: number;
  name: string;
  spriteUrl: string;
  types: PokemonType[];
}

export interface PokemonDetail {
  id: number;
  name: string;
  spriteUrl: string;
  spriteUrlAnimated?: string;
  types: PokemonType[];
  height: number;
  weight: number;
  abilities: string[];
  stats: { name: string; value: number }[];
  speciesUrl: string;
}

export interface MegaForm {
  id: number;
  name: string;
  label: string; // e.g. "Mega", "Mega X", "Mega Y"
  spriteUrl: string;
}

export interface PokemonSpecies {
  id: number;
  name: string;
  genus: string;
  flavorTextEn: string;
  flavorTextEs: string;
  evolutionChainUrl: string;
  megaForms: MegaForm[];
}

export interface EvolutionNode {
  id: number;
  name: string;
  spriteUrl: string;
  evolvesTo: EvolutionNode[];
}

export const officialArtwork = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

export const showdownSprite = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${id}.gif`;

const homeSprite = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/${id}.png`;

async function fetchJson<T>(url: string, retries = 2): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        // Rate-limited — exponential backoff.
        await new Promise((r) => setTimeout(r, 500 * (i + 1) * (i + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as T;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  throw lastErr ?? new Error('fetch failed');
}

export async function fetchAllPokemonNames(): Promise<{ name: string; id: number }[]> {
  const data = await fetchJson<{ results: { name: string; url: string }[] }>(
    `${BASE}/pokemon?limit=10000`
  );
  return data.results
    .map((r) => {
      const idMatch = r.url.match(/\/pokemon\/(\d+)\//);
      return { name: r.name, id: idMatch ? Number(idMatch[1]) : 0 };
    })
    .filter((p) => p.id > 0 && p.id <= 1025);
}

interface RawSprites {
  front_default: string | null;
  other: {
    'official-artwork': { front_default: string | null };
    home: { front_default: string | null };
  };
}

interface RawPokemon {
  id: number;
  name: string;
  height: number;
  weight: number;
  types: { type: { name: PokemonType } }[];
  abilities: { ability: { name: string } }[];
  stats: { base_stat: number; stat: { name: string } }[];
  species: { url: string };
  sprites: RawSprites;
}

function formatDisplayName(name: string): string {
  return name.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

function bestSprite(sprites: RawSprites, id: number): string {
  return (
    sprites.other['official-artwork'].front_default ??
    sprites.other.home?.front_default ??
    sprites.front_default ??
    officialArtwork(id)
  );
}

export async function fetchPokemonListItem(id: number): Promise<PokemonListItem> {
  const data = await fetchJson<RawPokemon>(`${BASE}/pokemon/${id}`);
  return {
    id: data.id,
    name: formatDisplayName(data.name),
    spriteUrl: bestSprite(data.sprites, data.id),
    types: data.types.map((t) => t.type.name),
  };
}

export async function fetchSpecialForms(formType: 'mega' | 'gmax'): Promise<{ name: string; id: number }[]> {
  const data = await fetchJson<{ results: { name: string; url: string }[] }>(
    `${BASE}/pokemon?limit=10000`
  );
  // Anchor to end of string so we don't match unrelated names that happen to contain "mega"
  const pattern = formType === 'mega' ? /-mega(?:-[xy])?$/i : /-gmax$/i;
  return data.results
    .map((r) => {
      const idMatch = r.url.match(/\/pokemon\/(\d+)\//);
      return { name: r.name, id: idMatch ? Number(idMatch[1]) : 0 };
    })
    .filter((p) => p.id > 0 && pattern.test(p.name));
}

export async function fetchPokemonDetail(id: number | string): Promise<PokemonDetail> {
  const data = await fetchJson<RawPokemon>(`${BASE}/pokemon/${id}`);
  return {
    id: data.id,
    name: data.name,
    spriteUrl: officialArtwork(data.id),
    spriteUrlAnimated: homeSprite(data.id),
    types: data.types.map((t) => t.type.name),
    height: data.height,
    weight: data.weight,
    abilities: data.abilities.map((a) => a.ability.name),
    stats: data.stats.map((s) => ({ name: s.stat.name, value: s.base_stat })),
    speciesUrl: data.species.url,
  };
}

interface RawSpecies {
  id: number;
  name: string;
  genera: { genus: string; language: { name: string } }[];
  flavor_text_entries: { flavor_text: string; language: { name: string } }[];
  evolution_chain: { url: string };
  varieties: { is_default: boolean; pokemon: { name: string; url: string } }[];
}

function specialFormLabel(name: string): string | null {
  // Mega: must end with -mega, -mega-x, or -mega-y (anchored to avoid false matches)
  const megaMatch = name.match(/-mega(?:-([xy]))?$/i);
  if (megaMatch) return megaMatch[1] ? `Mega ${megaMatch[1].toUpperCase()}` : 'Mega';
  // Gigantamax: -gmax
  if (/-gmax$/i.test(name)) return 'Gigantamax';
  return null;
}

export async function fetchSpecies(speciesUrl: string): Promise<PokemonSpecies> {
  const data = await fetchJson<RawSpecies>(speciesUrl);
  const genus = data.genera.find((g) => g.language.name === 'en')?.genus ?? '';
  const cleanFlavor = (s: string | undefined) =>
    (s ?? '')
      .replace(/[\f\n\r\u00ad]/g, ' ')
      .replace(/POK[ÉéEe]MON/g, 'Pokémon')
      .replace(/\s+/g, ' ')
      .trim();
  const flavorTextEn = cleanFlavor(data.flavor_text_entries.find((f) => f.language.name === 'en')?.flavor_text);
  const flavorTextEs = cleanFlavor(data.flavor_text_entries.find((f) => f.language.name === 'es')?.flavor_text);

  const megaForms: MegaForm[] = data.varieties
    .map((v) => {
      const label = specialFormLabel(v.pokemon.name);
      if (!label) return null;
      const idMatch = v.pokemon.url.match(/\/pokemon\/(\d+)\//);
      const id = idMatch ? Number(idMatch[1]) : 0;
      return {
        id,
        name: v.pokemon.name,
        label,
        spriteUrl: officialArtwork(id),
      };
    })
    .filter((m): m is MegaForm => m !== null);

  return {
    id: data.id,
    name: data.name,
    genus,
    flavorTextEn,
    flavorTextEs,
    evolutionChainUrl: data.evolution_chain.url,
    megaForms,
  };
}

interface RawChainLink {
  species: { name: string; url: string };
  evolves_to: RawChainLink[];
}

function chainLinkToNode(link: RawChainLink): EvolutionNode {
  const idMatch = link.species.url.match(/\/pokemon-species\/(\d+)\//);
  const id = idMatch ? Number(idMatch[1]) : 0;
  return {
    id,
    name: link.species.name,
    spriteUrl: officialArtwork(id),
    evolvesTo: link.evolves_to.map(chainLinkToNode),
  };
}

export async function fetchEvolutionChain(url: string): Promise<EvolutionNode> {
  const data = await fetchJson<{ chain: RawChainLink }>(url);
  return chainLinkToNode(data.chain);
}

export function findEvolutionNeighbors(
  chain: EvolutionNode,
  targetId: number
): { prev: EvolutionNode | null; next: EvolutionNode[] } {
  function walk(
    node: EvolutionNode,
    parent: EvolutionNode | null
  ): { prev: EvolutionNode | null; next: EvolutionNode[] } | null {
    if (node.id === targetId) return { prev: parent, next: node.evolvesTo };
    for (const child of node.evolvesTo) {
      const found = walk(child, node);
      if (found) return found;
    }
    return null;
  }
  return walk(chain, null) ?? { prev: null, next: [] };
}
