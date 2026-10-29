import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/game/music', () => ({ stinger: vi.fn() }));

const param = () => ({ value: .8, cancelScheduledValues: vi.fn(), setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
class FakeNode extends EventTarget {
  gain = param(); frequency = param(); Q = param();
  connect = vi.fn(); disconnect = vi.fn(); start = vi.fn(); stop = vi.fn();
}
class FakeContext extends EventTarget {
  static last: FakeContext;
  static created = 0;
  static initiallySuspended = false;
  static sessionAtCreation: string | undefined;
  state = FakeContext.initiallySuspended ? 'suspended' : 'running';
  currentTime = 0; sampleRate = 44100; destination = {};
  gain = param(); sources: FakeNode[] = []; private gains = 0;
  suspend = vi.fn(async () => { this.state = 'suspended'; this.dispatchEvent(new Event('statechange')); });
  resume = vi.fn(async () => { this.state = 'running'; this.dispatchEvent(new Event('statechange')); });
  constructor() {
    super(); FakeContext.last = this; FakeContext.created++;
    FakeContext.sessionAtCreation = (navigator as unknown as {audioSession?:{type:string}}).audioSession?.type;
  }
  createGain() { const node = new FakeNode(); if (!this.gains++) node.gain = this.gain; return node; }
  createOscillator() { const node = new FakeNode(); this.sources.push(node); return node; }
  createBufferSource() { return this.createOscillator(); }
  createBiquadFilter() { return new FakeNode(); }
  createBuffer(_channels: number, length: number) { return { getChannelData: () => new Float32Array(length) }; }
}
class FakeAudio extends EventTarget {
  static last: FakeAudio; static created = 0;
  loop = false; preload = ''; paused = true; error = null;
  play = vi.fn(async () => { this.paused = false; });
  pause = vi.fn(() => {
    if (this.paused) return;
    this.paused = true;
    // Real media events are queued, unlike the pause() method itself.
    Promise.resolve().then(() => this.dispatchEvent(new Event('pause')));
  });
  load = vi.fn();
  constructor(public src: string) { super(); FakeAudio.last = this; FakeAudio.created++; }
}
let win: EventTarget; let doc: EventTarget & { hidden: boolean };
let session: EventTarget & { type: string; state: string };
let saved: Map<string, string>;
const inputs = ['touchstart', 'touchend', 'pointerdown', 'mousedown', 'click', 'keydown'];
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); saved = new Map();
  FakeContext.created = 0; FakeContext.initiallySuspended = false; FakeAudio.created = 0;
  win = Object.assign(new EventTarget(), { AudioContext: FakeContext });
  doc = Object.assign(new EventTarget(), { hidden: false });
  session = Object.assign(new EventTarget(), { type: 'auto', state: 'active' });
  vi.stubGlobal('window', win); vi.stubGlobal('document', doc); vi.stubGlobal('AudioContext', FakeContext);
  vi.stubGlobal('navigator', { audioSession: session }); vi.stubGlobal('Audio', FakeAudio);
  vi.stubGlobal('localStorage', { getItem: (k: string) => saved.get(k), setItem: (k: string, v: string) => saved.set(k, v) });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
function hidden(value: boolean) { doc.hidden = value; doc.dispatchEvent(new Event('visibilitychange')); }
function tapAll() { for (const event of inputs) win.dispatchEvent(new Event(event)); }
async function settled() { for (let i = 0; i < 8; i++) await Promise.resolve(); }
async function menu() {
  const sound = await import('../src/game/sound');
  const leave = sound.acquireMenuMusic(); sound.unlockAudio();
  return { sound, leave, media: FakeAudio.last };
}
async function effect() {
  const sound = await import('../src/game/sound'); sound.unlockAudio(); sound.sfx.tap();
  return { sound, ctx: FakeContext.last };
}

describe('native menu music', () => {
  it('uses one looping media element and no live/offline audio engine on menu taps', async () => {
    const offline = vi.fn(); vi.stubGlobal('OfflineAudioContext', offline);
    const { media } = await menu(); tapAll();
    expect(media.src).toMatch(/audio\/potty-theme-v1\.m4a$/);
    expect(media.loop).toBe(true); expect(media.play).toHaveBeenCalledOnce();
    expect(FakeAudio.created).toBe(1); expect(FakeContext.created).toBe(0);
    expect(offline).not.toHaveBeenCalled(); expect(session.type).toBe('auto');
  });
  it('does not start audio just for opening a menu or tapping outside a menu', async () => {
    const sound = await import('../src/game/sound');
    tapAll(); expect(FakeAudio.created).toBe(0); expect(FakeContext.created).toBe(0);
    sound.setMuted(true); sound.acquireMenuMusic(); tapAll();
    expect(FakeAudio.created).toBe(0); expect(FakeContext.created).toBe(0);
  });
  it('keeps the tune continuous across tab swaps and stops throughout gameplay', async () => {
    const { sound, leave, media } = await menu();
    leave(); const leaveNext = sound.acquireMenuMusic(); await settled();
    expect(media.pause).not.toHaveBeenCalled(); expect(media.play).toHaveBeenCalledOnce();
    leaveNext(); await settled(); expect(media.paused).toBe(true);
    tapAll(); hidden(true); hidden(false); await settled();
    expect(media.play).toHaveBeenCalledOnce(); expect(sound.isMuted()).toBe(false);
  });
  it('pauses in the background and returns only to a menu, without a Web Audio resume', async () => {
    const { media, sound } = await menu();
    hidden(true); await settled(); expect(media.paused).toBe(true);
    tapAll(); expect(media.play).toHaveBeenCalledOnce();
    hidden(false); await settled(); expect(media.play).toHaveBeenCalledTimes(2);
    expect(FakeContext.created).toBe(0); expect(sound.isMuted()).toBe(false);
  });
  it('ignores focus changes while the app is visible', async () => {
    const { media } = await menu(); win.dispatchEvent(new Event('blur')); win.dispatchEvent(new Event('focus'));
    expect(media.pause).not.toHaveBeenCalled(); expect(media.play).toHaveBeenCalledOnce();
  });
  it('retains saved mute through input and page lifecycle events', async () => {
    saved.set('ppp.mute.v1', '1');
    const sound = await import('../src/game/sound'); sound.acquireMenuMusic(); tapAll();
    expect(FakeAudio.created).toBe(0); expect(FakeContext.created).toBe(0);
    sound.setMuted(false); const media = FakeAudio.last; expect(media.paused).toBe(false);
    sound.setMuted(true); win.dispatchEvent(new Event('pagehide')); win.dispatchEvent(new Event('pageshow')); tapAll();
    await settled(); expect(media.paused).toBe(true); expect(saved.get('ppp.mute.v1')).toBe('1');
    expect(FakeContext.created).toBe(0);
  });
  it('yields to an external media pause until sound is explicitly enabled', async () => {
    const { sound, media } = await menu(); media.pause(); await settled();
    expect(sound.isMuted()).toBe(true); expect(saved.has('ppp.mute.v1')).toBe(false);
    tapAll(); hidden(true); hidden(false); await settled(); expect(media.play).toHaveBeenCalledOnce();
    sound.setMuted(false); await settled(); expect(media.play).toHaveBeenCalledTimes(2);
    expect(sound.isMuted()).toBe(false);
  });
  it('does not retry a failed play on every tap', async () => {
    const { sound, media } = await menu(); sound.setMuted(true); await settled();
    media.play.mockRejectedValueOnce(new Error('route unavailable'));
    sound.setMuted(false); await settled(); tapAll();
    expect(sound.isMuted()).toBe(true); expect(media.play).toHaveBeenCalledTimes(2);
    sound.setMuted(false); await settled(); expect(media.play).toHaveBeenCalledTimes(3);
  });
  it('stops a slow play completion after the player leaves the menu', async () => {
    const { sound, media, leave } = await menu(); sound.setMuted(true); await settled();
    let finish!: () => void;
    media.play.mockImplementationOnce(() => new Promise<void>(resolve => { finish = () => { media.paused = false; resolve(); }; }));
    sound.setMuted(false); leave(); await settled(); finish(); await settled();
    expect(media.paused).toBe(true); expect(sound.isMuted()).toBe(false);
  });
  it('ignores a rejected obsolete play attempt after a newer one succeeds', async () => {
    const { sound, media } = await menu(); sound.setMuted(true); await settled();
    let reject!: (e: Error) => void;
    media.play.mockImplementationOnce(() => new Promise<void>((_, no) => { reject = no; }));
    sound.setMuted(false); hidden(true); hidden(false); await settled();
    reject(new Error('old play aborted')); await settled();
    expect(sound.isMuted()).toBe(false); expect(media.paused).toBe(false);
  });
});

describe('effects context lifecycle', () => {
  it('creates effects only for an actual sound and releases playback after it ends', async () => {
    const { sound, ctx } = await effect();
    expect(FakeContext.created).toBe(1); expect(FakeContext.sessionAtCreation).toBe('playback');
    expect(sound.getAudio()).not.toBeNull(); expect(FakeAudio.created).toBe(0);
    await vi.advanceTimersByTimeAsync(2000);
    expect(ctx.state).toBe('suspended'); expect(session.type).toBe('auto'); expect(sound.isMuted()).toBe(false);
    tapAll(); expect(ctx.resume).not.toHaveBeenCalled();
    sound.sfx.tap(); await settled(); expect(ctx.resume).toHaveBeenCalledOnce(); expect(FakeContext.created).toBe(1);
  });
  it('lets native music continue when idle effects suspend, with no playback override', async () => {
    const { sound, media } = await menu(); sound.sfx.tap();
    expect(FakeContext.sessionAtCreation).toBe('auto');
    await vi.advanceTimersByTimeAsync(2000);
    expect(FakeContext.last.state).toBe('suspended'); expect(media.paused).toBe(false);
    expect(media.play).toHaveBeenCalledOnce(); expect(sound.isMuted()).toBe(false);
  });
  it('waits for delayed notes and long stingers before sleeping', async () => {
    const { sound, ctx } = await effect(); sound.sfx.stinger('ace');
    await vi.advanceTimersByTimeAsync(4000); expect(ctx.suspend).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000); expect(ctx.state).toBe('suspended');
  });
  it('cancels scheduled sources on backgrounding and does not replay them on return', async () => {
    const { sound, ctx } = await effect(); sound.sfx.jingle(); const sources = [...ctx.sources];
    hidden(true); await settled(); expect(ctx.state).toBe('suspended');
    for (const source of sources) expect(source.disconnect).toHaveBeenCalled();
    hidden(false); await settled(); expect(ctx.resume).not.toHaveBeenCalled();
    sound.sfx.tap(); await settled(); expect(ctx.resume).toHaveBeenCalledOnce();
  });
  it('does not allocate audio while hidden or before a gesture', async () => {
    const sound = await import('../src/game/sound'); sound.sfx.tap(); expect(FakeContext.created).toBe(0);
    hidden(true); tapAll(); sound.sfx.tap(); expect(FakeContext.created).toBe(0);
  });
  it('resumes an initially suspended context inside the actual effect gesture', async () => {
    FakeContext.initiallySuspended = true;
    const { ctx } = await effect(); await settled(); expect(ctx.resume).toHaveBeenCalledOnce(); expect(ctx.state).toBe('running');
  });
  it('yields to context interruption without reclaiming it on input or another effect', async () => {
    vi.stubGlobal('navigator', {});
    const { sound, ctx } = await effect(); ctx.state = 'interrupted'; ctx.dispatchEvent(new Event('statechange')); await settled();
    tapAll(); sound.sfx.tap(); hidden(true); hidden(false); await settled();
    expect(sound.isMuted()).toBe(true); expect(ctx.resume).not.toHaveBeenCalled(); expect(saved.has('ppp.mute.v1')).toBe(false);
    sound.setMuted(false); sound.sfx.tap(); await settled(); expect(ctx.resume).toHaveBeenCalledOnce();
  });
  it('yields to session interruption and ignores inactive/active notifications', async () => {
    const { sound, ctx } = await effect();
    session.state = 'interrupted'; session.dispatchEvent(new Event('statechange')); await settled();
    session.state = 'active'; session.dispatchEvent(new Event('statechange')); tapAll();
    expect(sound.isMuted()).toBe(true); expect(ctx.resume).not.toHaveBeenCalled(); expect(session.type).toBe('auto');
    sound.setMuted(false); sound.sfx.tap(); await settled(); expect(ctx.state).toBe('running');
  });
  it('treats unexpected suspension during an effect as an interruption, not idle', async () => {
    const { sound, ctx } = await effect(); ctx.state = 'suspended'; ctx.dispatchEvent(new Event('statechange')); await settled();
    expect(sound.isMuted()).toBe(true); tapAll(); sound.sfx.tap(); expect(ctx.resume).not.toHaveBeenCalled();
  });
  it.each(['hidden', 'muted', 'interrupted'])('re-suspends if pending resume completes after becoming %s', async reason => {
    const { sound, ctx } = await effect(); await vi.advanceTimersByTimeAsync(2000);
    let finish!: () => void;
    ctx.resume.mockImplementationOnce(() => new Promise<void>(resolve => { finish = () => { ctx.state = 'running'; resolve(); }; }));
    sound.sfx.tap(); sound.sfx.select(); expect(ctx.resume).toHaveBeenCalledOnce();
    if (reason === 'hidden') hidden(true);
    else if (reason === 'muted') sound.setMuted(true);
    else { session.state = 'interrupted'; session.dispatchEvent(new Event('statechange')); }
    finish(); await settled(); expect(ctx.state).toBe('suspended'); expect(ctx.gain.value).toBe(0); expect(session.type).toBe('auto');
  });
  it('does not retry a rejected effects resume until explicitly enabled', async () => {
    const { sound, ctx } = await effect(); await vi.advanceTimersByTimeAsync(2000);
    ctx.resume.mockRejectedValueOnce(new Error('route unavailable')); sound.sfx.tap(); await settled();
    tapAll(); sound.sfx.tap(); expect(ctx.resume).toHaveBeenCalledOnce(); expect(sound.isMuted()).toBe(true);
    sound.setMuted(false); sound.sfx.tap(); await settled(); expect(ctx.resume).toHaveBeenCalledTimes(2);
  });
  it('stops an unexpected context restart while muted', async () => {
    const { sound, ctx } = await effect(); sound.setMuted(true); await settled();
    ctx.state = 'running'; ctx.dispatchEvent(new Event('statechange')); await settled();
    expect(ctx.state).toBe('suspended'); expect(ctx.gain.value).toBe(0); expect(session.type).toBe('auto');
  });
  it.each(['absent', 'unsupported'])('supports effects when audioSession is %s', async mode => {
    if (mode === 'absent') vi.stubGlobal('navigator', {});
    else Object.defineProperty(session, 'type', { get: () => 'auto', set: () => { throw new Error('unsupported'); } });
    const { ctx } = await effect(); expect(ctx.state).toBe('running');
  });
});
