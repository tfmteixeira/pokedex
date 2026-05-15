import type { PokemonType } from '../i18n/types';
import { TYPE_PT } from '../i18n/types';

const TYPE_BG: Record<PokemonType, string> = {
  normal: 'bg-type-normal', fire: 'bg-type-fire', water: 'bg-type-water',
  electric: 'bg-type-electric', grass: 'bg-type-grass', ice: 'bg-type-ice',
  fighting: 'bg-type-fighting', poison: 'bg-type-poison', ground: 'bg-type-ground',
  flying: 'bg-type-flying', psychic: 'bg-type-psychic', bug: 'bg-type-bug',
  rock: 'bg-type-rock', ghost: 'bg-type-ghost', dragon: 'bg-type-dragon',
  dark: 'bg-type-dark', steel: 'bg-type-steel', fairy: 'bg-type-fairy',
};

const ICON: Record<PokemonType, string> = {
  normal: '/types/Pokemon_Type_Icon_Normal.svg',
  fire: '/types/Pokemon_Type_Icon_Fire.svg',
  water: '/types/Pokemon_Type_Icon_Water.svg',
  electric: '/types/Pokemon_Type_Icon_Electric.svg',
  grass: '/types/Pokemon_Type_Icon_Grass.svg',
  ice: '/types/Pokemon_Type_Icon_Ice.svg',
  fighting: '/types/Pokemon_Type_Icon_Fighting.svg',
  poison: '/types/Pokemon_Type_Icon_Poison.svg',
  ground: '/types/Pokemon_Type_Icon_Ground.svg',
  flying: '/types/Pokemon_Type_Icon_Flying.svg',
  psychic: '/types/Pokemon_Type_Icon_Psychic.svg',
  bug: '/types/Pokemon_Type_Icon_Bug.svg',
  rock: '/types/Pokemon_Type_Icon_Rock.svg',
  ghost: '/types/Pokemon_Type_Icon_Ghost.svg',
  dragon: '/types/Pokemon_Type_Icon_Dragon.svg',
  dark: '/types/Pokemon_Type_Icon_Dark.svg',
  steel: '/types/Pokemon_Type_Icon_Steel.svg',
  fairy: '/types/Pokemon_Type_Icon_Fairy.svg',
};

interface Props {
  type: PokemonType;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASS = {
  sm: { wrap: 'text-xs pl-0.5 pr-2 py-0.5 gap-1', icon: 'w-4 h-4' },
  md: { wrap: 'text-sm pl-1 pr-3 py-1 gap-1.5', icon: 'w-5 h-5' },
  lg: { wrap: 'text-base pl-1.5 pr-4 py-1.5 gap-2', icon: 'w-7 h-7' },
};

export function TypeBadge({ type, size = 'md' }: Props) {
  const s = SIZE_CLASS[size];
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold text-white shadow-sm ${TYPE_BG[type]} ${s.wrap}`}
    >
      <img
        src={ICON[type]}
        alt=""
        aria-hidden
        className={`${s.icon} drop-shadow`}
      />
      <span>{TYPE_PT[type]}</span>
    </span>
  );
}
