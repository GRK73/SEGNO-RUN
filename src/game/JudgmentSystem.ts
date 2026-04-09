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
  private static readonly WINDOWS = { PERFECT: 50, GREAT: 130 };
  private static readonly SCORE_PERFECT = 300;
  private static readonly SCORE_GREAT = 200;
  private static readonly FEVER_FILL_PERFECT = 0.04; // 25 perfects to fill
  private static readonly FEVER_FILL_GREAT = 0.025;
  private static readonly FEVER_DURATION = 8000; // ms

  private holdTickInterval: number = 250; // half-beat at 120bpm

  private combo: number = 0;
  private keyboardHoldNoteId: string | null = null;
  private mouseHoldNoteId: string | null = null;
  private lastTickTime: { keyboard: number, mouse: number } = { keyboard: 0, mouse: 0 };
  private characterManager: CharacterManager;
  private audioManager: AudioManager;
  private noteManager: NoteManager;

  public feverGauge: number = 0;
  public feverActive: boolean = false;
  private feverStartTime: number = -1;

  public onJudgment: ((lane: number | string, judgment: Judgment, noteType?: string) => void) | null = null;
  public onHoldStart: ((lane: number) => void) | null = null;
  public onHoldEnd: ((lane: number) => void) | null = null;
  public onFeverStart: (() => void) | null = null;
  public onFeverEnd: (() => void) | null = null;

  constructor(characterManager: CharacterManager, audioManager: AudioManager, noteManager: NoteManager) {
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
    totalHits: 0,
    totalScore: 0,
  };

  public setBpm(bpm: number) {
    this.holdTickInterval = 60000 / bpm / 2;
  }

  private getScoreMultiplier(): number {
    return this.feverActive ? 1.5 : 1.0;
  }

  private addFeverGauge(amount: number) {
    if (this.feverActive) return;
    this.feverGauge = Math.min(1, this.feverGauge + amount);
    if (this.feverGauge >= 1) this.startFever();
  }

  private startFever() {
    this.feverActive = true;
    this.feverStartTime = performance.now();
    this.feverGauge = 0;
    if (this.onFeverStart) this.onFeverStart();
  }

  private recordJudgment(judgment: Judgment, diff: number = 0) {
    const mul = this.getScoreMultiplier();
    if (judgment === Judgment.PERFECT) {
      this.stats.perfect++;
      this.stats.totalHits++;
      this.stats.totalDeviation += Math.abs(diff);
      this.stats.totalScore += Math.round(JudgmentSystem.SCORE_PERFECT * mul);
      this.addFeverGauge(JudgmentSystem.FEVER_FILL_PERFECT);
    } else if (judgment === Judgment.GREAT) {
      this.stats.great++;
      this.stats.totalHits++;
      this.stats.totalDeviation += Math.abs(diff);
      this.stats.totalScore += Math.round(JudgmentSystem.SCORE_GREAT * mul);
      this.addFeverGauge(JudgmentSystem.FEVER_FILL_GREAT);
    } else if (judgment === Judgment.MISS) {
      this.stats.miss++;
      this.stats.totalHits++;
      this.stats.totalDeviation += 150;
    }
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
  }

  public update() {
    const currentTime = this.audioManager.getCurrentTimeMS();
    const activeNotes = this.noteManager.getActiveNotes();

    // Fever timer
    if (this.feverActive && this.feverStartTime >= 0) {
      if (performance.now() - this.feverStartTime >= JudgmentSystem.FEVER_DURATION) {
        this.feverActive = false;
        this.feverStartTime = -1;
        if (this.onFeverEnd) this.onFeverEnd();
      }
    }

    // 롱노트 홀딩 틱 + 오토 컴플리트
    const processHold = (holdId: string | null, type: 'keyboard' | 'mouse') => {
      if (!holdId) return;
      const holdNoteIndex = activeNotes.findIndex(n => n.id === holdId);
      if (holdNoteIndex !== -1) {
        const note = activeNotes[holdNoteIndex].data;
        const endTime = note.time + (note.duration || 0);

        if (currentTime - this.lastTickTime[type] >= this.holdTickInterval) {
          this.combo++;
          this.stats.totalScore += Math.round(JudgmentSystem.SCORE_PERFECT * this.getScoreMultiplier());
          this.addFeverGauge(JudgmentSystem.FEVER_FILL_PERFECT);
          this.lastTickTime[type] = currentTime;
        }

        if (currentTime >= endTime) {
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
        if (type === 'keyboard') this.keyboardHoldNoteId = null;
        else this.mouseHoldNoteId = null;
      }
    };

    processHold(this.keyboardHoldNoteId, 'keyboard');
    processHold(this.mouseHoldNoteId, 'mouse');

    // MISS 처리
    for (let i = activeNotes.length - 1; i >= 0; i--) {
      const { data, isHolding } = activeNotes[i];
      if (isHolding) continue;
      const diff = currentTime - data.time;
      if (diff > JudgmentSystem.WINDOWS.GREAT) {
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

    const isKeyboardRelease = type === InputType.KEYBOARD_UP;
    const isMouseRelease = type === InputType.MOUSE_UP;

    if (isKeyboardRelease || isMouseRelease) {
      const targetHoldId = isKeyboardRelease ? this.keyboardHoldNoteId : this.mouseHoldNoteId;
      if (targetHoldId) {
        const holdNoteIndex = activeNotes.findIndex(n => n.id === targetHoldId);
        if (holdNoteIndex !== -1) {
          const note = activeNotes[holdNoteIndex].data;
          const endTime = note.time + (note.duration || 0);
          const diff = Math.abs(endTime - currentTime);
          if (diff <= JudgmentSystem.WINDOWS.GREAT) {
            this.noteManager.explodeNote(holdNoteIndex, false);
            if (this.onJudgment) this.onJudgment(note.lane, Judgment.PERFECT, note.type);
            if (this.onHoldEnd) this.onHoldEnd(note.lane as number);
          } else {
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

    let bestNoteIndex = -1;
    let minDiff = Infinity;
    for (let i = 0; i < activeNotes.length; i++) {
      const { data, isHolding } = activeNotes[i];
      if (isHolding) continue;
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
      if (inputMatches && diff < minDiff) { minDiff = diff; bestNoteIndex = i; }
    }

    if (bestNoteIndex !== -1) {
      const note = activeNotes[bestNoteIndex].data;
      const judgment = this.judge(note, currentTime);
      if (judgment !== Judgment.MISS) {
        if (note.type === 'long') {
          if (note.lane === 1) { this.keyboardHoldNoteId = activeNotes[bestNoteIndex].id; this.lastTickTime.keyboard = currentTime; }
          else if (note.lane === 0) { this.mouseHoldNoteId = activeNotes[bestNoteIndex].id; this.lastTickTime.mouse = currentTime; }
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
        this.combo = 0;
        this.noteManager.explodeNote(bestNoteIndex, true);
        this.recordJudgment(Judgment.MISS, minDiff);
        if (this.onJudgment) this.onJudgment(note.lane, Judgment.MISS, note.type);
      }
    }
  };

  public judge(note: NoteData, hitTime: number): Judgment {
    const diff = Math.abs(note.time - hitTime);
    if (note.characterId !== undefined) {
      if (note.characterId !== this.characterManager.getActiveCharacterId()) return Judgment.MISS;
    }
    if (diff <= JudgmentSystem.WINDOWS.PERFECT) return Judgment.PERFECT;
    if (diff <= JudgmentSystem.WINDOWS.GREAT) return Judgment.GREAT;
    return Judgment.MISS;
  }

  public getCombo() { return this.combo; }
}
