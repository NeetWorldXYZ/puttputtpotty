import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/game/music', () => ({ stinger: vi.fn() }));

class FakeContext {
  static last: FakeContext;
  state = 'running'; currentTime = 0; destination = {};
  gain = { value: .8, cancelScheduledValues: vi.fn() };
  suspend = vi.fn(async () => { this.state = 'suspended'; });
  resume = vi.fn(async () => { this.state = 'running'; });
  constructor() { FakeContext.last = this; }
  createGain() { return { gain: this.gain, connect: vi.fn() }; }
}
let win: EventTarget; let doc: EventTarget & { hidden: boolean; visibilityState: string };
let saved: Map<string,string>;
beforeEach(() => {
  vi.resetModules(); saved = new Map();
  win = new EventTarget(); Object.assign(win, { AudioContext: FakeContext });
  doc = Object.assign(new EventTarget(), { hidden:false, visibilityState:'visible' });
  vi.stubGlobal('window',win);vi.stubGlobal('document',doc);vi.stubGlobal('AudioContext',FakeContext);
  vi.stubGlobal('navigator',{ audioSession: {type:'auto'} });
  vi.stubGlobal('Audio',class {setAttribute() {} volume=0;play(){return Promise.resolve();} pause() {}});
  vi.stubGlobal('localStorage',{getItem:(k:string)=>saved.get(k),setItem:(k:string,v:string)=>saved.set(k,v)});
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false}));
});
afterEach(() => vi.unstubAllGlobals());
function hidden(value:boolean) { doc.hidden=value;doc.visibilityState=value?'hidden':'visible';doc.dispatchEvent(new Event('visibilitychange')); }

describe('foreground-only game audio', () => {
  it('silences and suspends on app switch, then restores audio on return',async () => {
    const audio=await import('../src/game/sound');audio.unlockAudio();const ctx=FakeContext.last;
    hidden(true);expect(ctx.gain.value).toBe(0);expect(ctx.suspend).toHaveBeenCalled();
    audio.unlockAudio();expect(ctx.resume).not.toHaveBeenCalled();
    hidden(false);await Promise.resolve();expect(ctx.resume).toHaveBeenCalled();expect(ctx.gain.value).toBe(.8);
  });
  it('retains manual mute across pagehide/pageshow without persisting background mute',async () => {
    const audio=await import('../src/game/sound');audio.unlockAudio();audio.setMuted(true);
    win.dispatchEvent(new Event('pagehide'));win.dispatchEvent(new Event('pageshow'));
    expect(audio.isMuted()).toBe(true);expect(FakeContext.last.gain.value).toBe(0);expect(saved.get('ppp.mute.v1')).toBe('1');
    audio.setMuted(false);hidden(true);expect(saved.get('ppp.mute.v1')).toBe('0');expect(FakeContext.last.gain.value).toBe(0);
  });
  it('re-suspends if a delayed resume completes after the app is hidden again',async () => {
    const audio=await import('../src/game/sound');audio.unlockAudio();const ctx=FakeContext.last;hidden(true);
    let finish!:()=>void;ctx.resume.mockImplementation(()=>new Promise<void>(resolve=>{finish=()=>{ctx.state='running';resolve();};}));
    hidden(false);hidden(true);finish();await Promise.resolve();await Promise.resolve();
    expect(ctx.state).toBe('suspended');expect(ctx.gain.value).toBe(0);
  });
  it('pauses on lost focus and resumes only while visible',async () => {
    const audio=await import('../src/game/sound');audio.unlockAudio();const ctx=FakeContext.last;
    win.dispatchEvent(new Event('blur'));expect(ctx.state).toBe('suspended');
    hidden(true);win.dispatchEvent(new Event('focus'));expect(ctx.resume).not.toHaveBeenCalled();
  });
});
