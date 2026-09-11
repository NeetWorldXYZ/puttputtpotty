import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/game/music', () => ({ stinger: vi.fn(), primeTheme: vi.fn() }));

class FakeContext {
  static last: FakeContext;
  static created = 0;
  state = 'running'; currentTime = 0; destination = {};
  gain = { value: .8, cancelScheduledValues: vi.fn() };
  suspend = vi.fn(async () => { this.state = 'suspended'; });
  resume = vi.fn(async () => { this.state = 'running'; });
  constructor() { FakeContext.last = this; FakeContext.created++; }
  createGain() { return { gain: this.gain, connect: vi.fn() }; }
}
let win: EventTarget; let doc: EventTarget & { hidden: boolean; visibilityState: string };
let session: EventTarget & { type: string; state: string };
let saved: Map<string,string>;
const inputs = ['touchstart', 'touchend', 'pointerdown', 'mousedown', 'click', 'keydown'];
beforeEach(() => {
  vi.resetModules(); saved = new Map(); FakeContext.created = 0;
  win = new EventTarget(); Object.assign(win, { AudioContext: FakeContext });
  doc = Object.assign(new EventTarget(), { hidden:false, visibilityState:'visible' });
  session = Object.assign(new EventTarget(), { type:'auto', state:'active' });
  vi.stubGlobal('window',win);vi.stubGlobal('document',doc);vi.stubGlobal('AudioContext',FakeContext);
  vi.stubGlobal('navigator',{ audioSession: session });
  vi.stubGlobal('Audio',vi.fn());
  vi.stubGlobal('localStorage',{getItem:(k:string)=>saved.get(k),setItem:(k:string,v:string)=>saved.set(k,v)});
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false}));
});
afterEach(() => vi.unstubAllGlobals());
function hidden(value:boolean) { doc.hidden=value;doc.visibilityState=value?'hidden':'visible';doc.dispatchEvent(new Event('visibilitychange')); }
async function settled() { for(let i=0;i<4;i++) await Promise.resolve(); }

describe('foreground-only game audio', () => {
  it('silences and suspends on app switch, then restores audio on return',async () => {
    const audio=await import('../src/game/sound');audio.unlockAudio();const ctx=FakeContext.last;
    hidden(true);expect(ctx.gain.value).toBe(0);expect(ctx.suspend).toHaveBeenCalled();
    audio.unlockAudio();expect(ctx.resume).not.toHaveBeenCalled();
    hidden(false);await settled();expect(ctx.resume).toHaveBeenCalledOnce();expect(ctx.gain.value).toBe(.8);
  });
  it('retains manual mute across pagehide/pageshow without persisting background mute',async () => {
    const audio=await import('../src/game/sound');audio.unlockAudio();audio.setMuted(true);
    win.dispatchEvent(new Event('pagehide'));win.dispatchEvent(new Event('pageshow'));await settled();
    expect(audio.isMuted()).toBe(true);expect(FakeContext.last.gain.value).toBe(0);expect(saved.get('ppp.mute.v1')).toBe('1');
    expect(FakeContext.last.state).toBe('suspended');expect(FakeContext.last.resume).not.toHaveBeenCalled();
    audio.setMuted(false);hidden(true);await settled();expect(saved.get('ppp.mute.v1')).toBe('0');expect(FakeContext.last.gain.value).toBe(0);
  });
  it.each(['hidden','muted'])('re-suspends if a delayed resume completes after becoming %s',async reason => {
    const audio=await import('../src/game/sound');audio.unlockAudio();const ctx=FakeContext.last;hidden(true);await settled();
    let finish!:()=>void;ctx.resume.mockImplementation(()=>new Promise<void>(resolve=>{finish=()=>{ctx.state='running';resolve();};}));
    hidden(false);
    if(reason==='hidden') hidden(true); else audio.setMuted(true);
    finish();await settled();
    expect(ctx.state).toBe('suspended');expect(ctx.gain.value).toBe(0);
  });
  it('does not stutter on focus changes while the page remains visible',async () => {
    const audio=await import('../src/game/sound');audio.unlockAudio();const ctx=FakeContext.last;
    win.dispatchEvent(new Event('blur'));win.dispatchEvent(new Event('focus'));
    expect(ctx.suspend).not.toHaveBeenCalled();expect(ctx.resume).not.toHaveBeenCalled();
    hidden(true);expect(ctx.state).toBe('suspended');
  });
});

