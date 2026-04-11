import { Container, Sprite, Texture, Assets } from 'pixi.js';

interface ScrollingItem {
  sprite: Sprite;
  speed: number;
}

const BUILDING_INDICES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

export class BackgroundManager {
  private bgContainer: Container;

  private bgSprite: Sprite | null = null;
  private farLayer: Container;
  private midLayer: Container;
  private bottomContainer: Container;
  private nearLayer: Container;

  private buildingTextures: Texture[] = [];

  private farBuildings: ScrollingItem[] = [];
  private midBuildings: ScrollingItem[] = [];
  private nearBuildings: ScrollingItem[] = [];

  private bottomSprites: Sprite[] = [];
  private bottomTileW: number = 0;
  private bottomScrollSpeed: number = 0.30;

  private screenW: number = 0;
  private screenH: number = 0;

  constructor(parent: Container) {
    this.bgContainer = new Container();
    parent.addChildAt(this.bgContainer, 0);

    this.farLayer = new Container();
    this.midLayer = new Container();
    this.bottomContainer = new Container();
    this.nearLayer = new Container();

    this.bgContainer.addChild(this.farLayer);
    this.bgContainer.addChild(this.midLayer);
    this.bgContainer.addChild(this.bottomContainer);
    this.bgContainer.addChild(this.nearLayer);
  }

  public async init() {
    const baseUrl = import.meta.env.BASE_URL;
    this.screenW = window.innerWidth;
    this.screenH = window.innerHeight;

    // 1. Fixed background (cover 방식 중앙 정렬)
    const bgTex = await Assets.load(`${baseUrl}assets/images/ingamebg/ingamebackground.png`);
    this.bgSprite = new Sprite(bgTex);
    const scaleX = this.screenW / bgTex.width;
    const scaleY = this.screenH / bgTex.height;
    const bgScale = Math.max(scaleX, scaleY);
    this.bgSprite.scale.set(bgScale);
    this.bgSprite.x = Math.round((this.screenW - bgTex.width * bgScale) / 2);
    this.bgSprite.y = Math.round((this.screenH - bgTex.height * bgScale) / 2);
    this.bgContainer.addChildAt(this.bgSprite, 0);

    // 2. Building textures
    const buildingPromises = BUILDING_INDICES.map(i =>
      Assets.load(`${baseUrl}assets/images/ingamebg/building (${i}).png`)
    );
    this.buildingTextures = await Promise.all(buildingPromises);

    // 3. Bottom tiles
    const bottomTex = await Assets.load(`${baseUrl}assets/images/ingamebg/bottom.PNG`);
    this.initBottomTiles(bottomTex);

    // 4. Spawn buildings off-screen right
    this.spawnInitialBuildings();
  }

  private initBottomTiles(tex: Texture) {
    const targetH = 60;
    const aspect = tex.width / tex.height;
    this.bottomTileW = Math.round(targetH * aspect);

    const totalTiles = Math.ceil(this.screenW / this.bottomTileW) + 2;
    const bottomY = this.screenH - targetH;

    for (let i = 0; i < totalTiles; i++) {
      const sp = new Sprite(tex);
      sp.width = this.bottomTileW;
      sp.height = targetH;
      sp.x = i * this.bottomTileW;
      sp.y = bottomY;
      this.bottomContainer.addChild(sp);
      this.bottomSprites.push(sp);
    }
  }

  private spawnInitialBuildings() {
    this.fillLayer(this.farLayer, this.farBuildings, {
      minSpeed: 0.03, maxSpeed: 0.06,
      minScale: 0.26, maxScale: 0.46,
      tint: 0x444444,
      minGap: 200, maxGap: 400,
      yOffset: 58,
    });

    this.fillLayer(this.midLayer, this.midBuildings, {
      minSpeed: 0.10, maxSpeed: 0.20,
      minScale: 0.33, maxScale: 0.52,
      tint: 0x999999,
      minGap: 800, maxGap: 1600,
      yOffset: 58,
    });

    this.fillLayer(this.nearLayer, this.nearBuildings, {
      minSpeed: 0.30, maxSpeed: 0.30,
      minScale: 0.55, maxScale: 0.82,
      tint: 0xffffff,
      minGap: 1000, maxGap: 2500,
      yOffset: 58,
    });
  }

