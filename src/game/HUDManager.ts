import { Container, Graphics, Text, TextStyle, AnimatedSprite, Texture, Assets } from 'pixi.js';
import { CharacterManager } from './CharacterManager';

export class HUDManager {
  private container: Container;
  private gearGraphics: Graphics;
  private avatarSprite: AnimatedSprite;
  private comboText: Text;
  private activeJudgments: { text: Text, time: number }[] = [];

  private runFrames: Texture[] = [];
  private hitFrames: Texture[] = [];
  private holdFrame: Texture | null = null;
  
  // Cache for sliced frames to avoid re-slicing
  private characterAssets: Map<string, {
    run: Texture[],
    hits: Texture[],
    hold: Texture | null
  }> = new Map();
  
  private lastAssetPrefix: string = '';
  private attackTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private activeHoldLane: number | null = null;
  private switchBounce: number = 1.0;
  private holdTime: number = 0;

  // Render Offsets
  private baseAvatarX: number = 155;
  private baseAvatarY: number = 400;
  private introOffsetX: number = -300;
  private attackSlideX: number = 0;
  private attackSlideY: number = 0;
  private switchOffsetY: number = 0;

  private judgmentLineX: number = 250;
  private characterManager: CharacterManager;

  constructor(parent: Container, characterManager: CharacterManager) {
    this.characterManager = characterManager;
    this.container = new Container();
    parent.addChild(this.container);

    this.gearGraphics = new Graphics();
    this.container.addChild(this.gearGraphics);

    this.avatarSprite = new AnimatedSprite([Texture.EMPTY]);
    this.avatarSprite.anchor.set(0.5);
    this.avatarSprite.x = this.baseAvatarX + this.introOffsetX;
    this.avatarSprite.y = this.baseAvatarY;
    this.container.addChild(this.avatarSprite);

    const style = new TextStyle({
      fontFamily: 'Arial',
      fontSize: 48,
      fill: '#ffffff',
      fontWeight: 'bold',
    });
    this.comboText = new Text({ text: '', style });
    this.comboText.x = this.judgmentLineX;
    this.comboText.y = 50;
    this.container.addChild(this.comboText);

    this.initGear();
  }

  private initGear() {
    const g = this.gearGraphics;
    g.clear();
    
    // Lower Lane (Keyboard)
    g.rect(0, 395, 2000, 10);
    g.fill({ color: 0x00aaff, alpha: 0.3 });
    
    // Upper Lane (Mouse)
    g.rect(0, 195, 2000, 10);
    g.fill({ color: 0xff4400, alpha: 0.3 });

    // Judgment Line (Shifted to 250)
    g.rect(this.judgmentLineX, 150, 4, 300);
    g.fill(0xffffff);

    // Upper Lane Hit Circle
    g.circle(this.judgmentLineX + 2, 200, 24);
    g.stroke({ width: 3, color: 0xffffff, alpha: 0.8 });

    // Lower Lane Hit Circle
    g.circle(this.judgmentLineX + 2, 400, 24);
    g.stroke({ width: 3, color: 0xffffff, alpha: 0.8 });
  }

  public showJudgment(lane: number | string, judgment: string) {
    let color = '#ffffff';
    if (judgment === 'PERFECT') color = '#e3e124';
    else if (judgment === 'GREAT') color = '#02e5fa';
    else if (judgment === 'MISS') color = '#e2290a';

    const style = new TextStyle({
      fontFamily: 'planb',
      fontSize: 32,
      fill: color,
      fontWeight: 'bold',
      stroke: { color: '#000000', width: 4 },
    });

    const text = new Text({ text: judgment, style });
    
    // Center X
    text.x = this.judgmentLineX - text.width / 2;
    // Y slightly above the judgment lines
    if (lane === 1) text.y = 200 - 40; 
    else if (lane === 0) text.y = 400 - 40; 
    else text.y = 300 - 40; 

    this.container.addChild(text);
    this.activeJudgments.push({ text, time: 0 });
  }

