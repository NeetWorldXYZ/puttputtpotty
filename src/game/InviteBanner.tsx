import { useState } from 'react';
import { api } from '../net/api';
import { dismissInvite, useInvites } from '../net/presence';
import { navigate, useLocation } from '../router';
import { Avatar } from './Avatar';
import { sfx } from './sound';
import './Friends.css';

/** A friend wants to play: drops in from the top wherever you are. Accept joins their match. */
export function InviteBanner() {
  const invites = useInvites();
  const loc = useLocation();
  const [busy, setBusy] = useState(false);
  const inv = invites[0];
  if (!inv) return null;
  // Already on their match, or in the middle of a hole: keep out of the way.
  if (loc.route === 'match' && (loc.code === inv.code || loc.match === inv.match_id)) return null;
  if (loc.loc || loc.seed) return null;
  const accept = async () => {
    setBusy(true);
    try {
      await api.inviteRespond(inv.id, true);
    } catch {
      /* joining still works by code */
    }
    dismissInvite(inv.id);
    sfx.whoosh();
    navigate('match', null, null, { code: inv.code });
    setBusy(false);
  };
  const decline = () => {
    dismissInvite(inv.id);
    void api.inviteRespond(inv.id, false).catch(() => {});
  };
  return (
    <div className="invite-banner" role="status">
      <Avatar av={inv.from_avatar} size={36} />
      <span className="fr-who">
        <strong>{inv.from_name} wants to play</strong>
        <small>{inv.holes} holes · fewest strokes wins</small>
      </span>
      <button className="fr-btn primary" disabled={busy} onClick={() => void accept()}>
        {busy ? '…' : 'Accept'}
      </button>
      <button className="fr-btn" onClick={decline} aria-label="Not now">
        ✕
      </button>
    </div>
  );
}
