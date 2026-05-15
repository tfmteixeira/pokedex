export const STAT_PT: Record<string, string> = {
  'hp': 'Vida',
  'attack': 'Ataque',
  'defense': 'Defesa',
  'special-attack': 'Ataque Especial',
  'special-defense': 'Defesa Especial',
  'speed': 'Velocidade',
};

// Translate Pokémon "category" (genus) — e.g. "Mouse Pokémon" → "Pokémon Rato"
const CATEGORY_WORDS: Record<string, string> = {
  mouse: 'Rato', flame: 'Chama', lizard: 'Lagarto', flying: 'Voador',
  seed: 'Semente', tiny: 'Minúsculo', butterfly: 'Borboleta',
  poison: 'Veneno', bee: 'Abelha', sparrow: 'Pardal', snake: 'Cobra',
  fish: 'Peixe', balloon: 'Balão', sleeping: 'Adormecido',
  fairy: 'Fada', dragon: 'Dragão', shellfish: 'Marisco',
  rock: 'Pedra', water: 'Água', fire: 'Fogo', grass: 'Erva',
  electric: 'Elétrico', psychic: 'Psíquico', ghost: 'Fantasma',
  ice: 'Gelo', bug: 'Inseto', bird: 'Pássaro', wolf: 'Lobo',
  cat: 'Gato', dog: 'Cão', frog: 'Sapo', turtle: 'Tartaruga',
  bear: 'Urso', fox: 'Raposa', rabbit: 'Coelho', dolphin: 'Golfinho',
  whale: 'Baleia', shark: 'Tubarão', spider: 'Aranha', scorpion: 'Escorpião',
  evolution: 'Evolução', seabird: 'Ave Marinha', tadpole: 'Girino',
  pig: 'Porco', mole: 'Toupeira', bat: 'Morcego', cocoon: 'Casulo',
};

export function translateCategory(genus: string): string {
  // genus comes like "Mouse Pokémon"
  const cleaned = genus.replace(/Pokémon/i, '').trim().toLowerCase();
  for (const [en, pt] of Object.entries(CATEGORY_WORDS)) {
    if (cleaned.includes(en)) return `Pokémon ${pt}`;
  }
  return 'Pokémon'; // Fallback
}
