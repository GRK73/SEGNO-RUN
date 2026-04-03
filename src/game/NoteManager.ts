import { Container, Graphics, Sprite, Assets, Texture, Text, TextStyle } from 'pixi.js';
import type { NoteData } from './ChartLoader';
import { ObjectPool } from '../core/ObjectPool';
import { CHARACTERS } from './CharacterManager';

export interface ActiveNote {
  id: string;
  data: NoteData;
  sprite: Container;
  isHolding: boolean;
}

function seededRandom(seed: number) {
  let s = ((seed * 9301 + 49297) % 233280 + 233280) % 233280;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const NOTE_CHARS = ['♩', '♪', '♫', '♬'];

// Map characterId to note image index (0-based: note_0~4)
function getNoteImageIndex(characterId?: number): number {
  if (characterId === undefined) return 0;
  return Math.max(0, Math.min(4, characterId));
}

function getCharacterColor(characterId?: number): number {
  if (characterId === undefined) return 0xffffff;
  const char = CHARACTERS.find(c => c.id === characterId);
  return char ? char.color : 0xffffff;
}

interface FlyingNote {
  sprite: Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
}

interface BurstParticle {
  g: Graphics;
  scale: number;
  alpha: number;
  growSpeed: number;
  fadeSpeed: number;
}

interface StarParticle {
  g: Graphics;
  scale: number;
  alpha: number;
  growSpeed?: number;
  fadeSpeed?: number;
}

interface MiniStar {
  g: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  scale: number;
  shrinkSpeed: number;
}

interface NoteDecoration {
  text: Text;
  timeOffset: number;
  popped: boolean;
  char: string;
  color: number;
  fontSize: number;
}

interface FlyingDecoration {
  text: Text;
  x: number;
  y: number;
  vx: number;
  vy: number;
  scale: number;
  shrinkSpeed: number;
}

export class NoteManager {
  private container: Container;
  private connectionGraphics: Graphics;
  private effectLayer: Container;
  private flyingLayer: Container;
  private burstLayer: Container;
  private starLayer: Container;
  private decorationLayer: Container;
  private noteDecorations: Map<string, NoteDecoration[]> = new Map();
  private flyingDecorations: FlyingDecoration[] = [];
  private activeNotes: ActiveNote[] = [];
  private flyingNotes: FlyingNote[] = [];
  private burstParticles: BurstParticle[] = [];
  private starParticles: StarParticle[] = [];
  private miniStars: MiniStar[] = [];
  private holdBurstTimers: Map<string, number> = new Map();
  private effectPool: ObjectPool<Graphics>;
  
  private scrollSpeed: number = 0.5;
  private judgmentLineX: number = 250;
  private laneY: { [key: number | string]: number } = {
    0: 450, // Lower (Mouse)
    1: 250, // Upper (Keyboard)
    'any': 350,
  };

  // Pre-cached note textures
  private noteTextures: Map<number, Texture> = new Map();
  private longNoteTextures: Map<number, Texture> = new Map();
  private texturesLoaded: boolean = false;

  private holdBurstInterval: number = 125; // ms, BPM에 따라 설정됨

  public setBpm(bpm: number) {
    // 1/4 비트 간격
    this.holdBurstInterval = 60000 / bpm / 4;
  }

  constructor(parent: Container) {
    this.container = new Container();
    this.connectionGraphics = new Graphics();
    this.effectLayer = new Container();
    this.flyingLayer = new Container();
    this.burstLayer = new Container();
    this.decorationLayer = new Container();
    parent.addChild(this.decorationLayer);
    parent.addChild(this.container);
    parent.addChild(this.connectionGraphics);
    parent.addChild(this.burstLayer);
    parent.addChild(this.effectLayer);
    this.starLayer = new Container();
    parent.addChild(this.flyingLayer);
    parent.addChild(this.starLayer);

    this.effectPool = new ObjectPool<Graphics>(
      () => new Graphics(),
      (g) => { g.clear(); g.visible = false; g.alpha = 1; },
      20
    );

    this.loadNoteTextures();
  }

  private async loadNoteTextures() {
    const baseUrl = import.meta.env.BASE_URL;
    try {
      for (let i = 0; i <= 4; i++) {
        const tex = await Assets.load(`${baseUrl}assets/images/note_${i}.png`);
        this.noteTextures.set(i, tex);
      }
      for (let i = 0; i <= 4; i++) {
        const tex = await Assets.load(`${baseUrl}assets/images/long_note_${i}.png`);
        this.longNoteTextures.set(i, tex);
      }
      this.texturesLoaded = true;
    } catch (e) {
      console.warn('Failed to load note textures:', e);
    }
  }

  private createNoteContainer(data: NoteData, isHolding: boolean): Container {
    const noteContainer = new Container();
    const imgIdx = getNoteImageIndex(data.characterId);
    const color = getCharacterColor(data.characterId);
    const tex = this.noteTextures.get(imgIdx);
    const longTex = this.longNoteTextures.get(imgIdx);
    const noteSize = 100;

    if (data.type === 'normal') {
      if (tex && this.texturesLoaded) {
        const sp = new Sprite(tex);
        sp.anchor.set(0.5);
        sp.width = noteSize;
        sp.height = noteSize;
        noteContainer.addChild(sp);
      } else {
        const g = new Graphics();
        g.rect(-20, -20, 40, 40);
        g.fill(color);
        noteContainer.addChild(g);
      }
    } else if (data.type === 'long') {
      const bodyWidth = (data.duration || 0) * this.scrollSpeed;
      const bodyAlpha = isHolding ? 0.7 : 0.5;

      // Long note body (4 parallel bars)
      const body = new Graphics();
      const barOffsets = [-18, -6, 6, 18];
      for (const offsetY of barOffsets) {
        body.roundRect(0, offsetY - 2, bodyWidth, 4, 2);
        body.fill({ color, alpha: bodyAlpha });
      }
      body.label = 'body';
      noteContainer.addChild(body);

      // Head sprite
      if (longTex && this.texturesLoaded) {
        const head = new Sprite(longTex);
        head.anchor.set(0.5);
        head.width = noteSize;
        head.height = noteSize;
        head.label = 'head';
        noteContainer.addChild(head);
      } else {
        const head = new Graphics();
        head.rect(-20, -20, 40, 40);
        head.fill(color);
        head.label = 'head';
        noteContainer.addChild(head);
      }

      // Tail sprite
      if (longTex && this.texturesLoaded) {
        const tail = new Sprite(longTex);
        tail.anchor.set(0.5);
        tail.width = noteSize;
        tail.height = noteSize;
        tail.x = bodyWidth;
        tail.label = 'tail';
        noteContainer.addChild(tail);
      } else {
        const tail = new Graphics();
        tail.rect(bodyWidth - 10, -20, 20, 40);
        tail.fill(color);
        tail.label = 'tail';
        noteContainer.addChild(tail);
      }
    } else if (data.type === 'switch_up') {
      const g = new Graphics();
      g.poly([-25, 15, 25, 15, 0, -20]);
      g.fill(0x00ff00);
      g.stroke({ width: 2, color: 0xffffff });
      noteContainer.addChild(g);
    } else if (data.type === 'switch_down') {
      const g = new Graphics();
      g.poly([-25, -15, 25, -15, 0, 20]);
      g.fill(0xff00ff);
      g.stroke({ width: 2, color: 0xffffff });
      noteContainer.addChild(g);
    }

    return noteContainer;
  }

  public spawnNote(data: NoteData) {
    const noteContainer = this.createNoteContainer(data, false);
    noteContainer.visible = true;
    noteContainer.x = window.innerWidth + 100;
    noteContainer.y = this.laneY[data.lane] || 300;

    this.container.addChild(noteContainer);
    const noteId = Math.random().toString(36).substring(2, 11);
    this.activeNotes.push({ id: noteId, data, sprite: noteContainer, isHolding: false });

    if (data.type === 'long') {
      this.generateDecorations(noteId, data);
    }
  }

  private generateDecorations(noteId: string, data: NoteData) {
    const color = getCharacterColor(data.characterId);
    const rand = seededRandom(data.time + Number(data.lane) * 1000);
    const totalBodyWidth = (data.duration || 0) * this.scrollSpeed;
    const count = Math.max(3, Math.min(14, Math.floor(totalBodyWidth / 65)));
    const baseY = this.laneY[data.lane] ?? 350;
    const decos: NoteDecoration[] = [];

    const segmentWidth = totalBodyWidth / count;
    // 테마색 밝고 진하게
    const br = (color >> 16) & 0xff;
    const bg = (color >> 8) & 0xff;
    const bb = color & 0xff;
    const brightColor = (Math.min(255, Math.floor(br * 1.25 + 45)) << 16)
                      | (Math.min(255, Math.floor(bg * 1.25 + 45)) << 8)
                      |  Math.min(255, Math.floor(bb * 1.25 + 45));

    for (let i = 0; i < count; i++) {
      const dx = (i + 0.5) * segmentWidth; // 구간 중앙 고정
      const dy = (rand() - 0.5) * 16;
      const rot = (rand() - 0.5) * 0.55;
      const char = NOTE_CHARS[Math.floor(rand() * NOTE_CHARS.length)];
      const fontSize = 22 + Math.floor(rand() * 14);

      const t = new Text({ text: char, style: new TextStyle({ fill: brightColor, fontSize, fontFamily: 'Arial' }) });
      t.anchor.set(0.5);
      t.y = baseY + dy;
      t.rotation = rot;
      t.alpha = 0.92;
      this.decorationLayer.addChild(t);
      decos.push({ text: t, timeOffset: dx / this.scrollSpeed, popped: false, char, color: brightColor, fontSize });
    }
    this.noteDecorations.set(noteId, decos);
  }

  private redrawLongNote(noteContainer: Container, data: NoteData, remainingDuration: number, isHolding: boolean) {
    // Save head rotation before clearing
    const existingHead = noteContainer.children.find(c => c.label === 'head');
    const savedHeadRotation = existingHead ? existingHead.rotation : 0;

    // Remove existing children
    while (noteContainer.children.length > 0) {
      noteContainer.removeChildAt(0);
    }

    const imgIdx = getNoteImageIndex(data.characterId);
    const color = getCharacterColor(data.characterId);
    const longTex = this.longNoteTextures.get(imgIdx);
    const noteSize = 100;
    const bodyWidth = remainingDuration * this.scrollSpeed;
    const bodyAlpha = isHolding ? 0.7 : 0.5;

    // Body (4 parallel bars)
    const body = new Graphics();
    const barOffsets = [-18, -6, 6, 18];
    for (const offsetY of barOffsets) {
      body.roundRect(0, offsetY - 2, Math.max(0, bodyWidth), 4, 2);
      body.fill({ color, alpha: bodyAlpha });
    }
    noteContainer.addChild(body);

    // Head
    if (longTex && this.texturesLoaded) {
      const head = new Sprite(longTex);
      head.anchor.set(0.5);
      head.width = noteSize;
      head.height = noteSize;
      head.label = 'head';
      head.rotation = savedHeadRotation;
      noteContainer.addChild(head);
    } else {
      const head = new Graphics();
      head.rect(-20, -20, 40, 40);
      head.fill(color);
      head.label = 'head';
      head.rotation = savedHeadRotation;
      noteContainer.addChild(head);
    }

    // Hold glow (drawn on top of head) — stepped gradient for soft edges
    if (isHolding) {
      const glowSteps = [
        { r: 54, color: color, alpha: 0.04 },
        { r: 48, color: color, alpha: 0.08 },
        { r: 42, color: color, alpha: 0.13 },
        { r: 36, color: color, alpha: 0.19 },
        { r: 29, color: color, alpha: 0.26 },
        { r: 22, color: 0xffffff,  alpha: 0.36 },
        { r: 15, color: 0xffffff,  alpha: 0.52 },
        { r:  9, color: 0xffffff,  alpha: 0.70 },
        { r:  4, color: 0xffffff,  alpha: 0.88 },
      ];
      for (const step of glowSteps) {
        const g = new Graphics();
        g.circle(0, 0, step.r);
        g.fill(step.color);
        g.alpha = step.alpha;
        noteContainer.addChild(g);
      }
    }

    // Tail
    if (longTex && this.texturesLoaded) {
      const tail = new Sprite(longTex);
      tail.anchor.set(0.5);
      tail.width = noteSize;
      tail.height = noteSize;
      tail.x = Math.max(0, bodyWidth);
      noteContainer.addChild(tail);
    } else {
      const tail = new Graphics();
      tail.rect(Math.max(0, bodyWidth) - 10, -20, 20, 40);
      tail.fill(color);
      noteContainer.addChild(tail);
    }
  }

  private drawConnections() {
    const g = this.connectionGraphics;
    g.clear();

    const normals = this.activeNotes.filter(n => n.data.type === 'normal' && !n.isHolding);

    for (let i = 0; i < normals.length; i++) {
      for (let j = i + 1; j < normals.length; j++) {
        const a = normals[i];
        const b = normals[j];
        if (Math.abs(a.data.time - b.data.time) > 15) continue;

        const upper = (a.data.lane === 1) ? a : (b.data.lane === 1) ? b : null;
        const lower = (a.data.lane === 0) ? a : (b.data.lane === 0) ? b : null;
        if (!upper || !lower) continue;

        const x = (upper.sprite.x + lower.sprite.x) / 2 - 7;
        const y1 = this.laneY[1] + 20; // upper note 하단
        const y2 = this.laneY[0] - 20; // lower note 상단
        const charId = upper.data.characterId ?? lower.data.characterId;
        const color = getCharacterColor(charId);

        // 선 2개, 좌우 8px 오프셋
        for (const offsetX of [-8, 8]) {
          g.moveTo(x + offsetX, y1);
          g.lineTo(x + offsetX, y2);
          g.stroke({ width: 5, color, alpha: 0.5 });
        }
      }
    }
  }

  public update(currentTime: number, delta: number) {
    // Note decoration world-position update
    for (const note of this.activeNotes) {
      const decos = this.noteDecorations.get(note.id);
      if (!decos) continue;
      for (const deco of decos) {
        if (deco.popped) continue;
        const wx = this.judgmentLineX + (note.data.time + deco.timeOffset - currentTime) * this.scrollSpeed;
        deco.text.x = wx;
        if (wx < this.judgmentLineX + 5) {
          deco.popped = true;
          deco.text.visible = false;
          const angle = Math.random() * Math.PI * 2;
          const speed = 7 + Math.random() * 9;
          const ft = new Text({ text: deco.char, style: new TextStyle({ fill: deco.color, fontSize: deco.fontSize, fontFamily: 'Arial' }) });
          ft.anchor.set(0.5);
          ft.x = this.judgmentLineX;
          ft.y = deco.text.y;
          ft.rotation = deco.text.rotation;
          ft.alpha = 1.0;
          this.decorationLayer.addChild(ft);
          this.flyingDecorations.push({
            text: ft,
            x: this.judgmentLineX,
            y: deco.text.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 2,
            scale: 1.0,
            shrinkSpeed: 0.028 + Math.random() * 0.018,
          });
        } else {
          deco.text.visible = true;
        }
      }
    }

    this.drawConnections();
    for (let i = this.activeNotes.length - 1; i >= 0; i--) {
      const { data, sprite, isHolding } = this.activeNotes[i];
      const noteEndTime = data.time + (data.duration || 0);
      
      if (isHolding) {
        // 홀딩 중이면 머리는 판정선에 고정
        sprite.x = this.judgmentLineX;
        // 몸통 길이를 현재 시간에 맞춰 다시 그림
        const remainingDuration = noteEndTime - currentTime;

        if (data.type === 'long') {
          this.redrawLongNote(sprite, data, remainingDuration, true);
          // head 회전
          const head = sprite.children.find(c => c.label === 'head');
          if (head) head.rotation += 0.12 * delta;
          // 주기적 버스트 스폰
          const timer = (this.holdBurstTimers.get(this.activeNotes[i].id) ?? 0) + 16.6 * delta;
          if (timer >= this.holdBurstInterval) {
            const x = this.judgmentLineX;
            const y = this.laneY[data.lane] ?? 350;
            this.spawnBurst(x, y, getCharacterColor(data.characterId));
            this.holdBurstTimers.set(this.activeNotes[i].id, 0);
          } else {
            this.holdBurstTimers.set(this.activeNotes[i].id, timer);
          }
        }

      } else {
        sprite.x = this.judgmentLineX + (data.time - currentTime) * this.scrollSpeed;
      }

      // 롱노트나 일반 노트가 완전히 지나가면 제거
      if (this.judgmentLineX + (noteEndTime - currentTime) * this.scrollSpeed < -200) {
        this.explodeNote(i, true); 
      }
    }

    for (let i = this.effectLayer.children.length - 1; i >= 0; i--) {
      const effect = this.effectLayer.children[i] as Graphics;
      effect.alpha -= 0.05 * delta;
      effect.scale.x += 0.05 * delta;
      effect.scale.y += 0.05 * delta;
      if (effect.alpha <= 0) {
        this.effectLayer.removeChild(effect);
        this.effectPool.release(effect);
      }
    }

    // Burst particle animation
    for (let i = this.burstParticles.length - 1; i >= 0; i--) {
      const bp = this.burstParticles[i];
      bp.scale += bp.growSpeed * delta;
      bp.alpha -= bp.fadeSpeed * delta;
      bp.g.scale.set(bp.scale);
      bp.g.alpha = Math.max(0, bp.alpha);
      if (bp.alpha <= 0) {
        this.burstLayer.removeChild(bp.g);
        bp.g.destroy();
        this.burstParticles.splice(i, 1);
      }
    }

    // Star impact animation
    for (let i = this.starParticles.length - 1; i >= 0; i--) {
      const sp = this.starParticles[i];
      sp.scale += (sp.growSpeed ?? 0.12) * delta;
      sp.alpha -= (sp.fadeSpeed ?? 0.07) * delta;
      sp.g.scale.set(sp.scale);
      sp.g.alpha = Math.max(0, sp.alpha);
      if (sp.alpha <= 0) {
        this.starLayer.removeChild(sp.g);
        sp.g.destroy();
        this.starParticles.splice(i, 1);
      }
    }

    // Mini star scatter animation
    for (let i = this.miniStars.length - 1; i >= 0; i--) {
      const ms = this.miniStars[i];
      ms.x += ms.vx * delta;
      ms.y += ms.vy * delta;
      ms.vy += 0.4 * delta;
      ms.scale -= ms.shrinkSpeed * delta;
      ms.g.x = ms.x;
      ms.g.y = ms.y;
      ms.g.rotation += 0.12 * delta;
      ms.g.scale.set(Math.max(0, ms.scale));
      if (ms.scale <= 0) {
        this.starLayer.removeChild(ms.g);
        ms.g.destroy();
        this.miniStars.splice(i, 1);
      }
    }

    // Flying decoration animation
    for (let i = this.flyingDecorations.length - 1; i >= 0; i--) {
      const fd = this.flyingDecorations[i];
      fd.x += fd.vx * delta;
      fd.y += fd.vy * delta;
      fd.vy += 0.35 * delta;
      fd.scale -= fd.shrinkSpeed * delta;
      fd.text.x = fd.x;
      fd.text.y = fd.y;
      fd.text.rotation += 0.1 * delta;
      fd.text.scale.set(Math.max(0, fd.scale));
      if (fd.scale <= 0) {
        this.decorationLayer.removeChild(fd.text);
        fd.text.destroy();
        this.flyingDecorations.splice(i, 1);
      }
    }

    // Flying note parabolic animation
    for (let i = this.flyingNotes.length - 1; i >= 0; i--) {
      const fn = this.flyingNotes[i];
      fn.vy += 1.2 * delta;   // gravity
      fn.x += fn.vx * delta;
      fn.y += fn.vy * delta;
      fn.sprite.x = fn.x;
      fn.sprite.y = fn.y;
      fn.sprite.rotation += 0.18 * delta;
      fn.alpha -= 0.045 * delta;
      fn.sprite.alpha = Math.max(0, fn.alpha);
      if (fn.alpha <= 0) {
        this.flyingLayer.removeChild(fn.sprite);
        fn.sprite.destroy();
        this.flyingNotes.splice(i, 1);
      }
    }
  }

  private spawnStarEffect(x: number, y: number, color: number) {
    const g = new Graphics();
    const outerR = 38;
    const innerR = 16;
    const points = 6;
    const totalPts = points * 2;
    const baseRotation = Math.random() * Math.PI * 2;
    const pts: number[] = [];

    for (let i = 0; i < totalPts; i++) {
      const angle = baseRotation + (i * Math.PI) / points;
      const r = i % 2 === 0
        ? outerR * (0.75 + Math.random() * 0.5)   // 외각 불규칙
        : innerR * (0.7 + Math.random() * 0.5);    // 내각 불규칙
      pts.push(Math.cos(angle) * r, Math.sin(angle) * r);
    }

    g.poly(pts);
    g.fill(color);
    g.poly(pts);
    g.stroke({ width: 6, color: 0xffffff });
    g.x = x;
    g.y = y;
    g.scale.set(0.6);
    g.alpha = 0.92;
    this.starLayer.addChild(g);
    this.starParticles.push({ g, scale: 0.6, alpha: 0.92 });
  }

  private spawnRayBurst(x: number, y: number, color: number) {
    const g = new Graphics();
    const count = 8;
    const innerR = 30;
    const outerR = 46;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      g.moveTo(cos * innerR, sin * innerR);
      g.lineTo(cos * outerR, sin * outerR);
      g.stroke({ width: 2.5, color });
    }
    g.x = x;
    g.y = y;
    g.scale.set(0.75);
    g.alpha = 0.9;
    this.starLayer.addChild(g);
    this.starParticles.push({ g, scale: 0.75, alpha: 0.9, growSpeed: 0.18, fadeSpeed: 0.11 });
  }

  private spawnMiniStars(x: number, y: number, color: number) {
    const count = 7 + Math.floor(Math.random() * 4); // 7~10개
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;

    for (let i = 0; i < count; i++) {
      const gr = new Graphics();
      const size = 8 + Math.random() * 14;
      const outerR = size;
      const innerR = size * 0.68;
      const points = 5;
      const pts: number[] = [];
      for (let j = 0; j < points * 2; j++) {
        const angle = (j * Math.PI) / points - Math.PI / 2;
        const radius = j % 2 === 0 ? outerR : innerR;
        pts.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }

      // 테마색 근방 색상 랜덤 변형
      const cr = Math.min(255, Math.max(0, r + Math.floor(Math.random() * 80 - 30)));
      const cg = Math.min(255, Math.max(0, g + Math.floor(Math.random() * 80 - 30)));
      const cb = Math.min(255, Math.max(0, b + Math.floor(Math.random() * 80 - 30)));
      const varColor = (cr << 16) | (cg << 8) | cb;

      gr.poly(pts);
      gr.fill(varColor);
      gr.x = x;
      gr.y = y;
      gr.rotation = Math.random() * Math.PI * 2;

      const angle = Math.random() * Math.PI * 2;
      const speed = 8 + Math.random() * 12;

      this.starLayer.addChild(gr);
      this.miniStars.push({
        g: gr,
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        scale: 1.0,
        shrinkSpeed: 0.025 + Math.random() * 0.02,
      });
    }
  }

  private spawnBurst(x: number, y: number, color: number, isFlash: boolean = false) {
    if (isFlash) {
      // 흰 빛 플래시: 적당한 크기에서 빠르게 퍼지며 사라짐
      const g = new Graphics();
      g.circle(0, 0, 35);
      g.fill(0xffffff);
      g.x = x;
      g.y = y;
      g.scale.set(1.0);
      g.alpha = 1.0;
      this.burstLayer.addChild(g);
      this.burstParticles.push({ g, scale: 1.0, alpha: 1.0, growSpeed: 0.12, fadeSpeed: 0.10 });
    } else {
      // 테두리 원 2개: 중앙에서 퍼지며 사라짐
      for (let i = 0; i < 2; i++) {
        const g = new Graphics();
        const radius = 25 + i * 10;
        g.circle(0, 0, radius);
        g.stroke({ width: 5, color });
        g.x = x;
        g.y = y;
        g.scale.set(1.0);
        g.alpha = 1.0;
        this.burstLayer.addChild(g);
        this.burstParticles.push({ g, scale: 1.0, alpha: 1.0, growSpeed: 0.10, fadeSpeed: 0.07 });
      }
    }
  }

  public setHolding(index: number, isHolding: boolean) {
    if (this.activeNotes[index]) {
      const wasHolding = this.activeNotes[index].isHolding;
      this.activeNotes[index].isHolding = isHolding;
      if (isHolding && !wasHolding) {
        // 홀딩 시작 플래시
        const note = this.activeNotes[index];
        const x = this.judgmentLineX;
        const y = this.laneY[note.data.lane] ?? 350;
        const color = getCharacterColor(note.data.characterId);
        this.spawnBurst(x, y, color, true);
        this.spawnRayBurst(x, y, color);
        this.spawnMiniStars(x, y, color);
        this.holdBurstTimers.set(note.id, 0);
      }
      if (!isHolding) {
        const note = this.activeNotes[index];
        if (note) this.holdBurstTimers.delete(note.id);
      }
    }
  }

  public removeNote(index: number) {
    if (!this.activeNotes[index]) return;
    const { id, sprite } = this.activeNotes[index];
    const decos = this.noteDecorations.get(id);
    if (decos) {
      for (const d of decos) {
        if (!d.popped) {
          this.decorationLayer.removeChild(d.text);
          d.text.destroy();
        }
      }
      this.noteDecorations.delete(id);
    }
    this.container.removeChild(sprite);
    sprite.destroy({ children: true });
    this.activeNotes.splice(index, 1);
  }

  public explodeNote(index: number, isMiss: boolean = false) {
    const note = this.activeNotes[index];
    if (!note) return;
    const { sprite } = note;

    // 일반 노트 히트: 포물선 비행 이펙트
    if (!isMiss && note.data.type === 'normal') {
      const color = getCharacterColor(note.data.characterId);
      this.spawnStarEffect(sprite.x, sprite.y, color);
      this.spawnRayBurst(sprite.x, sprite.y, color);
      this.spawnMiniStars(sprite.x, sprite.y, color);

      const imgIdx = getNoteImageIndex(note.data.characterId);
      const tex = this.noteTextures.get(imgIdx);
      if (tex) {
        const flySprite = new Sprite(tex);
        flySprite.anchor.set(0.5);
        flySprite.width = 100;
        flySprite.height = 100;
        flySprite.x = sprite.x;
        flySprite.y = sprite.y;
        this.flyingLayer.addChild(flySprite);
        this.flyingNotes.push({
          sprite: flySprite,
          x: sprite.x,
          y: sprite.y,
          vx: (Math.random() * 4 - 2),       // 좌우 약간 랜덤
          vy: -(10 + Math.random() * 6),       // 빠르게 위로
          alpha: 1,
        });
        this.removeNote(index);
        return;
      }
    }

    // 미스 or 롱노트: 원형 이펙트
    const effect = this.effectPool.acquire();
    effect.visible = true;
    effect.x = sprite.x;
    effect.y = sprite.y;
    effect.alpha = 1;
    effect.scale.set(1);

    const color = getCharacterColor(note.data.characterId);
    effect.circle(0, 0, 30);
    effect.fill(isMiss ? 0x444444 : color);
    effect.stroke({ width: 4, color: isMiss ? 0x888888 : 0xffffff });

    this.effectLayer.addChild(effect);
    this.removeNote(index);
  }

  public getActiveNotes() {
    return this.activeNotes;
  }
}
