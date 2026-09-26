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
  initialMode?: 'name' | 'friends' | 'account' | 'look' | 'signin';
  /** A friend code from a shared link, for the Friends tab's search box. */
  addCode?: string | null;
}

type Mode = 'name' | 'friends' | 'save' | 'signin' | 'code' | 'claim' | 'look' | 'account' | 'signout';

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
  const [accountLoading, setAccountLoading] = useState(true);
  const [accountError, setAccountError] = useState(false);
  const [accountRetry, setAccountRetry] = useState(0);
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
    setAccountLoading(true);
    setAccountError(false);
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
    }).catch(() => { if (active) setAccountError(true); })
      .finally(() => { if (active) setAccountLoading(false); });
    return () => { active = false; };
  }, [accountRetry]);

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
      setAccountRetry(n => n + 1);
      setMode('name');
    });

  const close = () => onClose(current?.name ?? getSavedName());
  const savedEmail = current && !current.anonymous ? current.email : null;
  const openMode = (next: Mode) => { setMode(next); setError(null); setNote(null); };
  const tabs = (['name', 'friends', 'account'] as const).map((id) => [id, id === 'name' ? 'Profile' : id === 'friends' ? 'Friends' : 'Account'] as const);
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
        {!lookOnly && !inTabs && <h2 className="locker-title">{mode === 'save' ? 'Save your progress' : mode === 'code' ? 'Your transfer code' : mode === 'claim' ? 'Enter transfer code' : mode === 'signout' ? 'Sign out of this phone?' : 'Welcome back'}</h2>}

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
              {accountLoading ? <div className="lb-note" role="status">Checking your account…</div> : accountError ? <>
                <div className="sub">Couldn’t check your account. Please try again.</div>
                <button onClick={() => setAccountRetry(n => n + 1)}>Try again</button>
              </> : savedEmail ? <>
                <div className="locker-account-status is-saved"><span className="account-eyebrow">✓ Signed in</span><strong>Your progress is saved</strong><p>{savedEmail}</p></div>
                <div className="account-help"><strong>Playing on another phone?</strong><p>Open Putt Putt Potty there and sign in with this email. Your golfer, thrones, and unlocks will be waiting.</p></div>
                <button className="primary" onClick={close}>Back to the game</button>
                <button className="account-quiet" onClick={() => openMode('signout')}>Sign out of this phone</button>
              </> : <>
                <div className="locker-account-status"><span className="account-eyebrow">Guest golfer</span><strong>Keep your crown</strong><p>Your progress is tied to this browser. Connect an email so you can recover it on any phone.</p></div>
                <button className="primary" onClick={() => openMode('save')}>Save progress with email</button>
                <p className="account-caption">No password. Just a link in your inbox.</p>
                <button onClick={() => openMode('signin')}>Already have an account? Sign in</button>
                <details className="account-transfer"><summary>Transfer without email</summary>
                  <p>Use only your own phones. These codes transfer your account; they aren’t friend codes.</p>
                  <button onClick={() => { openMode('code'); void showCode(); }}><strong>Create transfer code</strong><small>Start on your old phone</small></button>
                  <button onClick={() => openMode('claim')}><strong>Enter transfer code</strong><small>Finish on your new phone</small></button>
                </details>
              </>}
            </>
          )}

          {mode === 'signout' && <>
            <div className="locker-account-status"><strong>Your crown stays safe</strong><p>Your progress is saved to {savedEmail}. Sign in with that email to return to this golfer.</p></div>
            {error && <div className="err" role="alert">{error}</div>}
            <button className="primary" disabled={busy} onClick={() => openMode('account')}>Stay signed in</button>
            <button disabled={busy} onClick={() => void run(async () => { await signOut(); window.location.reload(); })}>{busy ? 'Signing out…' : 'Sign out'}</button>
          </>}

          {mode === 'code' && (
            <>
              <div className="sub">On your new phone, open Account → Transfer without email → Enter transfer code. Type these six digits there.</div>
              {code ? <div className="link-code">{code.slice(0, 3)} {code.slice(3)}</div> : <div className="lb-note">{error ?? 'Getting a code…'}</div>}
              <div className="account-help"><strong>Keep this code private</strong><p>It expires in 10 minutes. Using it moves this golfer to the new phone and replaces the golfer there.</p></div>
              {error && <button disabled={busy} onClick={() => void showCode()}>Try again</button>}
              <button onClick={() => openMode('account')}>Back to Account</button>
            </>
          )}

          {mode === 'claim' && (
            <>
              <div className="sub">On your old phone, choose Account → Transfer without email → Create transfer code. Enter that code below.</div>
              <input aria-label="Six-digit transfer code" className="name-input code-input" inputMode="numeric" pattern="[0-9]*" maxLength={7} placeholder="123 456" value={claim} onChange={(e) => setClaim(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} autoFocus />
              <div className="account-help"><strong>This replaces the golfer on this phone</strong><p>Its progress will be replaced by your old phone’s golfer. Only enter a code from your own account.</p></div>
              {error && <div className="err">{error}</div>}
              <button className="primary" disabled={claim.length !== 6 || busy} onClick={() => void doClaim()}>
                {busy ? 'Moving…' : 'Move my account here'}
              </button>
              <button disabled={busy} onClick={() => openMode('account')}>Back to Account</button>
            </>
          )}

          {(mode === 'save' || mode === 'signin') && (
            <>
              <div className="sub">
                {mode === 'save'
                  ? 'Your name and thrones follow this email to any phone. No password, just a link.'
                  : 'Already saved an account? We email you a link that signs this phone in.'}
              </div>
              <input aria-label="Email address" className="name-input" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              {error && <div className="err">{error}</div>}
              {note && <div className="ok-note">{note}</div>}
              <button className="primary" disabled={!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) || busy} onClick={() => void (mode === 'save' ? doLink() : doSignIn())}>
                {busy ? 'Sending…' : 'Email me the link'}
              </button>
              <button onClick={() => openMode('account')}>Back to Account</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
