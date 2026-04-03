import { InputManager, InputType } from '../core/InputManager';

export interface CharacterInfo {
  id: number;
  name: string;
  color: number;
  assetPrefix: string;
}

export const CHARACTERS: CharacterInfo[] = [
  { id: 0, name: '빕어', color: 0x888888, assetPrefix: 'bver' },
  { id: 1, name: '한세긴', color: 0x4abeff, assetPrefix: 'segin' },
  { id: 2, name: '송밤', color: 0xbec8fd, assetPrefix: 'songbam' },
  { id: 3, name: '나비', color: 0xec9a67, assetPrefix: 'navi' },
  { id: 4, name: '크앙희', color: 0xc292e8, assetPrefix: 'kanghee' },
];

export class CharacterManager {
  private roster: number[] = [0, 1, 2]; // 현재 곡에 설정된 캐릭터 ID 목록
  private currentIndex: number = 0;

  constructor() {}

  public init() {
    InputManager.getInstance().onInput((type) => {
      if (type === InputType.WHEEL_UP) {
        this.switchPrevious();
      } else if (type === InputType.WHEEL_DOWN) {
        this.switchNext();
      }
    });
    this.currentIndex = 0;
  }

  public setRoster(roster: number[]) {
    this.roster = roster.length > 0 ? roster : [0];
    this.currentIndex = 0;
  }

  public setInitialCharacter(characterId: number) {
    const idx = this.roster.indexOf(characterId);
    if (idx !== -1) {
      this.currentIndex = idx;
    }
  }

  public getActiveCharacterId(): number {
    return this.roster[this.currentIndex];
  }

  public getActiveCharacter(): CharacterInfo {
    const id = this.getActiveCharacterId();
    return CHARACTERS.find(c => c.id === id) || CHARACTERS[0];
  }

  public getActiveIndex(): number {
    return this.currentIndex;
  }

  public getRosterCount(): number {
    return this.roster.length;
  }

  private switchNext() {
    this.currentIndex = (this.currentIndex + 1) % this.roster.length;
  }

  private switchPrevious() {
    this.currentIndex = (this.currentIndex - 1 + this.roster.length) % this.roster.length;
  }
}
