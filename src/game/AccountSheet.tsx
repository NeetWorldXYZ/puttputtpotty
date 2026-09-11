import { useEffect, useRef, useState } from 'react';
import './AccountSheet.css';
import { FriendsPanel } from './FriendsSheet';
import { api } from '../net/api';
import { getSavedName, linkEmail, loadProfile, saveName, signInWithEmail, signOut } from '../net/supabase';
import { SLOGAN_MAX, nameProblem, sloganProblem } from '../net/wordfilter';
import { getSavedAvatar, saveAvatar } from '../net/supabase';
import { Avatar } from './Avatar';
import { DEFAULT_AVATAR, type Avatar as AvatarSpec } from './avatarParts';
import { AvatarCustomizer } from './AvatarCustomizer';
import type { HeadProgress } from './earnedHeads';

interface Props {
  onClose: (name: string | null) => void;
  /** Which part to open on. 'look' is the avatar editor on its own, without the tabs. */
  initialMode?: 'name' | 'friends' | 'account' | 'look';
  /** A friend code from a shared link, for the Friends tab's search box. */
  addCode?: string | null;
}

type Mode = 'name' | 'friends' | 'save' | 'signin' | 'code' | 'claim' | 'look' | 'account';

/**
 * Your account: change your name (unique, checked by the server), save the
 * anonymous account to an email so it survives a new phone or a cleared
 * browser, or sign in to one you saved earlier.
 */
export function AccountSheet({ onClose, initialMode = 'name', addCode = null }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const lookOnly = initialMode === 'look';
  const lookEdited = useRef(false);
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
  const [headProgress, setHeadProgress] = useState<HeadProgress | null>(null);
  const [headProgressLoading, setHeadProgressLoading] = useState(initialMode === 'look');

  useEffect(() => {
    let active = true;
    void loadProfile().then((p) => {
      if (!p || !active) return;
      setCurrent({ name: p.name, email: p.email, anonymous: p.anonymous });
      if (p.name) setName(p.name);
      setSlogan(p.slogan ?? '');
      setSavedSlogan(p.slogan ?? '');
      if (p.avatar && !lookEdited.current) {
        setAvatar(p.avatar);
        setSavedAvatar(p.avatar);
      }
    }).catch(() => { /* The cached profile remains available while offline. */ });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (mode !== 'look') return;
    let active=true;
    setHeadProgressLoading(true);
    void api.avatarHeads().then((progress) => {
      if(active) setHeadProgress(progress);
    }).catch(() => {
      if(active) setError('Your earned heads could not be checked. Please try again.');
    }).finally(() => {
      if(active) setHeadProgressLoading(false);
    });
    return () => { active=false; };
  }, [mode]);

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
      lookEdited.current = true;
      if (avatarDirty) {
        await api.setProfile(undefined, undefined, avatar);
        saveAvatar(avatar);
        setSavedAvatar(avatar);
      }
      setNote('Looking good.');
      if (lookOnly) onClose(current?.name ?? getSavedName());
      else setMode('name');
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

  const close = () => onClose(current?.name ?? getSavedName());
  const tabs = (['name', 'friends', 'account'] as const).map((id) => [id, id === 'name' ? 'Identity' : id === 'friends' ? 'Friends' : 'Account'] as const);
  const inTabs = mode === 'name' || mode === 'friends' || mode === 'account';
  if (mode === 'look') return <AvatarCustomizer avatar={avatar} busy={busy} error={error} onChange={(next) => { lookEdited.current = true; setAvatar(next); setError(null); }} onSave={() => void saveLook()} onClose={close} headProgress={headProgress} progressLoading={headProgressLoading} />;
  return (
    <div className="overlay locker-overlay" onClick={close}>
      <div className={`card pop account locker${lookOnly ? ' locker-look' : ''}`} role="dialog" aria-modal="true" aria-label={lookOnly ? 'Your look' : 'Player locker'} onClick={(e) => e.stopPropagation()}>
        <div className="locker-heading">
          <span className="locker-badge">{lookOnly ? 'YOUR LOOK' : 'PLAYER LOCKER'}</span>
          <button className="locker-close" aria-label="Close" onClick={close}>×</button>
        </div>
        {!lookOnly && inTabs && (
          <nav className="locker-tabs" aria-label="Locker sections">
            {tabs.map(([id, label]) => (
              <button key={id} aria-pressed={mode === id} onClick={() => { setMode(id); setError(null); setNote(null); }}>{label}</button>
            ))}
          </nav>
        )}
        {!lookOnly && !inTabs && <h2 className="locker-title">{mode === 'save' ? 'Save your account' : mode === 'code' ? 'Move phones' : mode === 'claim' ? 'Enter a code' : 'Sign in'}</h2>}

        <div className="locker-body">
          {mode === 'name' && (
            <>
              <div className="locker-hero">
                <Avatar av={avatar} size={84} />
                <span><small>Your golfer</small><strong>{name || 'Make your mark'}</strong></span>
              </div>
              <label htmlFor="locker-name" className="field-label">Name on the throne</label>
              <input id="locker-name" className="name-input" maxLength={24} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
              <label htmlFor="locker-slogan" className="field-label">Signature line <small>optional</small></label>
              <input id="locker-slogan" className="name-input slogan-input" maxLength={SLOGAN_MAX} placeholder="Sink it or swim in it" value={slogan} onChange={(e) => setSlogan(e.target.value)} />
              {error && <div className="err">{error}</div>}
              {note && <div className="ok-note">{note}</div>}
              <button className="primary" disabled={!trimmed || busy || !dirty} onClick={() => void saveTheName()}>
                {busy ? 'Saving…' : 'Save'}
              </button>
              <button onClick={close}>Done</button>
            </>
          )}

          {mode === 'friends' && <FriendsPanel initialQuery={addCode} />}

          {mode === 'account' && (
            <>
              <div className="locker-account-status"><strong>{current?.email ? 'You’re connected' : 'Keep your crown'}</strong><p>{current?.email ?? 'Save your golfer and thrones so they follow you to your next phone.'}</p></div>
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
            </>
          )}

          {mode === 'code' && (
            <>
              <div className="sub">On your other phone, open Putt Putt Potty, tap your name, choose &ldquo;Account&rdquo;, then &ldquo;Enter a code&rdquo; and type this in. Good for ten minutes.</div>
              {code ? <div className="link-code">{code.slice(0, 3)} {code.slice(3)}</div> : <div className="lb-note">{error ?? 'Getting a code…'}</div>}
              <div className="sub small">That phone becomes this account; this one goes back to being a guest.</div>
              <button onClick={() => setMode('account')}>Back</button>
            </>
          )}

          {mode === 'claim' && (
            <>
              <div className="sub">Type the six digits showing on your other phone under &ldquo;Move phones&rdquo;.</div>
              <input className="name-input code-input" inputMode="numeric" pattern="[0-9]*" maxLength={7} placeholder="123 456" value={claim} onChange={(e) => setClaim(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} autoFocus />
              {error && <div className="err">{error}</div>}
              <button className="primary" disabled={claim.length !== 6 || busy} onClick={() => void doClaim()}>
                {busy ? 'Moving…' : 'Move my account here'}
              </button>
              <button onClick={() => setMode('account')}>Back</button>
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
              <button onClick={() => setMode('account')}>Back</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
