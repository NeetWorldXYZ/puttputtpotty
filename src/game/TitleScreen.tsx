import { useEffect, useRef, useState } from 'react';
import { COURSE } from '../holes';
import { drawHole } from '../render/drawHole';
import { fitCamera } from '../render/camera';
import { DEFAULT_PARAMS, cupRadius } from '../sim/params';
import type { Hole } from '../sim/types';
import { dailySeed, getBest, goToCourse } from './courses';
import { isMuted, setMuted, unlockAudio } from './sound';
import { THEMES } from '../render/themes';
import { navigate } from '../router';

interface Props {
  onOpenEditor: () => void;
}

const SHOW_THEMES = ['diveBar', 'spaceship', 'tropical', 'castle', 'stadium', 'grandma'];

export function TitleScreen({ onOpenEditor }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [muted, setMutedState] = useState(isMuted());
  const daily = dailySeed();
  const best = getBest(daily);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    const start = performance.now();
    const base = COURSE[1];
    let themeIdx = Math.floor(Math.random() * SHOW_THEMES.length);
    let hole: Hole = { ...base, id: `title-${SHOW_THEMES[themeIdx]}`, theme: SHOW_THEMES[themeIdx] };
    let lastSwap = start;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      if (now - lastSwap > 7000) {
        lastSwap = now;
        themeIdx = (themeIdx + 1) % SHOW_THEMES.length;
        hole = { ...base, id: `title-${SHOW_THEMES[themeIdx]}`, theme: SHOW_THEMES[themeIdx] };
      }
      const t = (now - start) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cam = fitCamera(hole.bounds, w * 1.25, h * 1.25, 0);
      cam.ox -= w * 0.125 + Math.sin(t * 0.25) * 12;
      cam.oy -= h * 0.125 + Math.cos(t * 0.2) * 12;
      drawHole(ctx, hole, cam, { ballRadius: DEFAULT_PARAMS.ballRadius, cupRadius: cupRadius(DEFAULT_PARAMS), ball: { x: hole.tee.x, y: hole.tee.y }, dpr, time: t });
      ctx.fillStyle = 'rgba(7,9,10,0.45)';
      ctx.fillRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const go = (c: 'daily' | 'random' | 'handmade') => {
    unlockAudio();
    goToCourse(c);
  };

  return (
    <div className="title" onPointerDown={() => unlockAudio()}>
      <canvas ref={canvasRef} className="title-bg" />
      <div className="title-inner">
        <div className="logo">
          <span className="logo-top">Putt Putt</span>
          <span className="logo-bottom">Potty</span>
        </div>
        <div className="tagline">Mini golf in the world&apos;s worst bathrooms</div>
        <div className="menu">
          <button
            className="menu-btn primary"
            onClick={() => {
              unlockAudio();
              navigate('map');
            }}
          >
            <span>👑 Nearby thrones</span>
            <small>real bathrooms near you · beat the record, become King of the Throne</small>
          </button>
          <button className="menu-btn" onClick={() => go('daily')}>
            <span>Daily course</span>
            <small>
              {daily}
              {best !== null ? ` · your best ${best}` : ' · one attempt, everyone plays the same nine'}
            </small>
          </button>
          <button className="menu-btn" onClick={() => go('random')}>
            <span>Random course</span>
            <small>nine fresh holes, {THEMES.length} bathrooms to draw from</small>
          </button>
          <button className="menu-btn" onClick={() => go('handmade')}>
            <span>Practice holes</span>
            <small>the three handmade originals</small>
          </button>
          <div className="menu-row">
            <button className="menu-small" onClick={onOpenEditor}>
              Level editor
            </button>
            <button
              className="menu-small"
              onClick={() => {
                unlockAudio();
                setMuted(!muted);
                setMutedState(!muted);
              }}
            >
              Sound {muted ? 'off' : 'on'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
