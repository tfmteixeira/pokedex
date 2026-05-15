import { Link } from 'react-router-dom';
import type { PokemonListItem } from '../api/pokeapi';
import { TypeBadge } from './TypeBadge';
import { capitalize } from '../i18n/description';

interface Props {
  pokemon: PokemonListItem;
}

export function PokemonCard({ pokemon }: Props) {
  return (
    <Link
      to={`/pokemon/${pokemon.id}`}
      className="group flex flex-col items-center rounded-3xl bg-white/80 backdrop-blur p-3 shadow-md hover:shadow-xl hover:-translate-y-1 active:scale-95 transition-all border-2 border-transparent hover:border-red-300 focus:outline-none focus:ring-4 focus:ring-red-200"
    >
      <div className="relative w-full aspect-square rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
        <span className="absolute top-2 left-2 text-xs font-bold text-slate-400">
          #{String(pokemon.id).padStart(4, '0')}
        </span>
        <img
          src={pokemon.spriteUrl}
          alt={pokemon.name}
          loading="lazy"
          className="w-full h-full object-contain p-2 group-hover:scale-110 transition-transform duration-300"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src =
              `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png`;
            (e.currentTarget as HTMLImageElement).classList.add('pixelated');
          }}
        />
      </div>
      <h3 className="mt-2 text-lg font-bold text-slate-800 text-center">
        {capitalize(pokemon.name)}
      </h3>
      <div className="mt-1 flex flex-wrap gap-1 justify-center">
        {pokemon.types.map((t) => (
          <TypeBadge key={t} type={t} size="sm" />
        ))}
      </div>
    </Link>
  );
}
