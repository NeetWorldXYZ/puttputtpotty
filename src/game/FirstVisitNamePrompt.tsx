import { useEffect, useState } from 'react';
import { ensureSession, loadProfile } from '../net/supabase';
import { needsPlayerName } from '../net/playerName';
import { AccountSheet } from './AccountSheet';
import { NamePrompt } from './NamePrompt';

/** Check the server identity before prompting, including when a friend shares a deep link. */
export function FirstVisitNamePrompt({ enabled, onDone }: { enabled: boolean; onDone: () => void }) {
  const [checked, setChecked] = useState(false);
  const [show, setShow] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  useEffect(() => {
    if (!enabled || checked) return;
    let active = true;
    void ensureSession().then(() => loadProfile()).then(profile => {
      if (!active || !profile) return;
      setChecked(true);
      setShow(needsPlayerName(profile.name));
    }).catch(() => { /* Offline navigation remains available; try again on the next menu visit. */ });
    return () => { active = false; };
  }, [enabled, checked]);
  if (!enabled || !show) return null;
  if (signingIn) return <AccountSheet initialMode="signin" onClose={name => {
    setSigningIn(false);
    if (!needsPlayerName(name)) { setShow(false); onDone(); }
  }} />;
  return <NamePrompt title="Welcome to Putt Putt Potty" sub="Choose your golfer name. This is what friends and the leaderboard will see." onDone={() => { setShow(false); onDone(); }} onCancel={() => setShow(false)} onSignIn={() => setSigningIn(true)} />;
}
