import { Application, Container, Assets } from 'pixi.js';
import { InputManager } from './InputManager';
import { CharacterManager } from '../game/CharacterManager';
import { AudioManager } from './AudioManager';
import { NoteManager } from '../game/NoteManager';
import { JudgmentSystem } from '../game/JudgmentSystem';
import { ChartLoader } from '../game/ChartLoader';
import type { ChartData } from '../game/ChartLoader';
import { HUDManager } from '../game/HUDManager';
import { BackgroundManager } from '../game/BackgroundManager';

export interface GameStats {
  perfect: number;
  great: number;
  miss: number;
  maxCombo: number;
  totalDeviation: number;
  totalHits: number;
}

export class GameEngine {
  public app: Application | null = null;
  public characterManager: CharacterManager;
  public audioManager: AudioManager;
  public noteManager: NoteManager | null = null;
  public judgmentSystem: JudgmentSystem | null = null;
  public hudManager: HUDManager | null = null;
  public backgroundManager: BackgroundManager | null = null;
  
  private static instance: GameEngine;
  private container: HTMLElement | null = null;
  private gameLayer: Container;

  private chart: ChartData | null = null;
  private currentNoteIndex: number = 0;
  private isPlaying: boolean = false;
  private isPaused: boolean = false;
  private startTime: number = 0;

  public initialized: boolean = false;
  private initializing: boolean = false;
  
  // Intro Sequence State
  private introPhase: boolean = false;
  private introState: 'WAITING' | 'READY' | 'GO' | 'DONE' = 'DONE';
  private introStartTime: number = 0;
  private goShownTime: number = 0;
  
  public onGameEnd: ((stats: GameStats) => void) | null = null;
  private gameEnded: boolean = false;
  private isFadingOut: boolean = false;

  private constructor() {
    this.characterManager = new CharacterManager();
    this.audioManager = AudioManager.getInstance();
    this.gameLayer = new Container();
  }

  public static getInstance(): GameEngine {
    if (!GameEngine.instance) {
      GameEngine.instance = new GameEngine();
    }
    return GameEngine.instance;
  }

  public setOffset(offset: number) {
    this.audioManager.setOffset(offset);
  }

  public async init(container: HTMLElement) {
    if (this.initialized || this.initializing) return;
    this.initializing = true;
    this.container = container;

    try {
      const app = new Application();
      await app.init({
        resizeTo: container,
        backgroundColor: 0x000000,
        antialias: true,
      });
      
      this.app = app;
      
      if (app.canvas && this.container) {
        this.container.appendChild(app.canvas);
      }

      app.stage.addChild(this.gameLayer);

      // Force font preload before HUDManager creation
      await document.fonts.load('36px "griun"').catch(() => null);

      InputManager.getInstance().init();
      this.characterManager.init(); // 캐릭터 매니저 초기화 및 입력 리스너 등록
      this.noteManager = new NoteManager(this.gameLayer);
      this.judgmentSystem = new JudgmentSystem(this.characterManager, this.audioManager, this.noteManager);
      this.hudManager = new HUDManager(this.gameLayer, this.characterManager);
      this.backgroundManager = new BackgroundManager(this.gameLayer);

      this.judgmentSystem.onJudgment = (lane, judgment, noteType) => {
        this.hudManager?.showJudgment(lane, judgment);
        if (judgment === 'PERFECT' || judgment === 'GREAT') {
          if (lane === 'any') {
            this.hudManager?.triggerSwitch(noteType);
          } else {
            this.hudManager?.triggerAttack(lane as number);
          }
        }
      };

      this.judgmentSystem.onHoldStart = (lane) => this.hudManager?.startHold(lane);
      this.judgmentSystem.onHoldEnd = (lane) => this.hudManager?.endHold(lane);

      app.ticker.add((ticker) => {
        // Background animates unless paused
        if (!this.isPaused) {
          this.backgroundManager?.update(ticker.deltaTime);
        }
        this.gameLoop(ticker.deltaTime);
      });

      this.initialized = true;
    } catch (e) {
      console.error('PixiJS init failed:', e);
    } finally {
      this.initializing = false;
    }
  }