  public update(_delta: number) {
    // Update Avatar View
    const character = this.characterManager.getActiveCharacter();
    
    // Check if character changed
    if (this.lastAssetPrefix !== character.assetPrefix) {
      this.lastAssetPrefix = character.assetPrefix;
      const cached = this.characterAssets.get(character.assetPrefix);
      if (cached) {
        this.runFrames = cached.run;
        this.hitFrames = cached.hits;
        this.holdFrame = cached.hold;
        
        // If not currently attacking or holding, update sprite immediately
        if (this.attackTimeoutId === null && this.activeHoldLane === null) {
          this.avatarSprite.textures = this.runFrames;
          this.avatarSprite.play();
        }
      }
    }

    // Character Avatar Tint Update
    if (this.avatarSprite) {
       this.avatarSprite.tint = 0xffffff; // Remove custom tint
       
       if (this.attackSlideY !== 0) {
         this.attackSlideY += (0 - this.attackSlideY) * 0.3 * _delta;
         if (Math.abs(this.attackSlideY) < 0.5) this.attackSlideY = 0;
       }

       if (this.switchBounce > 1.0) {
         this.switchBounce -= 0.05 * _delta;
         if (this.switchBounce < 1.0) this.switchBounce = 1.0;
       }
       
       this.avatarSprite.width = 150 * this.switchBounce;
       this.avatarSprite.height = 150 * this.switchBounce;

       let bobbingOffset = 0;
       if (this.activeHoldLane !== null) {
         this.holdTime += _delta;
         bobbingOffset = Math.sin(this.holdTime * 0.2) * 5;
       } else {
         this.holdTime = 0;
       }

       if (this.introOffsetX < 0) {
         this.introOffsetX += (0 - this.introOffsetX) * 0.1 * _delta;
         if (this.introOffsetX > -1) this.introOffsetX = 0;
       }

       if (this.switchOffsetY !== 0) {
         this.switchOffsetY += (0 - this.switchOffsetY) * 0.2 * _delta;
         if (Math.abs(this.switchOffsetY) < 1) this.switchOffsetY = 0;
       }

       this.avatarSprite.x = this.baseAvatarX + this.introOffsetX + this.attackSlideX;
       this.avatarSprite.y = this.baseAvatarY + this.attackSlideY + this.switchOffsetY + bobbingOffset;
    }

    // Update floating judgments
    for (let i = this.activeJudgments.length - 1; i >= 0; i--) {
      const item = this.activeJudgments[i];
      item.time += 16.6 * _delta; // rough ms estimation based on 60fps
      item.text.y -= 1.0 * _delta; // float up
      item.text.alpha = Math.max(0, 1 - item.time / 500); // fade out over 500ms
      
      if (item.time >= 500) {
        this.container.removeChild(item.text);
        item.text.destroy();
        this.activeJudgments.splice(i, 1);
      }
    }
  }

  public updateCombo(combo: number) {
    this.comboText.text = combo > 0 ? `${combo} COMBO` : '';
    this.comboText.x = this.judgmentLineX - this.comboText.width / 2;
  }

  public initAvatar() {
    const baseUrl = import.meta.env.BASE_URL;
    const prefixes = ['segin', 'songbam', 'navi'];
    const baseW = 960;
    const baseH = 960;

    for (const prefix of prefixes) {
      const runSheet = Assets.cache.get(`${baseUrl}assets/images/${prefix}_run.png`);
      if (!runSheet) continue;

      const runFrames: Texture[] = [];
      const imgSource = runSheet.source.resource as CanvasImageSource;
      
      // Determine frame count (assuming 21 for now, but could be dynamic)
      // segin is 20160, songbam is around 10201 in bytes but check resolution if possible.
      // Assuming they all follow same layout but songbam might have fewer frames.
      // Let's assume they all have 21 frames or check runSheet width.
      const frameCount = Math.floor(runSheet.width / baseW);

      for (let i = 0; i < frameCount; i++) {
        const frameCanvas = document.createElement('canvas');
        frameCanvas.width = baseW;
        frameCanvas.height = baseH;
        const frameCtx = frameCanvas.getContext('2d');
        if (frameCtx && imgSource) {
          frameCtx.drawImage(imgSource, i * baseW, 0, baseW, baseH, 0, 0, baseW, baseH);
          runFrames.push(Texture.from(frameCanvas));
        }
      }

      const hitFrames = [
        Assets.cache.get(`${baseUrl}assets/images/${prefix}_hit_1.png`),
        Assets.cache.get(`${baseUrl}assets/images/${prefix}_hit_2.png`),
        Assets.cache.get(`${baseUrl}assets/images/${prefix}_hit_3.png`)
      ].filter(t => !!t);

      const holdFrame = Assets.cache.get(`${baseUrl}assets/images/${prefix}_hold.png`) || null;

      this.characterAssets.set(prefix, {
        run: runFrames,
        hits: hitFrames,
        hold: holdFrame
      });
    }

    // Initialize with current character
    const initialChar = this.characterManager.getActiveCharacter();
    this.lastAssetPrefix = initialChar.assetPrefix;
    const cached = this.characterAssets.get(initialChar.assetPrefix);
    
    if (cached && this.avatarSprite) {
      this.runFrames = cached.run;
      this.hitFrames = cached.hits;
      this.holdFrame = cached.hold;
      
      this.avatarSprite.textures = this.runFrames;
      this.avatarSprite.width = 150;
      this.avatarSprite.height = 150;
      this.avatarSprite.animationSpeed = 0.5;
      this.avatarSprite.loop = true;
      this.avatarSprite.play();
    }
  }

