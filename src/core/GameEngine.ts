import { Application, Container, Assets } from 'pixi.js';
import { InputManager } from './InputManager';
import { CharacterManager } from '../game/CharacterManager';
import { AudioManager } from './AudioManager';
import { NoteManager } from '../game/NoteManager';
import { JudgmentSystem } from '../game/JudgmentSystem';
import { ChartLoader } from '../game/ChartLoader';
import type { ChartData } from '../game/ChartLoader';
import { HUDManager } from '../game/HUDManager';

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
      await document.fonts.load('36px "planb"').catch(() => null);

      InputManager.getInstance().init();
      this.characterManager.init(); // 캐릭터 매니저 초기화 및 입력 리스너 등록
      this.noteManager = new NoteManager(this.gameLayer);
      this.judgmentSystem = new JudgmentSystem(this.characterManager, this.audioManager, this.noteManager);
      this.hudManager = new HUDManager(this.gameLayer, this.characterManager);

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
      const prefixes = ['segin', 'songbam', 'navi'];
      const assetPromises: Promise<unknown>[] = [];
      
      // Force font preload so READY? renders correctly in Canvas
      assetPromises.push(document.fonts.load('120px "planb"').catch(() => null));
      
      for (const p of prefixes) {
        assetPromises.push(Assets.load(`${baseUrl}assets/images/${p}_run.png`));
        assetPromises.push(Assets.load(`${baseUrl}assets/images/${p}_hit_1.png`));
        assetPromises.push(Assets.load(`${baseUrl}assets/images/${p}_hit_2.png`));
        assetPromises.push(Assets.load(`${baseUrl}assets/images/${p}_hit_3.png`));
        assetPromises.push(Assets.load(`${baseUrl}assets/images/${p}_hold.png`));
      }

      // Preload note images
      for (let i = 1; i <= 4; i++) {
        assetPromises.push(Assets.load(`${baseUrl}assets/images/note_${i}.png`));
      }
      
      await Promise.all(assetPromises);

      this.chart = await ChartLoader.load(chartUrl);
      
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
  }

  public resume() {
    if (!this.isPlaying || !this.isPaused) return;
    this.isPaused = false;
    this.audioManager.resume();
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
        }
      } else if (this.introState === 'READY') {
        const readyElapsed = introElapsed - 1000;
        this.hudManager.updateIntro(Math.min(1, readyElapsed / 1500));
        
        if (readyElapsed >= 1500) {
          this.introState = 'GO';
          this.hudManager.setIntroText('GO!');
          this.audioManager.playSFX('go');
          this.audioManager.fadeOutIntro(500);
          this.audioManager.play();
          this.startTime = performance.now(); // reset game start time
        }
      } else if (this.introState === 'GO') {
        if (introElapsed >= 3000) { // 2.5s + 0.5s = 3.0s
          this.hudManager.hideIntroText();
          this.introState = 'DONE';
          this.introPhase = false; // Intro finished
        }
      }
      
      this.hudManager.update(delta);
      
      // Do not process notes during WAITING or READY
      if (this.introState === 'WAITING' || this.introState === 'READY') return;
    }

    // Use AudioManager time if available, otherwise fallback to performance.now()
    let currentTime = this.audioManager.getCurrentTimeMS();
    if (currentTime === 0 && this.isPlaying && !this.introPhase) {
      currentTime = performance.now() - this.startTime;
    }
    
    // Spawn notes
    while (
      this.currentNoteIndex < this.chart.notes.length &&
      this.chart.notes[this.currentNoteIndex].time <= currentTime + 2000
    ) {
      this.noteManager.spawnNote(this.chart.notes[this.currentNoteIndex]);
      this.currentNoteIndex++;
    }

    this.noteManager.update(currentTime, delta);
    this.judgmentSystem?.update();
    if (this.judgmentSystem && this.hudManager && this.chart) {
      this.hudManager.updateCombo(this.judgmentSystem.getCombo());
      
      // Calculate real-time score
      const stats = this.judgmentSystem.stats;
      const totalJudgments = this.chart.notes.length;
      const score = totalJudgments > 0 
        ? Math.floor(((stats.perfect * 1.0) + (stats.great * 0.5)) / totalJudgments * 300000)
        : 0;
      this.hudManager.updateScore(score);
    }
    this.hudManager?.update(delta);

    // Check game over
    if (!this.gameEnded && this.chart && this.judgmentSystem && this.currentNoteIndex >= this.chart.notes.length) {
      const activeNotes = this.noteManager.getActiveNotes();
      if (activeNotes.length === 0) {
        const lastNote = this.chart.notes[this.chart.notes.length - 1];
        const endTime = lastNote ? lastNote.time + (lastNote.duration || 0) : 0;
        
        // 마지막 노트 종료 후 2초 뒤부터 페이드아웃 시작
        if (currentTime > endTime + 2000 && !this.isFadingOut) {
          this.isFadingOut = true;
          this.audioManager.fadeOutMain(3000); // 3초간 서서히 소리 줄임
        }

        // 총 5초 대기 (2초 일반 재생 + 3초 페이드아웃) 후 결과창 출력
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
    this.container = null;
    this.chart = null;
    this.currentNoteIndex = 0;
    this.gameLayer = new Container();
  }
}
