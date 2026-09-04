/**
 * Live physics params + UI prefs, persisted to localStorage so tuning
 * survives a refresh. The sim reads params through a ref so slider changes
 * apply on the very next step without a rebuild.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_PARAMS, type PhysicsParams } from '../sim/params';

export interface UiPrefs {
  /** false = pull back to shoot (slingshot); true = drag toward the target. */
  invertDrag: boolean;
  showZoneLabels: boolean;
  showTrail: boolean;
  /** Drag distance (CSS px) for full power. */
  maxDragPx: number;
  /** Aim line length in units at full power. */
  aimLineLength: number;
}

export const DEFAULT_PREFS: UiPrefs = {
  invertDrag: false,
  showZoneLabels: false,
  showTrail: true,
  maxDragPx: 180,
  aimLineLength: 10,
};

const PARAMS_KEY = 'ppp.params.v1';
const PREFS_KEY = 'ppp.prefs.v1';

function load<T extends object>(key: string, defaults: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw) as Partial<T>;
    const out: T = { ...defaults };
    for (const k of Object.keys(defaults) as (keyof T)[]) {
      const v = parsed[k];
      if (typeof v === typeof defaults[k]) out[k] = v as T[keyof T];
    }
    return out;
  } catch {
    return { ...defaults };
  }
}

function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: tuning just won't persist */
  }
}

export function useTuning() {
  const [params, setParamsState] = useState<PhysicsParams>(() => load(PARAMS_KEY, DEFAULT_PARAMS));
  const [prefs, setPrefsState] = useState<UiPrefs>(() => load(PREFS_KEY, DEFAULT_PREFS));
  const paramsRef = useRef(params);
  const prefsRef = useRef(prefs);

  useEffect(() => {
    paramsRef.current = params;
    save(PARAMS_KEY, params);
  }, [params]);
  useEffect(() => {
    prefsRef.current = prefs;
    save(PREFS_KEY, prefs);
  }, [prefs]);

  const setParam = useCallback(<K extends keyof PhysicsParams>(k: K, v: PhysicsParams[K]) => {
    setParamsState((p) => ({ ...p, [k]: v }));
  }, []);
  const setPref = useCallback(<K extends keyof UiPrefs>(k: K, v: UiPrefs[K]) => {
    setPrefsState((p) => ({ ...p, [k]: v }));
  }, []);
  const reset = useCallback(() => {
    setParamsState({ ...DEFAULT_PARAMS });
    setPrefsState({ ...DEFAULT_PREFS });
  }, []);

  return { params, prefs, paramsRef, prefsRef, setParam, setPref, reset };
}
