import { Container, Graphics, Text, TextStyle, AnimatedSprite, Texture, Assets, Sprite } from 'pixi.js';
import { CharacterManager } from './CharacterManager';

export class HUDManager {
  private container: Container;
  private gearGraphics: Graphics;
  private arcGraphics: Graphics;
  private arcRotation: number = 0;
  private avatarSprite: AnimatedSprite;
  private comboText: Text;
  private scoreText: Text;
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
  private comboBounce: number = 1.0;
  private holdTime: number = 0;

  // Render Offsets
  private baseAvatarX: number = 155;
  private baseAvatarY: number = 450; 
  private introOffsetX: number = 0;
  private attackSlideX: number = 0;
  private attackSlideY: number = 0;
  private switchOffsetY: number = 0;

  private judgmentLineX: number = 250;
  private characterManager: CharacterManager;

  // Floor scrolling
  private floorSprites: Sprite[] = [];
  private floorScrollSpeed: number = 0.5;
  private floorTileW: number = 0;
  private floorContainer: Container;

  // Intro text
  private introText: Text | null = null;
  private introTextHiding: boolean = false;

  constructor(parent: Container, characterManager: CharacterManager) {
    this.characterManager = characterManager;
    this.container = new Container();

    this.floorContainer = new Container();
    this.container.addChildAt(this.floorContainer, 0); // behind everything

    // 판정 원은 노트보다 아래 레이어에 추가
    this.gearGraphics = new Graphics();
    parent.addChildAt(this.gearGraphics, 0);

    this.arcGraphics = new Graphics();
    parent.addChildAt(this.arcGraphics, 0);

    // HUD 메인 컨테이너(아바타, 텍스트 등)는 노트 위에 추가
    parent.addChild(this.container);

    this.avatarSprite = new AnimatedSprite([Texture.EMPTY]);
    this.avatarSprite.anchor.set(0.5);
    this.avatarSprite.x = this.baseAvatarX;
    this.avatarSprite.y = this.baseAvatarY;
    this.container.addChild(this.avatarSprite);

    const style = new TextStyle({
      fontFamily: '"griun", sans-serif',
      fontSize: 40,
      fill: '#ffffff',
      fontWeight: 'bold',
      stroke: { color: '#000000', width: 6 },
    });
    this.comboText = new Text({ text: '', style });
    this.comboText.anchor.set(0.5); 
    this.comboText.x = window.innerWidth / 2; 
    this.comboText.y = 120;
    this.container.addChild(this.comboText);

    const scoreStyle = new TextStyle({
      fontFamily: '"griun", sans-serif',
      fontSize: 36,
      fill: '#ffffff',
      fontWeight: 'bold',
      stroke: { color: '#000000', width: 4 },
    });
    this.scoreText = new Text({ text: '000,000', style: scoreStyle });
    this.scoreText.anchor.set(1, 0); // Top-right anchor
    this.scoreText.x = window.innerWidth - 30;
    this.scoreText.y = 30;
    this.container.addChild(this.scoreText);

    this.initGear();
  }

  public updateScore(score: number) {
    this.scoreText.text = score.toLocaleString('en-US', { minimumIntegerDigits: 6, useGrouping: true });
  }

  private initGear() {
    const g = this.gearGraphics;
    g.clear();

    // Upper Lane - 중심 원
    g.circle(this.judgmentLineX + 2, 250, 7);
    g.fill({ color: 0xffffff, alpha: 0.9 });

    // Lower Lane - 중심 원
    g.circle(this.judgmentLineX + 2, 450, 7);
    g.fill({ color: 0xffffff, alpha: 0.9 });
  }

  private drawArcs() {
    const g = this.arcGraphics;
    g.clear();

    const cx = this.judgmentLineX + 2;
    const lanes = [250, 450];
    const radius = 20;
    const arcSpan = (Math.PI * 2 / 3) * 0.72; // 120° 중 72% = 약 86°
    const gap = Math.PI * 2 / 3;

    for (const cy of lanes) {
      for (let i = 0; i < 3; i++) {
        const startAngle = this.arcRotation + gap * i;
        const endAngle = startAngle + arcSpan;
        g.arc(cx, cy, radius, startAngle, endAngle);
        g.stroke({ width: 3, color: 0xffffff, alpha: 0.85 });
      }
    }
  }

  public showJudgment(lane: number | string, judgment: string) {
    let color = '#ffffff';
    if (judgment === 'PERFECT') color = '#e3e124';
    else if (judgment === 'GREAT') color = '#02e5fa';
    else if (judgment === 'MISS') color = '#e2290a';

    const style = new TextStyle({
      fontFamily: '"griun", sans-serif',
      fontSize: 32,
      fill: color,
      fontWeight: 'bold',
      stroke: { color: '#000000', width: 4 },
    });

    const text = new Text({ text: judgment, style });
    text.anchor.set(0.5);
    text.x = this.judgmentLineX;
    if (lane === 1) text.y = 250 - 40;
    else if (lane === 0) text.y = 450 - 40;
    else text.y = 350 - 40;
    text.scale.set(1.5);

    this.container.addChild(text);
    this.activeJudgments.push({ text, time: 0 });
  }

