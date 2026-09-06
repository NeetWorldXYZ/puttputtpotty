import { describe, expect, it } from 'vitest';
import { BALLS, DEFAULT_AVATAR, avatarSvg, ballLook, normalizeAvatar } from '../src/game/avatarParts';

describe('avatars', () => {
  it('normalizes anything into a valid avatar', () => {
    expect(normalizeAvatar(null)).toEqual(DEFAULT_AVATAR);
    expect(normalizeAvatar({ porcelain: 'mint', hat: 'crown', ball: 'tiger', face: 'nope', seat: 42 })).toEqual({ porcelain: 'mint', seat: 'white', hat: 'crown', face: 'happy', ball: 'tiger' });
    expect(normalizeAvatar('garbage')).toEqual(DEFAULT_AVATAR);
  });

  it('renders the chosen parts', () => {
    const svg = avatarSvg({ porcelain: 'gold', seat: 'red', hat: 'tophat', face: 'cool', ball: 'dots' }, 'x');
    expect(svg).toContain('#f2c94c'); // gold porcelain
    expect(svg).toContain('fill="#ff5f7e"'); // red seat
    expect(svg).toContain('x="56" y="2"'); // top hat
    expect(svg).toContain('rect x="50" y="61"'); // sunglasses
    expect(svg).toContain('clip-path="url(#x-clip)"'); // dotted ball
    expect(avatarSvg(DEFAULT_AVATAR, 'y')).not.toContain('x="56" y="2"');
  });

  it('gives the canvas a ball style', () => {
    expect(ballLook(null)).toBe(BALLS.white);
    expect(ballLook({ ...DEFAULT_AVATAR, ball: 'stripe' }).pattern).toBe('stripe');
  });
});
