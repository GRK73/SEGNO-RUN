import { Container, Graphics, Text, TextStyle, AnimatedSprite, Texture, Assets, Sprite } from 'pixi.js';
import { CharacterManager } from './CharacterManager';

interface FeverStar {
  g: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotSpeed: number;
  alpha: number;
}

interface FeverNoteItem {
  t: Text;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotSpeed: number;
  alpha: number;
}

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

  // Fever
  private feverGfx: Graphics;           // placeholder kept for z-order slot (not drawn into)
  private feverBgSprite: Sprite | null = null; // pre-rendered background panel
  private feverParticleLayer: Container; // stars + notes (inside HUDContainer, above game notes)
  private feverGaugeGfx: Graphics;
  private feverStars: FeverStar[] = [];
  private feverNoteItems: FeverNoteItem[] = [];
  private feverBgX: number = 0;                                // current x of the sliding bg panel
  private feverBgState: 'off' | 'entering' | 'on' | 'exiting' = 'off';
  private feverParticleAlpha: number = 0;                       // controls star/note visibility
  private feverGaugeValue: number = 0;
  private feverPulse: number = 0;

  // Health
  private healthValue: number = 1; // 0~1 ratio

  // Intro text
  private introText: Text | null = null;
  private introTextHiding: boolean = false;

  constructor(parent: Container, characterManager: CharacterManager) {
    this.characterManager = characterManager;
    this.container = new Container();

    this.floorContainer = new Container();
    this.container.addChildAt(this.floorContainer, 0); // behind everything

    // 판정 원은 노트보다 아래 레이어에 추가 (먼저 삽입 → 나중에 feverGfx가 index 0에 끼어들면 자연히 feverGfx 위로 올라감)
    this.gearGraphics = new Graphics();
    parent.addChildAt(this.gearGraphics, 0);

    this.arcGraphics = new Graphics();
    parent.addChildAt(this.arcGraphics, 0);

    // feverGfx를 arc/gear 삽입 이후 index 0으로 추가
    // → BackgroundManager가 bgContainer를 [0]에 넣으면
    // 최종 순서: [bg(0), feverGfx(1), arc(2), gear(3), ...notes..., HUDContainer]
    // → feverGfx가 arc/gear보다 아래에 렌더링됨 (판정 원 가려지지 않음)
    this.feverGfx = new Graphics();
    parent.addChildAt(this.feverGfx, 0);

    // HUD 메인 컨테이너(아바타, 텍스트 등)는 노트 위에 추가
    parent.addChild(this.container);

    // feverParticleLayer: HUDContainer 안에서 floor 바로 위 (아바타 아래)
    this.feverParticleLayer = new Container();
    this.container.addChild(this.feverParticleLayer);

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

    this.feverGaugeGfx = new Graphics();
    this.container.addChild(this.feverGaugeGfx); // topmost in HUD

    this.initGear();
  }

  public updateHealth(hp: number) {
    this.healthValue = Math.max(0, Math.min(1, hp / 200));
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

    // === Fever overlay ===
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    // === Fever bg slide state machine ===
    if (this.feverBgState === 'entering') {
      // Eased slide-in from right → 0  (빠르게 날아옴)
      this.feverBgX += (0 - this.feverBgX) * 0.20 * _delta;
      if (this.feverBgX <= 2) { this.feverBgX = 0; this.feverBgState = 'on'; } // ← 양수에서 0으로 수렴하므로 <= 2
    } else if (this.feverBgState === 'exiting') {
      // Linear slide-out to left  (스르륵 사라짐)
      this.feverBgX -= 22 * _delta;
      if (this.feverBgX <= -screenW) { this.feverBgX = -screenW; this.feverBgState = 'off'; }
    }

    const feverVisible = this.feverBgState !== 'off';
    const isSpawning  = this.feverBgState === 'entering' || this.feverBgState === 'on';

    // Particle alpha: fade in when active, fade out when exiting/off
    if (isSpawning) {
      this.feverParticleAlpha = Math.min(1, this.feverParticleAlpha + 0.09 * _delta);
      if (Math.random() < 0.40 * _delta && this.feverStars.length < 28) this.spawnFeverStar();
      if (Math.random() < 0.10 * _delta && this.feverNoteItems.length < 14) this.spawnFeverNote();
    } else {
      this.feverParticleAlpha = Math.max(0, this.feverParticleAlpha - 0.012 * _delta);
    }

    // Update stars
    for (let i = this.feverStars.length - 1; i >= 0; i--) {
      const fs = this.feverStars[i];
      fs.x += fs.vx * _delta;
      fs.y += fs.vy * _delta;
      fs.rotation += fs.rotSpeed * _delta;
      fs.alpha -= 0.006 * _delta;
      fs.g.x = fs.x;
      fs.g.y = fs.y;
      fs.g.rotation = fs.rotation;
      fs.g.alpha = Math.max(0, fs.alpha) * this.feverParticleAlpha;
      if (fs.x < -80 || fs.alpha <= 0) {
        this.feverParticleLayer.removeChild(fs.g);
        fs.g.destroy();
        this.feverStars.splice(i, 1);
      }
    }

    // Update note texts
    for (let i = this.feverNoteItems.length - 1; i >= 0; i--) {
      const fn = this.feverNoteItems[i];
      fn.x += fn.vx * _delta;
      fn.y += fn.vy * _delta;
      fn.rotation += fn.rotSpeed * _delta;
      fn.alpha -= 0.005 * _delta;
      fn.t.x = fn.x;
      fn.t.y = fn.y;
      fn.t.rotation = fn.rotation;
      fn.t.alpha = Math.max(0, fn.alpha) * this.feverParticleAlpha;
      if (fn.x < -80 || fn.alpha <= 0) {
        this.feverParticleLayer.removeChild(fn.t);
        fn.t.destroy();
        this.feverNoteItems.splice(i, 1);
      }
    }

    // Fever bg sprite: just update position (texture pre-rendered in startFever)
    this.feverGfx.clear(); // kept empty; only used for z-order slot
    if (this.feverBgSprite) {
      const fadeW = 220;
      this.feverBgSprite.x = this.feverBgX - fadeW;
      this.feverBgSprite.visible = feverVisible;
    }

    // === Trapezoid gauge (bottom center) ===
    // Shape: 600px wide at bottom, inset 35px per side at top, 60px tall
    const trapCX    = screenW / 2;
    const trapW     = 600;
    const trapH     = 60;
    const trapInset = 35;                       // narrower per side at top
    const bY  = screenH;                         // bottom edge y
    const tY  = bY - trapH;                     // top edge y
    const mY  = (bY + tY) / 2;                  // center line y
    const bL  = trapCX - trapW / 2;             // bottom-left x
    const bR  = trapCX + trapW / 2;             // bottom-right x
    const tL  = bL + trapInset;                 // top-left x
    const tR  = bR - trapInset;                 // top-right x
    const mL  = bL + trapInset / 2;             // center-line left x
    const mR  = bR - trapInset / 2;             // center-line right x

    this.feverGaugeGfx.clear();

    // Background
    this.feverGaugeGfx.poly([bL, bY, bR, bY, tR, tY, tL, tY]);
    this.feverGaugeGfx.fill({ color: 0x000000, alpha: 0.6 });

    // --- Fever fill (top half: tY ~ mY) ---
    const isFeverActive = this.feverBgState === 'entering' || this.feverBgState === 'on';
    const feverRatio = isFeverActive ? 1.0 : this.feverGaugeValue;
    if (isFeverActive) {
      this.feverPulse = (this.feverPulse + 0.1 * _delta) % (Math.PI * 2);
    }
    const feverAlpha = isFeverActive ? 0.7 + 0.3 * Math.sin(this.feverPulse) : 0.9;
    if (feverRatio > 0) {
      const rxMid = mL + feverRatio * (mR - mL);
      const rxTop = tL + feverRatio * (tR - tL);
      this.feverGaugeGfx.poly([tL, tY, mL, mY, rxMid, mY, rxTop, tY]);
      this.feverGaugeGfx.fill({ color: 0x2288ff, alpha: feverAlpha });
    }

    // --- Health fill (bottom half: mY ~ bY) ---
    if (this.healthValue > 0) {
      const rr = Math.min(255, Math.round(0xff * (1 - this.healthValue) * 2));
      const gg = Math.min(255, Math.round(0xff * Math.min(1, this.healthValue * 2)));
      const hpColor = (rr << 16) | (gg << 8);
      const rxMidH = mL + this.healthValue * (mR - mL);
      const rxBot  = bL + this.healthValue * trapW;
      this.feverGaugeGfx.poly([mL, mY, rxMidH, mY, rxBot, bY, bL, bY]);
      this.feverGaugeGfx.fill({ color: hpColor, alpha: 0.9 });
    }

    // Center dividing line
    this.feverGaugeGfx.moveTo(mL, mY);
    this.feverGaugeGfx.lineTo(mR, mY);
    this.feverGaugeGfx.stroke({ color: 0xffffff, width: 2, alpha: 0.7 });

    // Outer border (drawn last so it sits on top)
    this.feverGaugeGfx.poly([bL, bY, bR, bY, tR, tY, tL, tY]);
    this.feverGaugeGfx.stroke({ color: 0xffffff, width: 6, alpha: 0.9 });

    // Scroll floor
    if (this.floorTileW > 0) {
      const scrollDelta = this.floorScrollSpeed * 16.6 * _delta;
      const totalW = this.floorSprites.length * this.floorTileW;
      for (const fs of this.floorSprites) {
        fs.x -= scrollDelta;
        if (fs.x + this.floorTileW <= 0) {
          fs.x += totalW;
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

  private buildFeverBgSprite() {
    // Destroy previous if exists
    if (this.feverBgSprite) {
      const tex = this.feverBgSprite.texture;
      this.feverBgSprite.parent?.removeChild(this.feverBgSprite);
      this.feverBgSprite.destroy();
      tex.destroy(true);
      this.feverBgSprite = null;
    }

    const sw = window.innerWidth;
    const sh = window.innerHeight;
    const fadeW = 220;
    const totalW = sw + fadeW * 2;

    // Pre-render gradient + horizontal fade onto a canvas (done once per fever start)
    const canvas = document.createElement('canvas');
    canvas.width  = totalW;
    canvas.height = sh;
    const ctx = canvas.getContext('2d')!;

    // Vertical color gradient: sky-blue top → violet center → sky-blue bottom
    const vGrad = ctx.createLinearGradient(0, 0, 0, sh);
    vGrad.addColorStop(0,   '#40c4ff');
    vGrad.addColorStop(0.5, '#e040fb');
    vGrad.addColorStop(1,   '#40c4ff');
    ctx.fillStyle = vGrad;
    ctx.fillRect(0, 0, totalW, sh);

    // Horizontal alpha fade using destination-out (erase alpha at edges)
    ctx.globalCompositeOperation = 'destination-out';
    const leftGrad = ctx.createLinearGradient(0, 0, fadeW, 0);
    leftGrad.addColorStop(0, 'rgba(0,0,0,1)');
    leftGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = leftGrad;
    ctx.fillRect(0, 0, fadeW, sh);

    const rightGrad = ctx.createLinearGradient(totalW - fadeW, 0, totalW, 0);
    rightGrad.addColorStop(0, 'rgba(0,0,0,0)');
    rightGrad.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = rightGrad;
    ctx.fillRect(totalW - fadeW, 0, fadeW, sh);
    ctx.globalCompositeOperation = 'source-over';

    const tex = Texture.from(canvas);
    const sprite = new Sprite(tex);
    sprite.width  = totalW;
    sprite.height = sh;
    sprite.visible = false;

    // Insert at same z-slot as feverGfx (just above it)
    const parent = this.feverGfx.parent;
    if (parent) {
      const idx = parent.getChildIndex(this.feverGfx);
      parent.addChildAt(sprite, idx + 1);
    }

    this.feverBgSprite = sprite;
  }

  public startFever() {
    // Clear any stale particles from previous fever
    for (const fs of this.feverStars) { this.feverParticleLayer.removeChild(fs.g); fs.g.destroy(); }
    for (const fn of this.feverNoteItems) { this.feverParticleLayer.removeChild(fn.t); fn.t.destroy(); }
    this.feverStars = [];
    this.feverNoteItems = [];
    // Pre-render background texture and start slide-in from right
    this.buildFeverBgSprite();
    this.feverBgX = window.innerWidth;
    this.feverBgState = 'entering';
  }

  public endFever() {
    // Start slide-out to left
    this.feverBgState = 'exiting';
  }

  public updateFeverGauge(value: number) {
    this.feverGaugeValue = value;
  }

  private spawnFeverStar() {
    const colors = [0xffffff, 0xD5BCE1, 0xDCFFFF, 0xFFFFAA, 0xFFD6F5];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = 7 + Math.random() * 20;
    const sW = window.innerWidth;
    const sH = window.innerHeight;

    const g = new Graphics();
    const pts: number[] = [];
    const numPoints = 5;
    for (let i = 0; i < numPoints * 2; i++) {
      const angle = (i * Math.PI) / numPoints - Math.PI / 2;
      const r = i % 2 === 0 ? size : size * 0.42;
      pts.push(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    g.poly(pts);
    g.fill(color);

    const x = sW + 30 + Math.random() * 200;
    const y = 10 + Math.random() * (sH - 20);
    g.x = x;
    g.y = y;
    this.feverParticleLayer.addChild(g);

    this.feverStars.push({
      g, x, y,
      vx: -(5 + Math.random() * 12),
      vy: (Math.random() - 0.5) * 2.5,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.18,
      alpha: 0.65 + Math.random() * 0.35,
    });
  }

  private spawnFeverNote() {
    const chars = ['♩', '♪', '♫', '♬'];
    const colors = ['#ffffff', '#D5BCE1', '#DCFFFF', '#FFD700', '#FFB3F5'];
    const char = chars[Math.floor(Math.random() * chars.length)];
    const colorStr = colors[Math.floor(Math.random() * colors.length)];
    const fontSize = 22 + Math.floor(Math.random() * 32);
    const sW = window.innerWidth;
    const sH = window.innerHeight;

    const t = new Text({ text: char, style: new TextStyle({
      fontSize,
      fill: colorStr,
      fontFamily: 'Arial',
      stroke: { color: '#00000044', width: 2 },
    })});
    t.anchor.set(0.5);

    const x = sW + 40 + Math.random() * 200;
    const y = 15 + Math.random() * (sH - 30);
    t.x = x;
    t.y = y;
    this.feverParticleLayer.addChild(t);

    this.feverNoteItems.push({
      t, x, y,
      vx: -(4 + Math.random() * 10),
      vy: (Math.random() - 0.5) * 2,
      rotation: (Math.random() - 0.5) * 0.6,
      rotSpeed: (Math.random() - 0.5) * 0.10,
      alpha: 0.72 + Math.random() * 0.28,
    });
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