  public setIntroText(textStr: string) {
    const isReady = textStr.includes('READY');
    const textColor = isReady ? '#ff9400' : '#27ae60';

    if (!this.introText) {
      const style = new TextStyle({
        fontFamily: '"griun", sans-serif',
        fontSize: 90,
        fill: textColor,
        fontWeight: 'bold',
        stroke: { color: '#2b2b2b', width: 12 },
        dropShadow: { color: '#000000', alpha: 0.8, blur: 4, distance: 5 }
      });
      this.introText = new Text({ text: textStr, style });
      this.introText.anchor.set(0.5);
      this.introText.x = window.innerWidth / 2;
      this.introText.y = window.innerHeight / 2;
      this.container.addChild(this.introText);
    } else {
      this.introText.text = textStr;
      if (this.introText.style) {
        this.introText.style.fill = textColor;
      }
      this.introText.alpha = 1;
      this.introText.scale.set(1.2); // slight pop on creation
      this.introText.visible = true;
      this.introTextHiding = false;
    }
  }

  public hideIntroText() {
    if (this.introText && this.introText.visible) {
      this.introTextHiding = true;
    }
  }

  public updateIntro(progress: number) {
     const startOffset = -500;
     const targetOffset = 0;
     
     if (progress <= 0) {
       this.introOffsetX = startOffset;
       return;
     }

     const easeOut = 1 - Math.pow(1 - progress, 4);
     this.introOffsetX = startOffset + (targetOffset - startOffset) * Math.min(1, easeOut);
  }

  public update(_delta: number) {
    this.arcRotation += 0.025 * _delta;
    this.drawArcs();

    this.comboBounce = 1.0 + (this.comboBounce - 1.0) * Math.pow(0.8, _delta);
    this.comboText.scale.set(this.comboBounce);

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

    if (this.avatarSprite) {
       if (this.avatarSprite.tint !== 0xffffff) this.avatarSprite.tint = 0xffffff;
       
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

       if (this.switchOffsetY !== 0) {
         this.switchOffsetY += (0 - this.switchOffsetY) * 0.2 * _delta;
         if (Math.abs(this.switchOffsetY) < 1) this.switchOffsetY = 0;
       }

       // Update Avatar Final Position
       this.avatarSprite.x = this.baseAvatarX + this.introOffsetX + this.attackSlideX;
       this.avatarSprite.y = this.baseAvatarY + this.attackSlideY + this.switchOffsetY + bobbingOffset;
    }

    if (this.introText && this.introText.visible) {
       if (this.introText.text === 'GO!' && !this.introTextHiding) {
          // shrink back the pop effect
          if (this.introText.scale.x > 1.0) {
             this.introText.scale.set(Math.max(1.0, this.introText.scale.x - 0.05 * _delta));
          }
       }
       
       if (this.introTextHiding) {
          // "Pop" disappear effect (scale up and fade out quickly)
          this.introText.scale.set(this.introText.scale.x + 0.1 * _delta);
          this.introText.alpha -= 0.1 * _delta;
          if (this.introText.alpha <= 0) {
              this.introText.visible = false;
              this.introTextHiding = false;
          }
       }
    }

    // Update floating judgments
    for (let i = this.activeJudgments.length - 1; i >= 0; i--) {
      const item = this.activeJudgments[i];
      item.time += 16.6 * _delta;
      item.text.y -= 1.0 * _delta;
      item.text.alpha = Math.max(0, 1 - item.time / 500);
      const bounce = 1.0 + 0.55 * Math.exp(-item.time / 55) * Math.cos(item.time / 32);
      item.text.scale.set(Math.max(0.1, bounce));
      
      if (item.time >= 500) {
        this.container.removeChild(item.text);
        item.text.destroy();
        this.activeJudgments.splice(i, 1);
      }
    }

    // Scroll floor
    if (this.floorTileW > 0) {
      const scrollDelta = this.floorScrollSpeed * 16.6 * _delta;
      for (const fs of this.floorSprites) {
        fs.x -= scrollDelta;
        if (fs.x + this.floorTileW <= 0) {
          let maxX = -Infinity;
          for (const other of this.floorSprites) {
            if (other !== fs) {
              const rightEdge = other.x + this.floorTileW;
              if (rightEdge > maxX) maxX = rightEdge;
            }
          }
          fs.x = maxX;
        }
      }
    }
  }

