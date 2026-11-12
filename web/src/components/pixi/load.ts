import { Assets, type Texture } from "pixi.js";

export function loadTexture(url: string): Promise<Texture> {
  return Assets.load<Texture>(url);
}

export function loadTextures(urls: readonly string[]): Promise<Texture[]> {
  return Promise.all(urls.map(loadTexture));
}

/** A texture that a preload step has already put in the asset cache. */
export function cachedTexture(url: string): Texture {
  const texture = Assets.get<Texture | undefined>(url);
  if (!texture) throw new Error(`texture ${url} was not preloaded`);
  return texture;
}
