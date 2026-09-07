/**
 * Environments. One art style everywhere (thick outlines, chunky shapes);
 * each theme changes the floor, the pipes, the palette and the set of
 * decorative props drawn around the playable area. Gameplay objects are
 * drawn the same in every theme.
 */

export type FloorKind =
  | 'tile'
  | 'bigTile'
  | 'marble'
  | 'checker'
  | 'terrazzo'
  | 'plastic'
  | 'cobble'
  | 'metalGrid'
  | 'crackedTile'
  | 'bamboo'
  | 'floralCarpet'
  | 'stripes';

export type PipeStyle = 'plain' | 'bands' | 'tape' | 'knit' | 'neon' | 'bamboo' | 'gold' | 'chrome';

export type PropKind =
  | 'sink'
  | 'stain'
  | 'bolt'
  | 'mopBucket'
  | 'wrench'
  | 'outOfOrder'
  | 'towel'
  | 'orchid'
  | 'goldTap'
  | 'sticker'
  | 'graffiti'
  | 'bottle'
  | 'neonSign'
  | 'stallDoor'
  | 'suitcase'
  | 'gateSign'
  | 'hardHat'
  | 'cone'
  | 'hammer'
  | 'torch'
  | 'shield'
  | 'chain'
  | 'star'
  | 'planet'
  | 'droplet'
  | 'ghostRoll'
  | 'crackedMirror'
  | 'cobweb'
  | 'palm'
  | 'hibiscus'
  | 'waterfall'
  | 'washSign'
  | 'dispenser'
  | 'sensor'
  | 'potpourri'
  | 'doily'
  | 'knitCover'
  | 'crowd'
  | 'pennant'
  | 'foamFinger'
  | 'sinkPuddle';

export type DecalKind = 'stain' | 'crack' | 'petal' | 'confetti' | 'leaf' | 'scuff' | 'sparkle';

export interface Theme {
  id: string;
  name: string;
  /** Short flavour line shown in the HUD. */
  tagline: string;
  /** Outside the bounds rectangle. */
  page: string;
  /** Out-of-play area inside the bounds. */
  surround: string;
  surroundB: string;
  floor: { kind: FloorKind; a: string; b: string; grout: string };
  pipe: { fill: string; highlight: string; shade: string; style: PipeStyle; alt?: string };
  accent: string;
  props: PropKind[];
  propDensity: number;
  decals: DecalKind[];
  decalDensity: number;
}

export const OUTLINE = '#1f2a44';

