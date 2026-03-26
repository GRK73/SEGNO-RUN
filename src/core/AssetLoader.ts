import { Assets, Texture } from 'pixi.js';
import { AudioManager } from './AudioManager';

export class AssetLoader {
  private static textures: Map<string, Texture> = new Map();

  public static async loadAll(
    imageUrls: string[],
    audioUrls: string[]
  ): Promise<void> {
    // Load Images
    for (const url of imageUrls) {
      const texture = await Assets.load(url);
      this.textures.set(url, texture);
    }

    // Load Audios
    const audioManager = AudioManager.getInstance();
    for (const url of audioUrls) {
      await audioManager.loadAudio(url);
    }
  }

  public static getTexture(url: string): Texture | undefined {
    return this.textures.get(url);
  }
}
