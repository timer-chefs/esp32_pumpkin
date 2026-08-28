export interface PresetShow {
  id: number;
  name: string;
  file: string;
}

export const presetShows: readonly PresetShow[] = [
  {
    id: 0,
    name: "Candle",
    file: "ghost.wav",
  },
  {
    id: 1,
    name: "Ghost",
    file: "ghost.wav",
  },
];