  public async startSong(songUrl: string, chartUrl: string) {
    if (!this.initialized) return;
    
    try {
      // Preload animation assets
      const baseUrl = import.meta.env.BASE_URL;
      const prefixes = ['colot', 'hanoko'];
      const assetPromises: Promise<unknown>[] = [];
      
      // Force font preload so READY? renders correctly in Canvas
      assetPromises.push(document.fonts.load('120px "griun"').catch(() => null));
      
      for (const p of prefixes) {
        assetPromises.push(Assets.load(`${baseUrl}assets/images/${p}_run.png`));
        assetPromises.push(Assets.load(`${baseUrl}assets/images/${p}_hit_1.png`));
        assetPromises.push(Assets.load(`${baseUrl}assets/images/${p}_hit_2.png`));
        assetPromises.push(Assets.load(`${baseUrl}assets/images/${p}_hit_3.png`));
        assetPromises.push(Assets.load(`${baseUrl}assets/images/${p}_hold.png`));
      }

      // Preload note images
      for (let i = 0; i <= 4; i++) {
        assetPromises.push(Assets.load(`${baseUrl}assets/images/note_${i}.png`));
        assetPromises.push(Assets.load(`${baseUrl}assets/images/long_note_${i}.png`));
      }
      
      await Promise.all(assetPromises);

      this.chart = await ChartLoader.load(chartUrl);
      this.noteManager?.setBpm(this.chart.meta.bpm);
      
      try {
        await this.audioManager.loadAudio(songUrl);
        // Will play main audio at 'GO!'
        
        // Load Ready/Go SFX
        await Promise.all([
          this.audioManager.loadSFX('ready', `${baseUrl}assets/audio/ready.mp3`),
          this.audioManager.loadSFX('go', `${baseUrl}assets/audio/go.mp3`)
        ]);
      } catch {
        console.warn('Audio failed, starting in silent mode.');
      }
      
      this.characterManager.setRoster(this.chart.meta.roster);
      
      const firstNote = this.chart.notes.find(n => n.characterId !== undefined);
      if (firstNote && firstNote.characterId !== undefined) {
        this.characterManager.setInitialCharacter(firstNote.characterId);
      }

      this.hudManager?.initAvatar();
      await this.backgroundManager?.init();

      // Stop any previous audio & fade before restarting
      this.audioManager.stop();
      
      this.currentNoteIndex = 0;
      this.isPlaying = true;
      this.gameEnded = false;
      this.isFadingOut = false;
      
      // Begin Intro Phase
      this.introPhase = true;
      this.introState = 'WAITING';
      this.introStartTime = performance.now();
      
      await this.audioManager.resume();
      await this.audioManager.playIntro();
      this.hudManager?.updateIntro(0);

    } finally {
      // isStartingSong removed
    }
  }

  public pause() {
    if (!this.isPlaying || this.isPaused) return;
    this.isPaused = true;
    this.audioManager.pause();
    this.hudManager?.pauseAvatar();
  }

  public resume() {
    if (!this.isPlaying || !this.isPaused) return;
    this.isPaused = false;
    this.audioManager.resume();
    this.hudManager?.resumeAvatar();
  }

  private readonly NOTE_LOOKAHEAD = Math.ceil((window.innerWidth - 150) / 0.5);

  private spawnAndUpdate(currentTime: number, delta: number) {
    while (
      this.currentNoteIndex < this.chart!.notes.length &&
      this.chart!.notes[this.currentNoteIndex].time <= currentTime + this.NOTE_LOOKAHEAD
    ) {
      this.noteManager!.spawnNote(this.chart!.notes[this.currentNoteIndex]);
      this.currentNoteIndex++;
    }
    this.noteManager!.update(currentTime, delta);
  }

  private updateScoreHUD() {
    if (!this.judgmentSystem || !this.hudManager || !this.chart) return;
    this.hudManager.updateCombo(this.judgmentSystem.getCombo());
    const { perfect, great } = this.judgmentSystem.stats;
    const total = this.chart.notes.length;
    const score = total > 0 ? Math.floor((perfect + great * 0.5) / total * 300000) : 0;
    this.hudManager.updateScore(score);
  }

