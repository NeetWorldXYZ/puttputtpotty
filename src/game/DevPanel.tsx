import { DEFAULT_PARAMS, PARAM_META, type PhysicsParams } from '../sim/params';
import type { Stroke } from '../sim/types';
import type { UiPrefs } from './paramsStore';

interface Props {
  params: PhysicsParams;
  prefs: UiPrefs;
  setParam: <K extends keyof PhysicsParams>(k: K, v: PhysicsParams[K]) => void;
  setPref: <K extends keyof UiPrefs>(k: K, v: UiPrefs[K]) => void;
  reset: () => void;
  onClose: () => void;
  holeNames: string[];
  holeIndex: number;
  onJumpToHole: (i: number) => void;
  strokeHistory: Stroke[];
  seed: number;
}

export function DevPanel(p: Props) {
  const groups = Array.from(new Set(PARAM_META.map((m) => m.group)));
  const copyStrokes = () => {
    const payload = JSON.stringify({ seed: p.seed, strokes: p.strokeHistory });
    navigator.clipboard?.writeText(payload).catch(() => {});
  };
  return (
    <div className="devpanel" onPointerDown={(e) => e.stopPropagation()}>
      <div className="head">
        <strong>Dev panel</strong>
        <button onClick={p.onClose}>✕</button>
      </div>

      <h3>Holes</h3>
      <div className="actions" style={{ flexWrap: 'wrap' }}>
        {p.holeNames.map((n, i) => (
          <button key={i} className={i === p.holeIndex ? 'active' : ''} onClick={() => p.onJumpToHole(i)}>
            {i + 1}. {n}
          </button>
        ))}
      </div>

      {groups.map((g) => (
        <div key={g}>
          <h3>{g}</h3>
          {PARAM_META.filter((m) => m.group === g).map((m) => {
            const v = p.params[m.key];
            const isDefault = v === DEFAULT_PARAMS[m.key];
            return (
              <div key={m.key}>
                <div className="row">
                  <label>{m.label}</label>
                  <span className="val" style={{ color: isDefault ? 'var(--dim)' : 'var(--accent)' }}>
                    {Number.isInteger(m.step) ? v : v.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={m.min}
                  max={m.max}
                  step={m.step}
                  value={v}
                  onChange={(e) => p.setParam(m.key, parseFloat(e.target.value))}
                />
              </div>
            );
          })}
        </div>
      ))}

      <h3>Input</h3>
      <div className="row">
        <label>Full power drag (px)</label>
        <span className="val">{p.prefs.maxDragPx}</span>
      </div>
      <input
        type="range"
        min={60}
        max={400}
        step={5}
        value={p.prefs.maxDragPx}
        onChange={(e) => p.setPref('maxDragPx', parseInt(e.target.value, 10))}
      />
      <div className="row">
        <label>Aim line length (units)</label>
        <span className="val">{p.prefs.aimLineLength}</span>
      </div>
      <input
        type="range"
        min={2}
        max={30}
        step={1}
        value={p.prefs.aimLineLength}
        onChange={(e) => p.setPref('aimLineLength', parseInt(e.target.value, 10))}
      />
      <div className="toggles">
        <label>
          <input type="checkbox" checked={p.prefs.invertDrag} onChange={(e) => p.setPref('invertDrag', e.target.checked)} />
          Drag toward target (instead of pull back)
        </label>
        <label>
          <input type="checkbox" checked={p.prefs.showTrail} onChange={(e) => p.setPref('showTrail', e.target.checked)} />
          Show ball trail
        </label>
        <label>
          <input
            type="checkbox"
            checked={p.prefs.showZoneLabels}
            onChange={(e) => p.setPref('showZoneLabels', e.target.checked)}
          />
          Label zones
        </label>
      </div>

      <h3>Replay</h3>
      <div className="note">
        Seed {p.seed}. {p.strokeHistory.length} stroke{p.strokeHistory.length === 1 ? '' : 's'} recorded this hole.
      </div>
      <div className="actions">
        <button onClick={copyStrokes}>Copy strokes JSON</button>
      </div>

      <div className="actions">
        <button className="danger" onClick={p.reset}>
          Reset all to defaults
        </button>
      </div>
      <div className="note">
        Values persist in localStorage and apply on the next physics step. Yellow = changed from default.
      </div>
    </div>
  );
}
