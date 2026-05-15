export interface Region {
  key: string;
  name: string;
  generation: string;
  range: [number, number];
  emoji: string;
}

export const REGIONS: Region[] = [
  { key: 'kanto',   name: 'Kanto',   generation: 'I',   range: [1, 151],     emoji: '🗻' },
  { key: 'johto',   name: 'Johto',   generation: 'II',  range: [152, 251],   emoji: '🌸' },
  { key: 'hoenn',   name: 'Hoenn',   generation: 'III', range: [252, 386],   emoji: '🏝️' },
  { key: 'sinnoh',  name: 'Sinnoh',  generation: 'IV',  range: [387, 493],   emoji: '❄️' },
  { key: 'unova',   name: 'Unova',   generation: 'V',   range: [494, 649],   emoji: '🌃' },
  { key: 'kalos',   name: 'Kalos',   generation: 'VI',  range: [650, 721],   emoji: '🗼' },
  { key: 'alola',   name: 'Alola',   generation: 'VII', range: [722, 809],   emoji: '🌺' },
  { key: 'galar',   name: 'Galar',   generation: 'VIII',range: [810, 905],   emoji: '🏰' },
  { key: 'paldea',  name: 'Paldea',  generation: 'IX',  range: [906, 1025],  emoji: '🌅' },
];
