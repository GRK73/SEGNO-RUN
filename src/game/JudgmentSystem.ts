import { InputManager, InputType } from '../core/InputManager';
import { AudioManager } from '../core/AudioManager';
import { CharacterManager } from './CharacterManager';
import { NoteManager } from './NoteManager';
import type { NoteData } from './ChartLoader';

export const Judgment = {
  PERFECT: 'PERFECT',
  GREAT: 'GREAT',
  MISS: 'MISS',
} as const;

export type Judgment = typeof Judgment[keyof typeof Judgment];

export class JudgmentSystem {
  private static readonly WINDOWS = {
    PERFECT: 50,
    GREAT: 130,
  };

  private combo: number = 0;
  private keyboardHoldNoteId: string | null = null;
  private mouseHoldNoteId: string | null = null;
  private lastTickTime: { keyboard: number, mouse: number } = { keyboard: 0, mouse: 0 };
  private characterManager: CharacterManager;
  private audioManager: AudioManager;
  private noteManager: NoteManager;

  public onJudgment: ((lane: number | string, judgment: Judgment, noteType?: string) => void) | null = null;
  public onHoldStart: ((lane: number) => void) | null = null;
  public onHoldEnd: ((lane: number) => void) | null = null;

  constructor(
    characterManager: CharacterManager,
    audioManager: AudioManager,
    noteManager: NoteManager
  ) {
    this.characterManager = characterManager;
    this.audioManager = audioManager;
    this.noteManager = noteManager;
    InputManager.getInstance().onInput(this.handleInput);
  }

  public stats = {
    perfect: 0,
    great: 0,
    miss: 0,
    maxCombo: 0,
    totalDeviation: 0,
    totalHits: 0
  };

  private recordJudgment(judgment: Judgment, diff: number = 0) {
    if (judgment === Judgment.PERFECT) {
      this.stats.perfect++;
      this.stats.totalHits++;
      this.stats.totalDeviation += Math.abs(diff);
    } else if (judgment === Judgment.GREAT) {
      this.stats.great++;
      this.stats.totalHits++;
      this.stats.totalDeviation += Math.abs(diff);
    } else if (judgment === Judgment.MISS) {
      this.stats.miss++;
      this.stats.totalHits++;
      this.stats.totalDeviation += 150; // Use 150ms penalty for miss
    }
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
  }

  public update() {
    const currentTime = this.audioManager.getCurrentTimeMS();
    const activeNotes = this.noteManager.getActiveNotes();

    // 1. 롱노트 홀딩 중 오토 컴플리트 및 틱 처리
    const processHold = (holdId: string | null, type: 'keyboard' | 'mouse') => {
      if (!holdId) return;
      
      const holdNoteIndex = activeNotes.findIndex(n => n.id === holdId);
      if (holdNoteIndex !== -1) {
        const note = activeNotes[holdNoteIndex].data;
        const endTime = note.time + (note.duration || 0);

        // 틱 처리 (100ms 마다 콤보 증가)
        if (currentTime - this.lastTickTime[type] >= 100) {
          this.combo++;
          this.lastTickTime[type] = currentTime;
        }

        // 끝 시간이 지나면 자동 완료
        if (currentTime >= endTime) {
          console.log(`Hold Complete (Auto)! Combo: ${this.combo}`);
          this.noteManager.explodeNote(holdNoteIndex, false);
          if (type === 'keyboard') {
             this.keyboardHoldNoteId = null;
             if (this.onJudgment) this.onJudgment(1, Judgment.PERFECT, 'long');
             if (this.onHoldEnd) this.onHoldEnd(1);
          } else {
             this.mouseHoldNoteId = null;
             if (this.onJudgment) this.onJudgment(0, Judgment.PERFECT, 'long');
             if (this.onHoldEnd) this.onHoldEnd(0);
          }
        }
      } else {
        // 노트를 찾을 수 없으면 (이미 제거됨) 초기화
        if (type === 'keyboard') this.keyboardHoldNoteId = null;
        else this.mouseHoldNoteId = null;
      }
    };

    processHold(this.keyboardHoldNoteId, 'keyboard');
    processHold(this.mouseHoldNoteId, 'mouse');

    // 2. 놓친 노트 MISS 처리
    for (let i = activeNotes.length - 1; i >= 0; i--) {
      const { data, isHolding } = activeNotes[i];
      if (isHolding) continue;

      const diff = currentTime - data.time;
      // 판정 범위를 완전히 벗어나면 MISS
      if (diff > JudgmentSystem.WINDOWS.GREAT) {
        console.log(`MISS! (Timed out)`);
        this.combo = 0;
        this.noteManager.explodeNote(i, true);
        this.recordJudgment(Judgment.MISS, diff);
        if (this.onJudgment) this.onJudgment(data.lane, Judgment.MISS, data.type);
      }
    }
  }

