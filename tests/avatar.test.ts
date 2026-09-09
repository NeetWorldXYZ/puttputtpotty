import { describe, expect, it } from 'vitest';
import { BALLS, DEFAULT_AVATAR, FACES, HEADS, avatarPartSvg, avatarSvg, ballLook, normalizeAvatar, starterAvatar } from '../src/game/avatarParts';
import { LOOK_CATEGORIES, lookOptions } from '../src/game/AvatarCustomizer';
// @ts-expect-error The checked-in production engine is prebuilt JavaScript.
import { normalizeAvatar as serverNormalizeAvatar } from '../server/potty/engine.js';

describe('avatars', () => {
  it('polishes every existing head without changing saved selections', () => {
    for (const head of Object.keys(HEADS)) {
      const av = {...DEFAULT_AVATAR,head,hat:'crown'};
      const before = JSON.stringify(av);
      const svg = avatarSvg(av,`polish-${head}`);
      expect(svg).toContain('M88 134'); // shirt crest
      expect(svg).toContain('cx="66" cy="70"'); // visible happy eyes
      expect(svg).not.toContain('NaN');
      expect(JSON.stringify(av)).toBe(before);
    }
  });
  it('normalizes anything into a valid avatar', () => {
    expect(normalizeAvatar(null)).toEqual(DEFAULT_AVATAR);
    expect(normalizeAvatar({ porcelain: 'mint', hat: 'crown', ball: 'tiger', face: 'nope', seat: 42 })).toEqual({ porcelain: 'mint', seat: 'white', hat: 'crown', face: 'happy', ball: 'tiger', head: 'classic' });
    expect(normalizeAvatar({ head: 'turd' }).head).toBe('turd');
    expect(normalizeAvatar({ head: 'dragon' }).head).toBe('classic');
    expect(normalizeAvatar('garbage')).toEqual(DEFAULT_AVATAR);
  });

  it('renders the chosen parts', () => {
    const svg = avatarSvg({ porcelain: 'gold', seat: 'red', hat: 'tophat', face: 'cool', ball: 'dots', head: 'classic' }, 'x');
    expect(svg).toContain('#825238'); // saved gold key now maps to deep skin
    expect(svg).toContain('stop-color="#ff5f7e"'); // red shirt
    expect(svg).toContain('data-hat="tophat"');
    expect(svg).toContain('M52 63 h25'); // sunglasses
    expect(svg).toContain('clip-path="url(#look-x-clip)"'); // dotted ball
    expect(avatarSvg(DEFAULT_AVATAR, 'y')).toContain('data-hat="none"');
  });

  it('gives the canvas a ball style', () => {
    expect(ballLook(null)).toBe(BALLS.white);
    expect(ballLook({ ...DEFAULT_AVATAR, ball: 'stripe' }).pattern).toBe('stripe');
    expect(ballLook({ ...DEFAULT_AVATAR, ball: 'tomato' }).motif).toBe('fire');
    expect(ballLook({ ...DEFAULT_AVATAR, ball: 'ink' }).motif).toBe('eight');
  });

  it('round-trips every editor option through the deployed server catalog', () => {
    for (const head of Object.keys(HEADS)) {
      for (const { key, featured } of LOOK_CATEGORIES) {
        const options = lookOptions({ ...DEFAULT_AVATAR, head }, key);
        expect(featured.every((id) => options.some(([value]) => value === id))).toBe(true);
        for (const [value] of options) {
          const chosen = { ...DEFAULT_AVATAR, head, [key]: value };
          expect(serverNormalizeAvatar(chosen)).toEqual(chosen);
          expect(normalizeAvatar(serverNormalizeAvatar(chosen))).toEqual(chosen);
        }
      }
    }
  });

  it('shows neutral head choices independently of the current expression and hat', () => {
    for (const head of Object.keys(HEADS)) {
      for (const face of Object.keys(FACES)) {
        const av = { ...DEFAULT_AVATAR, head, face, hat: 'crown' };
        for (const part of ['head', 'porcelain'] as const) {
          const { markup } = avatarPartSvg(av, part, 'card');
          expect(markup).toContain(`data-head="${head}"`);
          expect(markup).toContain('data-face="happy"');
          expect(markup).not.toContain('data-part="hat"');
          expect(markup).not.toContain('data-part="shirt"');
        }
      }
    }
  });

  it('keeps eyes and a readable mouth on every face, including the moustache', () => {
    for (const head of Object.keys(HEADS)) for (const face of Object.keys(FACES)) {
      const svg = avatarSvg({ ...DEFAULT_AVATAR, head, face });
      expect(svg).toContain('data-feature="eyes"');
      expect(svg).toContain('data-feature="mouth"');
      if (face === 'sleepy') expect(svg).toContain('data-feature="mustache"');
    }
  });

  it('clips every ball design to the same circle and gives adjacent portraits separate paint IDs', () => {
    const allIds: string[] = [];
    for (const ball of Object.keys(BALLS)) {
      const part = avatarPartSvg({ ...DEFAULT_AVATAR, ball }, 'ball', `ball-${ball}`);
      expect(part.viewBox).toBe('0 0 100 100');
      expect(part.markup).toContain('<circle data-ball-outline="true" cx="50" cy="50" r="40"');
      expect(part.markup).toContain(`<clipPath id="look-ball-${ball}-clip"><circle cx="50" cy="50" r="40"/>`);
      const ids = [...part.markup.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
      for (const [, reference] of part.markup.matchAll(/url\(#([^)]+)\)/g)) expect(ids).toContain(reference);
      allIds.push(...ids);
    }
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('draws each starter head with the face and hat on top', () => {
    for (const head of ['classic', 'roll', 'turd', 'alien', 'dawg']) {
      const svg = avatarSvg({ ...DEFAULT_AVATAR, head, hat: 'crown', face: 'cool' }, head);
      expect(svg, head).toContain('M44 40 L52 16'); // crown
      expect(svg, head).toContain('M52 63 h25'); // sunglasses
    }
    expect(avatarSvg({ ...DEFAULT_AVATAR, head: 'roll' }, 'r')).not.toContain('<circle cx="80" cy="73" r="36"');
  });

  it('starter looks cover every head and always normalize clean', () => {
    const seen = new Set<string>();
    for (let i = 0; i < Object.keys(HEADS).length; i++) {
      const av = starterAvatar(() => (i + 0.1) / Object.keys(HEADS).length);
      seen.add(av.head);
      expect(normalizeAvatar(av)).toEqual(av);
      expect(av.face).toBe('happy');
    }
    expect([...seen].sort()).toEqual(Object.keys(HEADS).sort());
  });
});
