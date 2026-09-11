import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import './royal.css';
import './compact.css';
import './open-home.css';
import './match-ranks.css';
import { invalidateStaticLayers } from './render/drawHole';
const HeadGallery = React.lazy(() => import('./game/HeadGallery').then(m => ({default:m.HeadGallery})));
const headPreview = new URLSearchParams(window.location.search).get('preview') === 'heads';
const GearGallery = React.lazy(() => import('./game/GearGallery').then(m => ({default:m.GearGallery})));
const gearPreview = new URLSearchParams(window.location.search).get('preview') === 'gear';

// Sign text on the cached static layer should use the game font once it arrives.
if (typeof document !== 'undefined' && document.fonts?.ready) {
  document.fonts.ready.then(() => invalidateStaticLayers()).catch(() => {});
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {gearPreview ? <React.Suspense fallback={<p>Loading the collection…</p>}><GearGallery /></React.Suspense> : headPreview ? <React.Suspense fallback={<p>Loading the collection…</p>}><HeadGallery /></React.Suspense> : <App />}
  </React.StrictMode>,
);
