import { Container, Graphics } from 'pixi.js';
import type { NoteData } from './ChartLoader';
import { ObjectPool } from '../core/ObjectPool';

export interface ActiveNote {
  id: string;
  data: NoteData;
  sprite: Graphics;
  isHolding: boolean;
}

export class NoteManager {
  private container: Container;
  private effectLayer: Container;
  private activeNotes: ActiveNote[] = [];
  private notePool: ObjectPool<Graphics>;
  private effectPool: ObjectPool<Graphics>;
  
  private scrollSpeed: number = 0.5;
  private judgmentLineX: number = 250;
  private laneY: { [key: number | string]: number } = {
    0: 400, // Lower (Mouse)
    1: 200, // Upper (Keyboard)
    'any': 300,
  };

  constructor(parent: Container) {
    this.container = new Container();
    this.effectLayer = new Container();
    parent.addChild(this.container);
    parent.addChild(this.effectLayer);

    this.notePool = new ObjectPool<Graphics>(
      () => new Graphics(),
      (g) => { g.clear(); g.visible = false; g.alpha = 1; },
      20
    );

    this.effectPool = new ObjectPool<Graphics>(
      () => new Graphics(),
      (g) => { g.clear(); g.visible = false; g.alpha = 1; },
      20
    );
  }

  public spawnNote(data: NoteData) {
    const sprite = this.notePool.acquire();
    sprite.visible = true;

    this.drawNote(sprite, data, false);
    
    sprite.x = 2000;
    sprite.y = this.laneY[data.lane] || 300;

    this.container.addChild(sprite);
    this.activeNotes.push({ 
      id: Math.random().toString(36).substr(2, 9), 
      data, 
      sprite, 
      isHolding: false 
    });
  }

  private drawNote(sprite: Graphics, data: NoteData, isHolding: boolean) {
    sprite.clear();
    if (data.type === 'normal') {
      sprite.rect(-20, -20, 40, 40);
      sprite.fill(0xffffff);
    } else if (data.type === 'long') {
      const bodyWidth = (data.duration || 0) * this.scrollSpeed;
      
      // 롱노트 몸통 (길이만큼 그리기)
      // 홀딩 중이면 현재 시간부터 끝까지 그림
      sprite.rect(0, -15, bodyWidth, 30);
      sprite.fill({ color: isHolding ? 0xffff00 : 0xffffff, alpha: 0.5 });
      
      // 롱노트 머리
      sprite.rect(-20, -20, 40, 40);
      sprite.fill(isHolding ? 0xffff00 : 0xffffff);
      
      // 롱노트 꼬리
      sprite.rect(bodyWidth - 10, -20, 20, 40);
      sprite.fill(isHolding ? 0xffff00 : 0xffffff);
    } else if (data.type === 'switch_up') {
      sprite.poly([-25, 15, 25, 15, 0, -20]);
      sprite.fill(0x00ff00);
      sprite.stroke({ width: 2, color: 0xffffff });
    } else if (data.type === 'switch_down') {
      sprite.poly([-25, -15, 25, -15, 0, 20]);
      sprite.fill(0xff00ff);
      sprite.stroke({ width: 2, color: 0xffffff });
    }
  }

  public update(currentTime: number, delta: number) {
    for (let i = this.activeNotes.length - 1; i >= 0; i--) {
      const { data, sprite, isHolding } = this.activeNotes[i];
      const noteEndTime = data.time + (data.duration || 0);
      
      if (isHolding) {
        // 홀딩 중이면 머리는 판정선에 고정
        sprite.x = this.judgmentLineX;
        // 몸통 길이를 현재 시간에 맞춰 다시 그림 (단순화를 위해 매 프레임 다시 그림)
        const remainingDuration = noteEndTime - currentTime;
        const bodyWidth = remainingDuration * this.scrollSpeed;
        
        sprite.clear();
        sprite.rect(0, -15, bodyWidth, 30);
        sprite.fill({ color: 0xffff00, alpha: 0.5 });
        sprite.rect(-20, -20, 40, 40);
        sprite.fill(0xffff00);
        sprite.rect(bodyWidth - 10, -20, 20, 40);
        sprite.fill(0xffff00);

        // 끝 시간이 지나면 자동 완료 (판정 시스템에서 처리할 것이지만 안전장치)
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
    this.notePool.release(sprite);
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

    effect.circle(0, 0, 30);
    effect.fill(isMiss ? 0x444444 : 0xffaa00);
    effect.stroke({ width: 4, color: isMiss ? 0x888888 : 0xffffff });

    this.effectLayer.addChild(effect);
    this.removeNote(index);
  }

  public getActiveNotes() {
    return this.activeNotes;
  }
}
