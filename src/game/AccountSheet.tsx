import { useEffect, useState } from 'react';
import { api } from '../net/api';
import { getSavedName, linkEmail, loadProfile, saveName, signInWithEmail, signOut } from '../net/supabase';
import { SLOGAN_MAX, nameProblem, sloganProblem } from '../net/wordfilter';
import { getSavedAvatar, saveAvatar } from '../net/supabase';
import { Avatar } from './Avatar';
import { BALLS, DEFAULT_AVATAR, FACES, HATS, PORCELAIN, SEATS, type Avatar as AvatarSpec } from './avatarParts';

type LookOption = readonly [string, string, string | null];
const LOOK_GROUPS: readonly (readonly [string, keyof AvatarSpec, LookOption[]])[] = [
  ['Porcelain', 'porcelain', Object.entries(PORCELAIN).map(([id, v]) => [id, v.label, v.bottom] as const)],
  ['Seat', 'seat', Object.entries(SEATS).map(([id, v]) => [id, v.label, v.color] as const)],
  ['Hat', 'hat', Object.entries(HATS).map(([id, label]) => [id, label, null] as const)],
  ['Face', 'face', Object.entries(FACES).map(([id, label]) => [id, label, null] as const)],
  ['Ball', 'ball', Object.entries(BALLS).map(([id, v]) => [id, v.label, v.pattern === 'plain' ? v.color : v.accent] as const)],
];

interface Props {
  onClose: (name: string | null) => void;
}

type Mode = 'name' | 'save' | 'signin' | 'code' | 'claim' | 'look';

/**
 * Your account: change your name (unique, checked by the server), save the
 * anonymous account to an email so it survives a new phone or a cleared
 * browser, or sign in to one you saved earlier.
 */