  private fillLayer(
    container: Container,
    items: ScrollingItem[],
    config: {
      minSpeed: number; maxSpeed: number;
      minScale: number; maxScale: number;
      tint: number;
      minGap: number; maxGap: number;
      yOffset: number;
    }
  ) {
    let x = this.screenW + this.randomRange(50, 300);
    const endX = this.screenW + 2000;

    while (x < endX) {
      const tex = this.randomTexture();
      const scale = this.randomRange(config.minScale, config.maxScale);
      const speed = this.randomRange(config.minSpeed, config.maxSpeed);

      const sp = new Sprite(tex);
      sp.anchor.set(0.5, 1);
      sp.scale.set(scale);
      sp.tint = config.tint;
      sp.x = x;
      sp.y = this.screenH - config.yOffset;

      container.addChild(sp);
      items.push({ sprite: sp, speed });

      x += sp.width * scale + this.randomRange(config.minGap, config.maxGap);
    }
  }

  public update(delta: number) {
    const frameFactor = 16.6 * delta;

    // Bottom tiles
    if (this.bottomTileW > 0) {
      const scrollDelta = this.bottomScrollSpeed * frameFactor;
      const totalW = this.bottomSprites.length * this.bottomTileW;
      for (const sp of this.bottomSprites) {
        sp.x -= scrollDelta;
        if (sp.x + this.bottomTileW <= 0) {
          sp.x += totalW;
        }
      }
    }

    // Building layers
    this.updateBuildingLayer(this.farBuildings, frameFactor, {
      minSpeed: 0.03, maxSpeed: 0.06,
      minScale: 0.26, maxScale: 0.46,
      tint: 0x444444,
      minGap: 200, maxGap: 400,
      yOffset: 58,
    });
    this.updateBuildingLayer(this.midBuildings, frameFactor, {
      minSpeed: 0.10, maxSpeed: 0.20,
      minScale: 0.33, maxScale: 0.52,
      tint: 0x999999,
      minGap: 800, maxGap: 1600,
      yOffset: 58,
    });
    this.updateBuildingLayer(this.nearBuildings, frameFactor, {
      minSpeed: 0.30, maxSpeed: 0.30,
      minScale: 0.55, maxScale: 0.82,
      tint: 0xffffff,
      minGap: 1000, maxGap: 2500,
      yOffset: 58,
    });
  }

  private updateBuildingLayer(
    items: ScrollingItem[],
    frameFactor: number,
    config: {
      minSpeed: number; maxSpeed: number;
      minScale: number; maxScale: number;
      tint: number;
      minGap: number; maxGap: number;
      yOffset: number;
    }
  ) {
    for (const item of items) {
      item.sprite.x -= item.speed * frameFactor;
    }

    for (const item of items) {
      const halfW = (item.sprite.width * item.sprite.scale.x) / 2;
      if (item.sprite.x + halfW < -100) {
        let maxRight = 0;
        for (const other of items) {
          const otherRight = other.sprite.x + (other.sprite.width * other.sprite.scale.x) / 2;
          if (otherRight > maxRight) maxRight = otherRight;
        }

        const gap = this.randomRange(config.minGap, config.maxGap);
        const newTex = this.randomTexture();
        const newScale = this.randomRange(config.minScale, config.maxScale);

        item.sprite.texture = newTex;
        item.sprite.scale.set(newScale);
        item.sprite.tint = config.tint;
        item.sprite.x = Math.max(window.innerWidth + 100, maxRight + gap);
        item.sprite.y = this.screenH - config.yOffset;
        item.speed = this.randomRange(config.minSpeed, config.maxSpeed);
      }
    }
  }

  private randomTexture(): Texture {
    return this.buildingTextures[Math.floor(Math.random() * this.buildingTextures.length)];
  }

  private randomRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }
}