  private gameLoop(delta: number) {
    if (!this.isPlaying || this.isPaused || !this.chart || !this.noteManager || !this.hudManager) return;

    if (this.introPhase) {
      const introElapsed = performance.now() - this.introStartTime;

      if (this.introState === 'WAITING') {
        if (introElapsed >= 1000) {
          this.introState = 'READY';
          this.hudManager.setIntroText('READY?');
          this.audioManager.playSFX('ready');
          // READY 1500ms + GO! 표시 500ms + 사라진 후 1000ms = 오디오 시작까지 3000ms
          // Web Audio 정밀 스케줄링으로 예약 → getCurrentTimeMS()가 -3000→0 카운트다운
          this.audioManager.playScheduled(3.0);
        }
      } else if (this.introState === 'READY') {
        const readyElapsed = introElapsed - 1000;
        this.hudManager.updateIntro(Math.min(1, readyElapsed / 1500));

        if (readyElapsed >= 1500) {
          this.introState = 'GO';
          this.hudManager.setIntroText('GO!');
          this.audioManager.playSFX('go');
          this.audioManager.fadeOutIntro(500);
          this.goShownTime = performance.now();
        }
      } else if (this.introState === 'GO') {
        if (performance.now() - this.goShownTime >= 500) {
          this.hudManager.hideIntroText();
        }
      }

      this.hudManager.update(delta);
      if (this.introState === 'WAITING') return;

      // getCurrentTimeMS()는 playScheduled 이후 음수(-3000→0)로 카운트다운
      // → previewTime이 0을 넘는 순간 오디오가 정확히 시작되어 점프 없음
      const previewTime = this.audioManager.getCurrentTimeMS();
      this.spawnAndUpdate(previewTime, delta);

      if (previewTime >= 0) {
        if (this.introPhase) {
          this.introPhase = false;
          this.introState = 'DONE';
        }
        this.judgmentSystem?.update();
        this.updateScoreHUD();
      }
      return;
    }

    // 메인 게임 루프
    let currentTime = this.audioManager.getCurrentTimeMS();
    if (currentTime === 0 && this.isPlaying) {
      currentTime = performance.now() - this.startTime;
    }

    this.spawnAndUpdate(currentTime, delta);
    this.judgmentSystem?.update();
    this.updateScoreHUD();
    this.hudManager?.update(delta);

    // Check game over
    if (!this.gameEnded && this.chart && this.judgmentSystem && this.currentNoteIndex >= this.chart.notes.length) {
      const activeNotes = this.noteManager.getActiveNotes();
      if (activeNotes.length === 0) {
        const lastNote = this.chart.notes[this.chart.notes.length - 1];
        const endTime = lastNote ? lastNote.time + (lastNote.duration || 0) : 0;

        if (currentTime > endTime + 2000 && !this.isFadingOut) {
          this.isFadingOut = true;
          this.audioManager.fadeOutMain(3000);
        }

        if (currentTime > endTime + 5000) {
          this.gameEnded = true;
          this.isPlaying = false;
          if (this.onGameEnd) {
            this.onGameEnd(this.judgmentSystem.stats);
          }
        }
      }
    }
  }

  public destroy() {
    if (!this.app) return;
    
    this.audioManager.stop();
    
    const container = this.container;
    const app = this.app;
    
    if (container) {
      InputManager.getInstance().destroy();
      try {
        if (app.canvas && container.contains(app.canvas)) {
          container.removeChild(app.canvas);
        }
      } catch { /* ignore */ }
    }
    
    try {
      app.destroy(true, { children: true, texture: false }); // DON'T destroy textures managed by Assets system
    } catch { /* ignore */ }
    
    this.app = null;
    this.initialized = false;
    this.initializing = false;
    this.isPlaying = false;
    this.isPaused = false;
    this.introPhase = false;
    this.introState = 'DONE';
    this.introStartTime = 0;
    this.goShownTime = 0;
    this.container = null;
    this.chart = null;
    this.currentNoteIndex = 0;
  }
}
