export interface ChartMetadata {
  title: string;
  artist: string;
  bpm: number;
  offset: number;
  roster: number[];
}

export interface NoteData {
  time: number;
  lane: 0 | 1 | 'any';
  type: 'normal' | 'switch_up' | 'switch_down' | 'long'; // 'long' 타입 추가
  duration?: number; // 롱노트 길이 (ms)
  characterId?: number;
  targetCharId?: number;
}

export interface ChartData {
  meta: ChartMetadata;
  notes: NoteData[];
}

export class ChartLoader {
  public static async load(url: string): Promise<ChartData> {
    const response = await fetch(url);
    return await response.json();
  }
}
