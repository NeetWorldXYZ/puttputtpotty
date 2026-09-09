import { describe, expect, it } from 'vitest';
import { BALLS, DEFAULT_AVATAR, HEADS, avatarSvg, ballLook, normalizeAvatar, starterAvatar } from '../src/game/avatarParts';

describe('avatars', () => {
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
    expect(svg).toContain('fill="#ff5f7e"'); // red shirt
    expect(svg).toContain('x="56" y="2"'); // top hat
    expect(svg).toContain('M52 63 h25'); // sunglasses
    expect(svg).toContain('clip-path="url(#x-clip)"'); // dotted ball
    expect(avatarSvg(DEFAULT_AVATAR, 'y')).not.toContain('x="56" y="2"');
  });

  it('gives the canvas a ball style', () => {
    expect(ballLook(null)).toBe(BALLS.white);
    expect(ballLook({ ...DEFAULT_AVATAR, ball: 'stripe' }).pattern).toBe('stripe');
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
    for (let i = 0; i < 200; i++) {
      const av = starterAvatar(Math.random);
      seen.add(av.head);
      expect(normalizeAvatar(av)).toEqual(av);
      expect(av.face).toBe('happy');
    }
    expect([...seen].sort()).toEqual(Object.keys(HEADS).sort());
  });
});
