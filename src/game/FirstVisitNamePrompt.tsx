import { useEffect, useState } from 'react';
import { ensureSession, loadProfile } from '../net/supabase';
import { needsPlayerName } from '../net/playerName';
import { AccountSheet } from './AccountSheet';
import { NamePrompt } from './NamePrompt';

/** Check the server identity before prompting, including when a friend shares a deep link. */
export function FirstVisitNamePrompt({ enabled, onDone }: { enabled: boolean; onDone: () => void }) {
  const [checked, setChecked] = useState(false);
  const [lesson,setLesson]=useState(false);
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
  if(enabled && lesson)return <div className="overlay"><section role="dialog" aria-label="Your first putt" className="card pop"><small>WELCOME TO THE TOUR</small><h2>Your first putt</h2><p>Drag back from the ball to aim. Pull farther for more power, then release.</p><p>Try a practice round anywhere. At a public bathroom, check in and play three holes to challenge its throne.</p><p>Your first 48 hours as ruler: challengers must score lower or tie you faster.</p><button className="primary" onClick={()=>{setLesson(false);onDone();}}>Let’s play →</button></section></div>;
  if (!enabled || !show) return null;
  if (signingIn) return <AccountSheet initialMode="signin" onClose={name => {
    setSigningIn(false);
    if (!needsPlayerName(name)) { setShow(false); onDone(); }
  }} />;
  return <NamePrompt title="Welcome to Putt Putt Potty" sub="Choose your golfer name. This is what friends and the leaderboard will see." onDone={() => { setShow(false); setLesson(true); }} onCancel={() => setShow(false)} onSignIn={() => setSigningIn(true)} />;
}
