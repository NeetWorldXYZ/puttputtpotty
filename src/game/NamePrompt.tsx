import { useState } from 'react';
import { api } from '../net/api';
import { getSavedName, saveName } from '../net/supabase';
import { nameProblem } from '../net/wordfilter';
import { needsPlayerName } from '../net/playerName';

interface Props {
  title?: string;
  sub?: string;
  onDone: (name: string) => void;
  onCancel?: () => void;
  onSignIn?: () => void;
}

/** Display-name prompt: this is the name that sits on the throne. */
export function NamePrompt({ title, sub, onDone, onCancel, onSignIn }: Props) {
  const [name, setName] = useState(() => { const saved = getSavedName(); return needsPlayerName(saved) ? '' : saved!; });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = name.trim().slice(0, 24);

  const submit = async () => {
    if (!trimmed) return;
    const problem = nameProblem(trimmed);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.setProfile(trimmed);
      saveName(trimmed);
      onDone(trimmed);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overlay">
      <div className="card pop" role="dialog" aria-modal="true" aria-label={title ?? 'Choose your golfer name'}>
        <h2>{title ?? 'Who sits on the throne?'}</h2>
        <div className="sub">{sub ?? 'Pick the name the whole bathroom will see.'}</div>
        <input
          className="name-input"
          aria-label="Golfer name"
          autoFocus
          maxLength={24}
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
        />
        {error && <div className="err">{error}</div>}
        <button className="primary" disabled={!trimmed || busy} onClick={() => void submit()}>
          {busy ? 'Saving…' : 'Claim this name'}
        </button>
        {onSignIn && <button disabled={busy} onClick={onSignIn}>Already have a golfer? Sign in</button>}
        {onCancel && <button disabled={busy} onClick={onCancel}>Not now</button>}
      </div>
    </div>
  );
}