  public triggerAttack(lane?: number | string) {
    if (!this.avatarSprite || this.hitFrames.length === 0) return;
    if (this.activeHoldLane !== null) return; // Prevent attack animation from overriding hold
    
    const prevY = this.baseAvatarY;
    const newY = (lane === 1) ? 200 : 400;
    this.baseAvatarY = newY;
    
    if (prevY === 400 && newY === 200) {
      this.attackSlideY = 7;   // Starts lower, slides UP
    } else if (prevY === 200 && newY === 400) {
      this.attackSlideY = -5;  // Starts higher, slides DOWN
    } else {
      this.attackSlideY = 0;
    }
    
    this.attackSlideX = 10; // Push 10px right during attack

    const randomHit = this.hitFrames[Math.floor(Math.random() * this.hitFrames.length)];
    this.avatarSprite.textures = [randomHit];
    // Keep width and height stable after switching texture
    this.avatarSprite.width = 150;
    this.avatarSprite.height = 150;
    this.avatarSprite.loop = false;
    this.avatarSprite.gotoAndPlay(0);
    
    if (this.attackTimeoutId !== null) {
      clearTimeout(this.attackTimeoutId);
    }
    
    this.attackTimeoutId = setTimeout(() => {
      if (this.avatarSprite && this.activeHoldLane === null) {
        this.baseAvatarY = 400;
        this.attackSlideY = 0;
        this.attackSlideX = 0;
        this.avatarSprite.textures = this.runFrames;
        this.avatarSprite.loop = true;
        this.avatarSprite.play();
      }
      this.attackTimeoutId = null;
    }, 300);
  }

  public startHold(lane: number) {
    if (!this.avatarSprite || !this.holdFrame) return;
    
    this.activeHoldLane = lane;
    this.attackSlideY = 0;
    this.attackSlideX = 0;
    if (lane === 1) {
      this.baseAvatarY = 200;
    } else {
      this.baseAvatarY = 400;
    }
    
    this.avatarSprite.textures = [this.holdFrame];
    this.avatarSprite.loop = false;
    this.avatarSprite.gotoAndPlay(0);
    
    if (this.attackTimeoutId !== null) {
      clearTimeout(this.attackTimeoutId);
      this.attackTimeoutId = null;
    }
  }

  public endHold(lane: number) {
    if (this.activeHoldLane === lane) {
      this.activeHoldLane = null;
      if (this.avatarSprite) {
        this.baseAvatarY = 400;
        this.attackSlideY = 0;
        this.attackSlideX = 0;
        this.avatarSprite.textures = this.runFrames;
        this.avatarSprite.loop = true;
        this.avatarSprite.play();
      }
    }
  }

  public triggerSwitch(type?: string) {
    if (!this.avatarSprite) return;
    this.switchBounce = 1.3; // Character effectively "pops" to feel like a dynamic switch
    
    if (type === 'switch_up') {
      this.switchOffsetY = 150; // comes from below up to target
    } else if (type === 'switch_down') {
      this.switchOffsetY = -150; // comes from above down to target
    } else {
      this.switchOffsetY = 0;
    }
  }
}