  public updateCombo(combo: number) {
    const oldText = this.comboText.text;
    const newText = combo > 0 ? `${combo} COMBO` : '';
    
    if (newText !== oldText) {
      this.comboText.text = newText;
      if (newText !== '') {
        this.comboBounce = 1.3;
      }
    }
  }

  public async initAvatar() {
    const baseUrl = import.meta.env.BASE_URL;
    const prefixes = ['colot', 'hanoko'];
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

    // Load floor texture (sprite sheet with 3 frames side-by-side)
    const floorTex = Assets.cache.get(`${baseUrl}assets/images/floor.png`);
    if (!floorTex) {
      await Assets.load(`${baseUrl}assets/images/floor.png`);
    }
    const floorTexture = Assets.cache.get(`${baseUrl}assets/images/floor.png`);
    if (floorTexture) {
      const sheetWidth = floorTexture.width;
      const sheetHeight = floorTexture.height;
      const floorFrameCount = 3;
      const floorFrameW = Math.floor(sheetWidth / floorFrameCount);
      
      const floorFrameTextures: Texture[] = [];
      for (let fi = 0; fi < floorFrameCount; fi++) {
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = floorFrameW;
        tmpCanvas.height = sheetHeight;
        const tmpCtx = tmpCanvas.getContext('2d')!;
        const floorImg = floorTexture.source.resource as CanvasImageSource;
        tmpCtx.drawImage(floorImg, fi * floorFrameW, 0, floorFrameW, sheetHeight, 0, 0, floorFrameW, sheetHeight);
        
        const imageData = tmpCtx.getImageData(0, 0, floorFrameW, sheetHeight);
        const { data: pixelData } = imageData;
        let floorMinX = floorFrameW, floorMaxX = 0;
        for (let py = 0; py < sheetHeight; py++) {
          for (let px = 0; px < floorFrameW; px++) {
            const alpha = pixelData[(py * floorFrameW + px) * 4 + 3];
            if (alpha > 10) {
              if (px < floorMinX) floorMinX = px;
              if (px > floorMaxX) floorMaxX = px;
            }
          }
        }
        
        const trimW = floorMaxX - floorMinX + 1;
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = trimW;
        cropCanvas.height = sheetHeight;
        const cropCtx = cropCanvas.getContext('2d')!;
        cropCtx.drawImage(tmpCanvas, floorMinX, 0, trimW, sheetHeight, 0, 0, trimW, sheetHeight);
        floorFrameTextures.push(Texture.from(cropCanvas));
      }

      const floorY = 465;
      const floorH = 100;
      const trimmedFrameW = floorFrameTextures[0].width;
      const trimmedFrameH = floorFrameTextures[0].height;
      this.floorTileW = Math.round(floorH * (trimmedFrameW / trimmedFrameH));
      const totalFloorTiles = Math.ceil(2400 / this.floorTileW) + 2;
      
      for (let ti = 0; ti < totalFloorTiles; ti++) {
        const ftex = floorFrameTextures[ti % floorFrameTextures.length];
        const fs = new Sprite(ftex);
        fs.y = floorY;
        fs.width = this.floorTileW;
        fs.height = floorH;
        fs.x = ti * this.floorTileW;
        this.floorContainer.addChild(fs);
        this.floorSprites.push(fs);
      }
    }
  }

  public pauseAvatar() {
    if (this.avatarSprite) {
      this.avatarSprite.stop();
    }
  }

  public resumeAvatar() {
    if (this.avatarSprite) {
      this.avatarSprite.play();
    }
  }

  public triggerAttack(lane?: number | string) {
    if (!this.avatarSprite || this.hitFrames.length === 0) return;
    if (this.activeHoldLane !== null) return; // Prevent attack animation from overriding hold
    
    const prevY = this.baseAvatarY;
    const newY = (lane === 1) ? 250 : 450;
    this.baseAvatarY = newY;
    
    if (prevY === 450 && newY === 250) {
      this.attackSlideY = 7;   // Starts lower, slides UP
    } else if (prevY === 250 && newY === 450) {
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
      if (this.activeHoldLane === null) this.resetToRun();
      this.attackTimeoutId = null;
    }, 300);
  }

  public startHold(lane: number) {
    if (!this.avatarSprite || !this.holdFrame) return;
    
    this.activeHoldLane = lane;
    this.attackSlideY = 0;
    this.attackSlideX = 0;
    if (lane === 1) {
      this.baseAvatarY = 250;
    } else {
      this.baseAvatarY = 450;
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
      this.resetToRun();
    }
  }

  private resetToRun() {
    if (!this.avatarSprite) return;
    this.baseAvatarY = 450;
    this.attackSlideY = 0;
    this.attackSlideX = 0;
    this.avatarSprite.textures = this.runFrames;
    this.avatarSprite.loop = true;
    this.avatarSprite.play();
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
