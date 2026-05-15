import type { PokemonDetail, PokemonSpecies } from '../api/pokeapi';
import { TYPE_PT } from './types';
import { translateCategory } from './stats';
import { FLAVOR_PT } from './flavorPt';

/**
 * Returns the manual PT translation for a species id, or null if missing.
 */
export function getManualFlavor(speciesId: number): string | null {
  return FLAVOR_PT[speciesId] ?? null;
}

/**
 * Builds a polished PT-PT description from PokéAPI structured data, used as
 * fallback when no manual translation exists for the species.
 */
export function buildDescription(
  detail: PokemonDetail,
  species: PokemonSpecies
): string {
  const name = capitalize(detail.name);
  const typeNames = detail.types.map((t) => TYPE_PT[t]);
  const typesPhrase =
    typeNames.length === 1
      ? `do tipo ${typeNames[0]}`
      : `dos tipos ${typeNames[0]} e ${typeNames[1]}`;
  const category = translateCategory(species.genus);
  const heightM = (detail.height / 10).toFixed(1).replace('.', ',');
  const weightKg = (detail.weight / 10).toFixed(1).replace('.', ',');

  return [
    `O ${name} é um Pokémon ${typesPhrase}, conhecido como o ${category}.`,
    `Mede cerca de ${heightM} metros e pesa ${weightKg} quilos.`,
  ].join(' ');
}

export function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ');
}