describe('audio alongside CarPlay and other media', () => {
  it('requests mixable audio once and never plays a silent media clip',async () => {
    let type='auto';
    Object.defineProperty(session,'type',{configurable:true,get:()=>type,set:(value:string)=>{type=value;}});
    const setType=vi.spyOn(session,'type','set');
    const audio=await import('../src/game/sound');
    for(const event of inputs)win.dispatchEvent(new Event(event));
    expect(audio.getAudio()).not.toBeNull();expect(session.type).toBe('ambient');
    expect(setType).toHaveBeenCalledOnce();expect(Audio).not.toHaveBeenCalled();expect(FakeContext.created).toBe(1);
    hidden(true);hidden(false);await settled();expect(setType).toHaveBeenCalledOnce();
  });
  it('does not acquire audio on any input when the saved setting is muted',async () => {
    saved.set('ppp.mute.v1','1');const audio=await import('../src/game/sound');
    for(const event of inputs)win.dispatchEvent(new Event(event));
    expect(audio.getAudio()).toBeNull();expect(FakeContext.created).toBe(0);expect(session.type).toBe('auto');expect(Audio).not.toHaveBeenCalled();
    audio.setMuted(false);expect(FakeContext.created).toBe(1);expect(session.type).toBe('ambient');
  });
  it('keeps muted audio suspended through further taps and app switches',async () => {
    const audio=await import('../src/game/sound');audio.unlockAudio();const ctx=FakeContext.last;audio.setMuted(true);await settled();
    for(const event of inputs)win.dispatchEvent(new Event(event));
    hidden(true);hidden(false);await settled();
    expect(ctx.state).toBe('suspended');expect(ctx.resume).not.toHaveBeenCalled();
    audio.setMuted(false);await settled();expect(ctx.state).toBe('running');expect(ctx.gain.value).toBe(.8);
  });
  it('does not start concurrent resumes for overlapping input events',async () => {
    const audio=await import('../src/game/sound');audio.unlockAudio();const ctx=FakeContext.last;hidden(true);await settled();
    let finish!:()=>void;ctx.resume.mockImplementation(()=>new Promise<void>(resolve=>{finish=()=>{ctx.state='running';resolve();};}));
    hidden(false);for(const event of inputs)win.dispatchEvent(new Event(event));
    expect(ctx.resume).toHaveBeenCalledOnce();finish();await settled();expect(ctx.state).toBe('running');
  });
  it('yields to a system interruption and resumes after the session recovers',async () => {
    const audio=await import('../src/game/sound');audio.unlockAudio();const ctx=FakeContext.last;
    session.state='interrupted';ctx.state='interrupted';session.dispatchEvent(new Event('statechange'));
    for(const event of inputs)win.dispatchEvent(new Event(event));
    expect(ctx.resume).not.toHaveBeenCalled();
    session.state='active';session.dispatchEvent(new Event('statechange'));await settled();
    expect(ctx.resume).toHaveBeenCalledOnce();expect(ctx.state).toBe('running');
  });
  it.each(['absent','unsupported'])('still plays when the optional audio session API is %s',async mode => {
    if(mode==='absent')vi.stubGlobal('navigator',{});
    else Object.defineProperty(session,'type',{get:()=> 'auto',set:()=>{throw new Error('unsupported');}});
    const audio=await import('../src/game/sound');audio.unlockAudio();expect(audio.getAudio()).not.toBeNull();expect(FakeContext.last.state).toBe('running');
  });
});
