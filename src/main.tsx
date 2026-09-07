import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import './royal.css';
import './compact.css';
import './open-home.css';
import { invalidateStaticLayers } from './render/drawHole';

// Sign text on the cached static layer should use the game font once it arrives.
if (typeof document !== 'undefined' && document.fonts?.ready) {
  document.fonts.ready.then(() => invalidateStaticLayers()).catch(() => {});
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
