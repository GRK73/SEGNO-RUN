import { Application, Container, Assets } from 'pixi.js';
import { InputManager } from './InputManager';
import { CharacterManager } from '../game/CharacterManager';
import { AudioManager } from './AudioManager';
import { NoteManager } from '../game/NoteManager';
import { JudgmentSystem } from '../game/JudgmentSystem';
import { ChartLoader } from '../game/ChartLoader';
import type { ChartData } from '../game/ChartLoader';
import { HUDManager } from '../game/HUDManager';

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
  private startTime: number = 0;

  private initialized: boolean = false;
  private initializing: boolean = false;
  
  // Intro Sequence State
  private introPhase: boolean = false;
  private introState: 'WAITING' | 'READY' | 'GO' | 'DONE' = 'DONE';
  private introStartTime: number = 0;

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

      InputManager.getInstance().init(container);
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
      const assetPromises: Promise<any>[] = [];
      
      // Force font preload so READY? renders correctly in Canvas
      assetPromises.push(document.fonts.load('120px "planb"').catch(() => null));
      
      for (const p of prefixes) {
        assetPromises.push(Assets.load(`${baseUrl}assets/images/${p}_run.png`));
        assetPromises.push(Assets.load(`${baseUrl}assets/images/${p}_hit_1.png`));
        assetPromises.push(Assets.load(`${baseUrl}assets/images/${p}_hit_2.png`));
        assetPromises.push(Assets.load(`${baseUrl}assets/images/${p}_hit_3.png`));
        assetPromises.push(Assets.load(`${baseUrl}assets/images/${p}_hold.png`));
      }
      
      await Promise.all(assetPromises);

      this.chart = await ChartLoader.load(chartUrl);
      
      try {
        await this.audioManager.loadAudio(songUrl);
        // Will play main audio at 'GO!'
      } catch (e) {
        console.warn('Audio failed, starting in silent mode.');
      }
      
      this.characterManager.setRoster(this.chart.meta.roster);
      
      const firstNote = this.chart.notes.find(n => n.characterId !== undefined);
      if (firstNote && firstNote.characterId !== undefined) {
        this.characterManager.setInitialCharacter(firstNote.characterId);
      }

      this.hudManager?.initAvatar();

      this.currentNoteIndex = 0;
      this.isPlaying = true;
      
      // Begin Intro Phase
      this.introPhase = true;
      this.introState = 'WAITING';
      this.introStartTime = performance.now();
      
      this.audioManager.playIntro();
      this.hudManager?.updateIntro(0);

    } catch (e) {
      console.error('Failed to start song:', e);
    }
  }

  private gameLoop(delta: number) {
    if (!this.isPlaying || !this.chart || !this.noteManager || !this.hudManager) return;
    
    if (this.introPhase) {
      const introElapsed = performance.now() - this.introStartTime;
      
      if (this.introState === 'WAITING') {
        if (introElapsed >= 1000) {
          this.introState = 'READY';
          this.hudManager.setIntroText('READY?');
        }
      } else if (this.introState === 'READY') {
        const readyElapsed = introElapsed - 1000;
        this.hudManager.updateIntro(Math.min(1, readyElapsed / 1500));
        
        if (readyElapsed >= 1500) {
          this.introState = 'GO';
          this.hudManager.setIntroText('GO!');
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
    if (this.judgmentSystem && this.hudManager) {
      this.hudManager.updateCombo(this.judgmentSystem.getCombo());
    }
    this.hudManager?.update(delta);
  }

  public destroy() {
    if (!this.app) return;
    
    const container = this.container;
    const app = this.app;
    
    if (container) {
      InputManager.getInstance().destroy(container);
      try {
        if (app.canvas && container.contains(app.canvas)) {
          container.removeChild(app.canvas);
        }
      } catch (e) {}
    }
    
    try {
      app.destroy(true, { children: true, texture: true });
    } catch (e) {}
    
    this.app = null;
    this.initialized = false;
    this.initializing = false;
    this.isPlaying = false;
    this.container = null;
    this.chart = null;
    this.currentNoteIndex = 0;
    this.gameLayer = new Container();
  }
}