  private handleInput = (type: InputType) => {
    const currentTime = this.audioManager.getCurrentTimeMS();
    const activeNotes = this.noteManager.getActiveNotes();
    
    // 롱노트 떼기 판정
    const isKeyboardRelease = type === InputType.KEYBOARD_UP;
    const isMouseRelease = type === InputType.MOUSE_UP;

    if (isKeyboardRelease || isMouseRelease) {
      const targetHoldId: string | null = isKeyboardRelease ? this.keyboardHoldNoteId : this.mouseHoldNoteId;
      
      if (targetHoldId) {
        const holdNoteIndex = activeNotes.findIndex(n => n.id === targetHoldId);
        if (holdNoteIndex !== -1) {
          const note = activeNotes[holdNoteIndex].data;
          const endTime = note.time + (note.duration || 0);
          const diff = Math.abs(endTime - currentTime);
          
          if (diff <= JudgmentSystem.WINDOWS.GREAT) {
            console.log(`Hold Release Perfect! Combo: ${this.combo}`);
            this.noteManager.explodeNote(holdNoteIndex, false);
            if (this.onJudgment) this.onJudgment(note.lane, Judgment.PERFECT, note.type);
            if (this.onHoldEnd) this.onHoldEnd(note.lane as number);
          } else {
            console.log(`Hold Released Early! MISS`);
            this.combo = 0;
            this.noteManager.explodeNote(holdNoteIndex, true);
            if (this.onJudgment) this.onJudgment(note.lane, Judgment.MISS, note.type);
            if (this.onHoldEnd) this.onHoldEnd(note.lane as number);
          }
        }
        if (isKeyboardRelease) this.keyboardHoldNoteId = null;
        if (isMouseRelease) this.mouseHoldNoteId = null;
      }
      return;
    }

    // 노트 누르기 판정
    let bestNoteIndex = -1;
    let minDiff = Infinity;

    for (let i = 0; i < activeNotes.length; i++) {
      const { data, isHolding } = activeNotes[i];
      if (isHolding) continue; // 이미 누르고 있는 노트는 패스

      const diff = Math.abs(data.time - currentTime);
      if (diff > JudgmentSystem.WINDOWS.GREAT) continue;

      let inputMatches = false;
      if (data.type === 'normal' || data.type === 'long') {
        if (data.lane === 1 && type === InputType.KEYBOARD_ANY) inputMatches = true;
        if (data.lane === 0 && type === InputType.MOUSE_CLICK) inputMatches = true;
      } else if (data.type === 'switch_up') {
        if (type === InputType.WHEEL_UP) inputMatches = true;
      } else if (data.type === 'switch_down') {
        if (type === InputType.WHEEL_DOWN) inputMatches = true;
      }

      if (inputMatches && diff < minDiff) {
        minDiff = diff;
        bestNoteIndex = i;
      }
    }

    if (bestNoteIndex !== -1) {
      const note = activeNotes[bestNoteIndex].data;
      const judgment = this.judge(note, currentTime);
      
      if (judgment !== Judgment.MISS) {
        if (note.type === 'long') {
          console.log(`Hold Start!`);
          if (note.lane === 1) {
            this.keyboardHoldNoteId = activeNotes[bestNoteIndex].id;
            this.lastTickTime.keyboard = currentTime;
          } else if (note.lane === 0) {
            this.mouseHoldNoteId = activeNotes[bestNoteIndex].id;
            this.lastTickTime.mouse = currentTime;
          }
          this.noteManager.setHolding(bestNoteIndex, true);
          this.combo++;
          this.recordJudgment(judgment, minDiff);
          if (this.onJudgment) this.onJudgment(note.lane, judgment, note.type);
          if (this.onHoldStart) this.onHoldStart(note.lane as number);
        } else {
          this.combo++;
          this.noteManager.explodeNote(bestNoteIndex, false);
          this.recordJudgment(judgment, minDiff);
          if (this.onJudgment) this.onJudgment(note.lane, judgment, note.type);
        }
      } else {
        console.log(`MISS! (Bad timing/Character)`);
        this.combo = 0;
        this.noteManager.explodeNote(bestNoteIndex, true);
        this.recordJudgment(Judgment.MISS, minDiff);
        if (this.onJudgment) this.onJudgment(note.lane, Judgment.MISS, note.type);
      }
    } else {
      // Nothing was hit, but a key was pressed (Swing)
      // Removed swing sound to avoid delay issues
    }
  };

  public judge(note: NoteData, hitTime: number): Judgment {
    const diff = Math.abs(note.time - hitTime);
    
    // 캐릭터 일치 여부 확인 (캐릭터 속성이 있는 노트만)
    if (note.characterId !== undefined) {
      if (note.characterId !== this.characterManager.getActiveCharacterId()) {
        return Judgment.MISS;
      }
    }

    if (diff <= JudgmentSystem.WINDOWS.PERFECT) return Judgment.PERFECT;
    if (diff <= JudgmentSystem.WINDOWS.GREAT) return Judgment.GREAT;
    return Judgment.MISS;
  }

  public getCombo() {
    return this.combo;
  }
}
