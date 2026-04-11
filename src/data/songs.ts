export interface SongDef {
  id: string;
  title: string;
  artist: string;
  roster: string;
  audio: string;
  cover: string;
  charts: { easy: string; hard: string };
}

export const SONGS: SongDef[] = [
  {
    id: 'serapic-magic',
    title: 'Serapic Magic',
    artist: '코롯, 하노코',
    roster: '0, 1',
    audio: 'assets/audio/serapic-magic.mp3',
    cover: 'assets/images/coverimg/serapic-magic.png',
    charts: {
      easy: 'assets/charts/serapic-magic_easy.json',
      hard: 'assets/charts/serapic-magic_hard.json',
    },
  },
];
