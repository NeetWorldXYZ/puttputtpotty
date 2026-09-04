import type { Hole } from '../sim/types';
import { validateHole } from '../sim/validate';

const KEY = 'ppp.editor.hole.v1';

export function loadAutosave(): Hole | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = validateHole(JSON.parse(raw));
    return v.ok && v.hole ? v.hole : null;
  } catch {
    return null;
  }
}

export function saveAutosave(hole: Hole): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(hole));
  } catch {
    /* ignore */
  }
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
