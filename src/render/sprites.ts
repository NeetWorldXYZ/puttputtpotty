/** Reusable top-down artwork. Loading never blocks play; vector art is the fallback. */
type SpriteName = 'toilet' | 'plunger' | 'paper-roll' | 'sink' | 'plant' | 'janitor';
const images = new Map<SpriteName, CanvasImageSource>();
let loading: Promise<void> | undefined;
let revision = 0;
export function spriteRevision(): number { return revision; }

export function loadGameplaySprites(
  base = import.meta.env.BASE_URL + 'art/gameplay/',
  loader: (url: string) => Promise<CanvasImageSource> = url => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  }),
): Promise<void> {
  if (!loading) loading = Promise.all((['toilet', 'plunger', 'paper-roll', 'sink', 'plant', 'janitor'] as const).map(async name => {
    try { images.set(name, await loader(base + name + '.webp')); revision++; }
    catch { /* Keep the procedural fallback for a missing or offline asset. */ }
  })).then(() => {});
  return loading;
}

export function drawSprite(ctx: CanvasRenderingContext2D, name: SpriteName, x: number, y: number, w: number, h: number): boolean {
  if (!loading && typeof Image !== 'undefined') void loadGameplaySprites();
  const image = images.get(name);
  if (!image) return false;
  ctx.drawImage(image, x, y, w, h);
  return true;
}