export const THEMES: Theme[] = [
  {
    id: 'gasStation',
    name: 'Gas Station',
    tagline: 'stained tile, rusty pipes',
    page: '#1d2a1e',
    surround: '#2f4a33',
    surroundB: '#294029',
    floor: { kind: 'tile', a: '#a0d0be', b: '#7db9a5', grout: '#4d7976' },
    pipe: { fill: '#c47a3a', highlight: '#f0b070', shade: '#8a4f22', style: 'bands' },
    accent: '#ffd166',
    props: ['sink', 'mopBucket', 'bolt', 'wrench', 'outOfOrder'],
    propDensity: 0.9,
    decals: ['stain', 'scuff'],
    decalDensity: 0.6,
  },
  {
    id: 'luxuryHotel',
    name: 'Luxury Hotel',
    tagline: 'marble, gold, fluffy towels',
    page: '#2b2a3a',
    surround: '#d9cfc0',
    surroundB: '#cbbfae',
    floor: { kind: 'marble', a: '#eee5d2', b: '#cdbfa3', grout: '#a18a61' },
    pipe: { fill: '#f0c04a', highlight: '#fff0a8', shade: '#b8861b', style: 'gold' },
    accent: '#f0c04a',
    props: ['sink', 'towel', 'orchid', 'goldTap'],
    propDensity: 0.6,
    decals: ['sparkle'],
    decalDensity: 0.2,
  },
  {
    id: 'diveBar',
    name: 'Dive Bar',
    tagline: 'graffiti, stickers, flickering neon',
    page: '#14101c',
    surround: '#2a2036',
    surroundB: '#221a2e',
    floor: { kind: 'checker', a: '#574966', b: '#302c47', grout: '#78698b' },
    pipe: { fill: '#ff3fa4', highlight: '#ffb3dd', shade: '#a8146a', style: 'neon' },
    accent: '#ff3fa4',
    props: ['graffiti', 'sticker', 'bottle', 'neonSign', 'sticker'],
    propDensity: 1.0,
    decals: ['confetti', 'scuff'],
    decalDensity: 0.5,
  },
  {
    id: 'airport',
    name: 'Airport',
    tagline: 'endless stalls, runaway luggage',
    page: '#1e2530',
    surround: '#a9b4bf',
    surroundB: '#9ba6b1',
    floor: { kind: 'terrazzo', a: '#b8cbd4', b: '#91aebc', grout: '#64899b' },
    pipe: { fill: '#a8b8c6', highlight: '#e6eef4', shade: '#6f7f8c', style: 'chrome' },
    accent: '#3a86ff',
    props: ['sink', 'stallDoor', 'suitcase', 'gateSign'],
    propDensity: 0.8,
    decals: ['scuff'],
    decalDensity: 0.2,
  },
  {
    id: 'portaPotty',
    name: 'Porta-Potty',
    tagline: 'tools, caution tape, questionable smells',
    page: '#2a2410',
    surround: '#3d6a9a',
    surroundB: '#345d88',
    floor: { kind: 'plastic', a: '#3d9baf', b: '#287f98', grout: '#1b586e' },
    pipe: { fill: '#ffd60a', highlight: '#fff3a0', shade: '#b39300', style: 'tape', alt: '#1f2a44' },
    accent: '#ffd60a',
    props: ['hardHat', 'cone', 'hammer', 'wrench'],
    propDensity: 0.8,
    decals: ['scuff', 'stain'],
    decalDensity: 0.4,
  },
  {
    id: 'castle',
    name: 'Castle',
    tagline: 'stone walls, wooden plumbing',
    page: '#1b1a22',
    surround: '#6b6a72',
    surroundB: '#5c5b64',
    floor: { kind: 'cobble', a: '#a4a79c', b: '#7c8b86', grout: '#415d60' },
    pipe: { fill: '#9a6134', highlight: '#c98d5a', shade: '#5f3a1c', style: 'bands', alt: '#4a4a52' },
    accent: '#e0a458',
    props: ['torch', 'shield', 'chain', 'cobweb'],
    propDensity: 0.7,
    decals: ['crack'],
    decalDensity: 0.4,
  },
  {
    id: 'spaceship',
    name: 'Spaceship',
    tagline: 'zero-g water blobs',
    page: '#070b1a',
    surround: '#0d1430',
    surroundB: '#0a1028',
    floor: { kind: 'metalGrid', a: '#294b64', b: '#203a55', grout: '#47a5b9' },
    pipe: { fill: '#8fc9ff', highlight: '#e6f6ff', shade: '#3f7fc0', style: 'chrome' },
    accent: '#7fd6ff',
    props: ['star', 'planet', 'droplet', 'star', 'star'],
    propDensity: 1.2,
    decals: ['sparkle'],
    decalDensity: 0.3,
  },
  {
    id: 'haunted',
    name: 'Haunted',
    tagline: 'cracked mirrors, ghostly toilet paper',
    page: '#0e0b16',
    surround: '#2a2438',
    surroundB: '#231e30',
    floor: { kind: 'crackedTile', a: '#697e7c', b: '#4d5e6b', grout: '#28354f' },
    pipe: { fill: '#6d6d85', highlight: '#a9a9c4', shade: '#3e3e52', style: 'plain' },
    accent: '#b388ff',
    props: ['ghostRoll', 'crackedMirror', 'cobweb', 'cobweb'],
    propDensity: 0.8,
    decals: ['crack'],
    decalDensity: 0.6,
  },
  {
    id: 'tropical',
    name: 'Tropical Resort',
    tagline: 'bamboo, plants, waterfalls',
    page: '#153a2e',
    surround: '#2f8f5b',
    surroundB: '#27804f',
    floor: { kind: 'bamboo', a: '#dcbf82', b: '#bf9d61', grout: '#8b713f' },
    pipe: { fill: '#8cc663', highlight: '#c8ee9c', shade: '#4f8a33', style: 'bamboo' },
    accent: '#ff7f50',
    props: ['palm', 'hibiscus', 'waterfall', 'palm'],
    propDensity: 0.9,
    decals: ['leaf', 'petal'],
    decalDensity: 0.5,
  },
  {
    id: 'office',
    name: 'Corporate Office',
    tagline: 'pristine grey, everything automatic',
    page: '#1a1f26',
    surround: '#b8bec6',
    surroundB: '#aab1b9',
    floor: { kind: 'bigTile', a: '#bad3ce', b: '#98b8b5', grout: '#dfeae4' },
    pipe: { fill: '#eef2f5', highlight: '#ffffff', shade: '#aab4bd', style: 'plain' },
    accent: '#5be3a3',
    props: ['sink', 'washSign', 'dispenser', 'sensor'],
    propDensity: 0.6,
    decals: [],
    decalDensity: 0,
  },
  {
    id: 'grandma',
    name: "Grandma's",
    tagline: 'carpet, knitted covers, potpourri',
    page: '#3a2430',
    surround: '#d8a9b8',
    surroundB: '#cc9dad',
    floor: { kind: 'floralCarpet', a: '#c9a2b1', b: '#b8859e', grout: '#9c688c' },
    pipe: { fill: '#f28cae', highlight: '#ffd6e4', shade: '#b8547b', style: 'knit', alt: '#9ad0c2' },
    accent: '#f28cae',
    props: ['potpourri', 'doily', 'knitCover', 'doily'],
    propDensity: 0.7,
    decals: ['petal'],
    decalDensity: 0.5,
  },
  {
    id: 'stadium',
    name: 'Stadium',
    tagline: 'wet floors, crowds, overflowing sinks',
    page: '#132417',
    surround: '#2c6a3c',
    surroundB: '#255c34',
    floor: { kind: 'stripes', a: '#429957', b: '#36834a', grout: '#bde5b3' },
    pipe: { fill: '#9fb0bd', highlight: '#e4ecf2', shade: '#5e6e7c', style: 'chrome' },
    accent: '#ffd166',
    props: ['sink', 'crowd', 'pennant', 'sinkPuddle'],
    propDensity: 0.9,
    decals: ['confetti', 'stain'],
    decalDensity: 0.5,
  },
];

export const DEFAULT_THEME_ID = 'gasStation';

export function themeById(id: string | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