export function AccountSheet({ onClose }: Props) {
  const [mode, setMode] = useState<Mode>('name');
  const [name, setName] = useState(getSavedName() ?? '');
  const [email, setEmail] = useState('');
  const [current, setCurrent] = useState<{ name: string | null; email: string | null; anonymous: boolean } | null>(null);
  const [slogan, setSlogan] = useState('');
  const [savedSlogan, setSavedSlogan] = useState('');
  const [avatar, setAvatar] = useState<AvatarSpec>(getSavedAvatar() ?? DEFAULT_AVATAR);
  const [savedAvatar, setSavedAvatar] = useState<AvatarSpec>(getSavedAvatar() ?? DEFAULT_AVATAR);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [claim, setClaim] = useState('');

  useEffect(() => {
    void loadProfile().then((p) => {
      if (!p) return;
      setCurrent({ name: p.name, email: p.email, anonymous: p.anonymous });
      if (p.name) setName(p.name);
      setSlogan(p.slogan ?? '');
      setSavedSlogan(p.slogan ?? '');
      if (p.avatar) {
        setAvatar(p.avatar);
        setSavedAvatar(p.avatar);
      }
    });
  }, []);

  const trimmed = name.trim().slice(0, 24);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sloganTrim = slogan.trim().slice(0, SLOGAN_MAX);
  const dirty = (trimmed && trimmed !== current?.name) || sloganTrim !== savedSlogan;
  const saveTheName = () =>
    run(async () => {
      const nameChange = trimmed && trimmed !== current?.name ? trimmed : undefined;
      const problem = (nameChange && nameProblem(nameChange)) || (sloganTrim && sloganProblem(sloganTrim)) || null;
      if (problem) throw new Error(problem);
      await api.setProfile(nameChange, sloganTrim !== savedSlogan ? sloganTrim : undefined);
      if (nameChange) {
        saveName(nameChange);
        setCurrent((c) => (c ? { ...c, name: nameChange } : c));
      }
      setSavedSlogan(sloganTrim);
      setNote(nameChange ? 'Saved. That name is yours.' : 'Saved.');
    });
  const doLink = () =>
    run(async () => {
      await linkEmail(email.trim());
      setNote(`Check ${email.trim()} and tap the link to finish. Your thrones stay with you.`);
    });
  const doSignIn = () =>
    run(async () => {
      await signInWithEmail(email.trim());
      setNote(`Check ${email.trim()} and tap the link. Come back here afterwards.`);
    });
  const avatarDirty = JSON.stringify(avatar) !== JSON.stringify(savedAvatar);
  const saveLook = () =>
    run(async () => {
      await api.setProfile(undefined, undefined, avatar);
      saveAvatar(avatar);
      setSavedAvatar(avatar);
      setNote('Looking good.');
      setMode('name');
    });
  const showCode = () =>
    run(async () => {
      setCode(null);
      const r = await api.linkCode();
      setCode(r.code);
    });
  const doClaim = () =>
    run(async () => {
      const r = await api.linkClaim(claim);
      saveName(r.displayName);
      setName(r.displayName);
      setCurrent((c) => (c ? { ...c, name: r.displayName } : { name: r.displayName, email: null, anonymous: true }));
      setNote(`Welcome back, ${r.displayName}. Your thrones are on this phone now.`);
      setMode('name');
    });

  return (
    <div className="overlay" onClick={() => onClose(current?.name ?? getSavedName())}>
      <div className="card pop account" onClick={(e) => e.stopPropagation()}>
        <h2>{mode === 'name' ? 'Your account' : mode === 'save' ? 'Save your account' : mode === 'code' ? 'Move to another phone' : mode === 'claim' ? 'Bring my account here' : mode === 'look' ? 'Your look' : 'Sign in'}</h2>

        {mode === 'name' && (
          <>
            <div className="sub">
              {current?.email ? `Saved to ${current.email}` : current?.anonymous === false ? 'Signed in' : 'Guest on this phone only'}
            </div>
            <button className="look-row" onClick={() => setMode('look')}>
              <Avatar av={avatar} size={56} />
              <span>
                <strong>Customize your toilet</strong>
                <small>porcelain, seat, hat, face, ball</small>
              </span>
              <span className="chev">›</span>
            </button>
            <label className="field-label">Name on the throne</label>
            <input className="name-input" maxLength={24} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
            <label className="field-label">Slogan (shows under your name)</label>
            <input className="name-input slogan-input" maxLength={SLOGAN_MAX} placeholder="Sink it or swim in it" value={slogan} onChange={(e) => setSlogan(e.target.value)} />
            {error && <div className="err">{error}</div>}
            {note && <div className="ok-note">{note}</div>}
            <button className="primary" disabled={!trimmed || busy || !dirty} onClick={() => void saveTheName()}>
              {busy ? 'Saving…' : 'Save'}
            </button>
            <div className="field-label">Account</div>
            <div className="acct-links">
              {!current?.email && <button onClick={() => setMode('save')}>💾 Save by email</button>}
              <button
                onClick={() => {
                  setMode('code');
                  void showCode();
                }}
              >
                📲 Move phones
              </button>
              <button onClick={() => setMode('claim')}>🔑 Enter a code</button>
              <button onClick={() => setMode('signin')}>👤 Sign in</button>
              {current?.email && (
                <button
                  onClick={() =>
                    run(async () => {
                      await signOut();
                      onClose(null);
                    })
                  }
                >
                  🚪 Sign out
                </button>
              )}
            </div>
            <button onClick={() => onClose(current?.name ?? getSavedName())}>Done</button>
          </>
        )}

        {mode === 'look' && (
          <>
            <div className="look-preview">
              <Avatar av={avatar} size={120} />
            </div>
            {LOOK_GROUPS.map(([title, key, options]) => (
              <div key={key} className="look-group">
                <div className="field-label">{title}</div>
                <div className="look-chips">
                  {options.map(([id, label, swatch]) => (
                    <button key={id} className={`chip${avatar[key] === id ? ' active' : ''}`} onClick={() => setAvatar({ ...avatar, [key]: id })}>
                      {swatch && <span className="swatch" style={{ background: swatch }} />}
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {error && <div className="err">{error}</div>}
            <button className="primary" disabled={busy || !avatarDirty} onClick={() => void saveLook()}>
              {busy ? 'Saving…' : 'Save my look'}
            </button>
            <button onClick={() => setMode('name')}>Back</button>
          </>
        )}

        {mode === 'code' && (
          <>
            <div className="sub">On your other phone, open Putt Putt Potty, tap your name, choose &ldquo;I have a code&rdquo; and type this in. Good for ten minutes.</div>
            {code ? <div className="link-code">{code.slice(0, 3)} {code.slice(3)}</div> : <div className="lb-note">{error ?? 'Getting a code…'}</div>}
            <div className="sub small">That phone becomes this account; this one goes back to being a guest.</div>
            <button onClick={() => setMode('name')}>Back</button>
          </>
        )}

        {mode === 'claim' && (
          <>
            <div className="sub">Type the six digits showing on your other phone under &ldquo;Move to another phone&rdquo;.</div>
            <input className="name-input code-input" inputMode="numeric" pattern="[0-9]*" maxLength={7} placeholder="123 456" value={claim} onChange={(e) => setClaim(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} autoFocus />
            {error && <div className="err">{error}</div>}
            <button className="primary" disabled={claim.length !== 6 || busy} onClick={() => void doClaim()}>
              {busy ? 'Moving…' : 'Move my account here'}
            </button>
            <button onClick={() => setMode('name')}>Back</button>
          </>
        )}

        {(mode === 'save' || mode === 'signin') && (
          <>
            <div className="sub">
              {mode === 'save'
                ? 'Your name and thrones follow this email to any phone. No password, just a link.'
                : 'Already saved an account? We email you a link that signs this phone in.'}
            </div>
            <input className="name-input" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            {error && <div className="err">{error}</div>}
            {note && <div className="ok-note">{note}</div>}
            <button className="primary" disabled={!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) || busy} onClick={() => void (mode === 'save' ? doLink() : doSignIn())}>
              {busy ? 'Sending…' : 'Email me the link'}
            </button>
            <button onClick={() => setMode('name')}>Back</button>
          </>
        )}
      </div>
    </div>
  );
}
