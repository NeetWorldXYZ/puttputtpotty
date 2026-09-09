import { useEffect } from 'react';
import { nextRank, tpForLevel, type PromoEvent } from './progress';
import { sfx } from './sound';
import { buzz } from './haptics';
import { GameIcon } from './GameIcon';
import './Promo.css';

/** A promotion or a level-up, announced instead of quietly swapped in. */
export function PromoSheet({ event, onClose }: { event: PromoEvent; onClose: () => void }) {
  useEffect(() => {
    sfx.fanfare('ace');
    buzz([30, 40, 30, 40, 80]);
  }, []);
  const next = event.kind === 'rank' ? nextRank(event.thrones) : null;
  return (
    <div className="overlay promo-overlay" onClick={onClose}>
      <div className="promo" role="dialog" aria-modal="true" aria-label={event.kind === 'rank' ? 'Promoted' : 'Level up'} onClick={(e) => e.stopPropagation()}>
        <div className="promo-burst" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <i key={i} style={{ '--i': i } as React.CSSProperties} />
          ))}
        </div>
        <div className="promo-icon" aria-hidden="true">
          {event.kind === 'rank' ? <GameIcon kind="crown" /> : <span className="promo-level-badge">{event.level}</span>}
        </div>
        <div className="promo-eyebrow">{event.kind === 'rank' ? 'Promoted' : 'Level up'}</div>
        <h2>{event.kind === 'rank' ? event.to : `Level ${event.level}`}</h2>
        <p>
          {event.kind === 'rank'
            ? `${event.from} no more. ${event.thrones} ${event.thrones === 1 ? 'throne' : 'thrones'} held${next ? ` · ${next.title} at ${next.at}` : ' · top of the heap'}.`
            : `${event.tp} TP · next level at ${tpForLevel(event.level + 1)} TP.`}
        </p>
        <button className="primary" onClick={onClose}>
          {event.kind === 'rank' ? 'Long may I reign' : 'Onward'}
        </button>
      </div>
    </div>
  );
}
