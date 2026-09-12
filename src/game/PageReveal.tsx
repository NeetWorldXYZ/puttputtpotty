import { useEffect, useRef, useState, type ReactNode } from 'react';
import { TabBar, type Tab } from './TabBar';
import './PageReveal.css';

type Page = Exclude<Tab, 'profile'>;
const assets: Record<Page, string[]> = {
  play: ['/art/home-mascot-city.webp'],
  match: ['/art/arcade-course.webp', '/art/match-greens-v2.webp', '/art/results/par-mascot-v2.webp'],
  leaders: ['/art/arcade-course.webp', '/art/ranks-city-hero.webp', '/art/arcade-logo.webp'],
  map: [],
};
const decoded = new Map<string, Promise<void>>();
function decode(src: string): Promise<void> {
  let task = decoded.get(src);
  if (!task) {
    const image = new Image();
    image.src = src;
    task = image.decode().catch(() => { decoded.delete(src); });
    decoded.set(src, task);
  }
  return task;
}
export function preparePageArtwork(page: Page) {
  return Promise.all(assets[page].map(decode));
}
export function MenuLoading({ page }: { page: Page }) {
  return <div className="menu-loading"><div role="status" aria-busy="true"><span aria-hidden="true">♛</span><p>Getting everything ready…</p></div><TabBar active={page}/></div>;
}
/** Keep layout measurable (especially MapLibre) while revealing the first scene atomically. */
export function PageReveal({ page, children }: { page: Page; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = root.current!;
    let active = true, checking = false;
    const reveal = () => { if (active) { observer.disconnect(); setVisible(true); } };
    const check = async () => {
      if (!active || checking || element.querySelector('[data-scene-pending="true"]')) return;
      checking = true;
      try {
        await preparePageArtwork(page);
        // Data can add new artwork: scan again after each decode pass.
        const seen = new Set<string>();
        for (let pass = 0; pass < 4; pass++) {
          const sources = [...element.querySelectorAll('img')].map(img => img.currentSrc || img.src).filter(src => src && !seen.has(src));
          if (!sources.length) break;
          sources.forEach(src => seen.add(src));
          await Promise.all(sources.map(decode));
        }
        await document.fonts?.ready;
        if (!element.querySelector('[data-scene-pending="true"]')) reveal();
      } finally { checking = false; }
    };
    const observer = new MutationObserver(() => { void check(); });
    observer.observe(element, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-scene-pending', 'src'] });
    // Give mounted children one layout pass to request their actual fonts.
    const frame = requestAnimationFrame(() => { void check(); });
    // Offline assets/data must never trap navigation behind an endless reveal gate.
    const deadline = window.setTimeout(reveal, 6000);
    return () => { active = false; observer.disconnect(); cancelAnimationFrame(frame); clearTimeout(deadline); };
  }, [page]);
  return <><div ref={root} className={visible ? 'page-scene' : 'page-scene page-scene-pending'} aria-hidden={!visible || undefined}>{children}</div>{!visible && <MenuLoading page={page}/>}</>;
}
