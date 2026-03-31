import { Container, Graphics, Sprite, Assets, Texture } from 'pixi.js';
import type { NoteData } from './ChartLoader';
import { ObjectPool } from '../core/ObjectPool';
import { CHARACTERS } from './CharacterManager';

export interface ActiveNote {
  id: string;
  data: NoteData;
  sprite: Container;
  isHolding: boolean;
}

// Map characterId to note image index (1-based)
function getNoteImageIndex(characterId?: number): number {
  if (characterId === undefined) return 1;
  // If characterId is 1~4, map to note_1~4.
  // We can just use characterId directly, clamped between 1 and 4.
  if (characterId === 0) return 1;
  return ((characterId - 1) % 4) + 1;
}

function getCharacterColor(characterId?: number): number {
  if (characterId === undefined) return 0xffffff;
  const char = CHARACTERS.find(c => c.id === characterId);
  return char ? char.color : 0xffffff;
}

export class NoteManager {
  private container: Container;
  private effectLayer: Container;
  private activeNotes: ActiveNote[] = [];
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
  private texturesLoaded: boolean = false;

  constructor(parent: Container) {
    this.container = new Container();
    this.effectLayer = new Container();
    parent.addChild(this.container);
    parent.addChild(this.effectLayer);

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
      for (let i = 1; i <= 4; i++) {
        const tex = await Assets.load(`${baseUrl}assets/images/note_${i}.png`);
        this.noteTextures.set(i, tex);
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
    const noteSize = 50;

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
      const holdColor = isHolding ? 0xffff00 : color;
      const bodyAlpha = isHolding ? 0.7 : 0.5;

      // Long note body (colored bar)
      const body = new Graphics();
      body.roundRect(0, -12, bodyWidth, 24, 8);
      body.fill({ color: holdColor, alpha: bodyAlpha });
      body.label = 'body';
      noteContainer.addChild(body);

      // Head sprite
      if (tex && this.texturesLoaded) {
        const head = new Sprite(tex);
        head.anchor.set(0.5);
        head.width = noteSize;
        head.height = noteSize;
        head.label = 'head';
        noteContainer.addChild(head);
      } else {
        const head = new Graphics();
        head.rect(-20, -20, 40, 40);
        head.fill(holdColor);
        head.label = 'head';
        noteContainer.addChild(head);
      }

      // Tail sprite
      if (tex && this.texturesLoaded) {
        const tail = new Sprite(tex);
        tail.anchor.set(0.5);
        tail.width = noteSize * 0.8;
        tail.height = noteSize * 0.8;
        tail.x = bodyWidth;
        tail.label = 'tail';
        noteContainer.addChild(tail);
      } else {
        const tail = new Graphics();
        tail.rect(bodyWidth - 10, -20, 20, 40);
        tail.fill(holdColor);
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
    noteContainer.x = 2000;
    noteContainer.y = this.laneY[data.lane] || 300;

    this.container.addChild(noteContainer);
    this.activeNotes.push({ 
      id: Math.random().toString(36).substr(2, 9), 
      data, 
      sprite: noteContainer, 
      isHolding: false 
    });
  }

  private redrawLongNote(noteContainer: Container, data: NoteData, remainingDuration: number, isHolding: boolean) {
    // Remove existing children
    while (noteContainer.children.length > 0) {
      noteContainer.removeChildAt(0);
    }

    const imgIdx = getNoteImageIndex(data.characterId);
    const color = getCharacterColor(data.characterId);
    const tex = this.noteTextures.get(imgIdx);
    const noteSize = 50;
    const bodyWidth = remainingDuration * this.scrollSpeed;
    const holdColor = isHolding ? 0xffff00 : color;
    const bodyAlpha = isHolding ? 0.7 : 0.5;

    // Body
    const body = new Graphics();
    body.roundRect(0, -12, Math.max(0, bodyWidth), 24, 8);
    body.fill({ color: holdColor, alpha: bodyAlpha });
    noteContainer.addChild(body);

    // Head
    if (tex && this.texturesLoaded) {
      const head = new Sprite(tex);
      head.anchor.set(0.5);
      head.width = noteSize;
      head.height = noteSize;
      if (isHolding) head.tint = 0xffff00;
      noteContainer.addChild(head);
    } else {
      const head = new Graphics();
      head.rect(-20, -20, 40, 40);
      head.fill(holdColor);
      noteContainer.addChild(head);
    }

    // Tail
    if (tex && this.texturesLoaded) {
      const tail = new Sprite(tex);
      tail.anchor.set(0.5);
      tail.width = noteSize * 0.8;
      tail.height = noteSize * 0.8;
      tail.x = Math.max(0, bodyWidth);
      if (isHolding) tail.tint = 0xffff00;
      noteContainer.addChild(tail);
    } else {
      const tail = new Graphics();
      tail.rect(Math.max(0, bodyWidth) - 10, -20, 20, 40);
      tail.fill(holdColor);
      noteContainer.addChild(tail);
    }
  }

  public update(currentTime: number, delta: number) {
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
        }

        // 끝 시간이 지나면 자동 완료
        if (remainingDuration <= 0) {
          // JudgmentSystem에서 처리하도록 함
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
  }

  public setHolding(index: number, isHolding: boolean) {
    if (this.activeNotes[index]) {
      this.activeNotes[index].isHolding = isHolding;
    }
  }

  public removeNote(index: number) {
    if (!this.activeNotes[index]) return;
    const { sprite } = this.activeNotes[index];
    this.container.removeChild(sprite);
    sprite.destroy({ children: true });
    this.activeNotes.splice(index, 1);
  }

  public explodeNote(index: number, isMiss: boolean = false) {
    const note = this.activeNotes[index];
    if (!note) return;
    const { sprite } = note;
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
