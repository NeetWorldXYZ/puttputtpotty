import { useEffect, useId, useRef, useState } from 'react';
import { Avatar } from './Avatar';
import { BALLS, FACES, HATS, HEADS, SEATS, avatarPartSvg, headTones, type Avatar as AvatarSpec } from './avatarParts';
import './AvatarCustomizer.css';
import { EARNABLE_HEADS, headUnlocked, isEarnableHead, type HeadProgress } from './earnedHeads';
import { gearReward, gearUnlocked } from '../../server/potty/cosmeticCatalog';

const rewardFor=(part:string,value:string)=>part==='head'&&isEarnableHead(value)?EARNABLE_HEADS[value]:gearReward(part,value);
const progressUnit=(metric:string)=>({points:'TP',rankedWins:'wins',places:'places',dailyDays:'days',aces:'aces',thrones:'thrones'}[metric]??'');

export const LOOK_CATEGORIES: readonly { key: keyof AvatarSpec; label: string; featured: readonly string[] }[] = [
  { key: 'head', label: 'Head', featured: ['classic', 'roll', 'turd', 'alien', 'dawg'] },
  { key: 'porcelain', label: 'Color', featured: ['white', 'mint', 'sky', 'lavender', 'gold'] },
  { key: 'seat', label: 'Shirt', featured: ['blue', 'ink', 'white', 'red', 'wood'] },
  { key: 'hat', label: 'Hat', featured: ['none', 'crown', 'cap', 'tophat', 'plunger'] },
  { key: 'face', label: 'Face', featured: ['happy', 'cool', 'wink', 'angry', 'sleepy'] },
  { key: 'ball', label: 'Ball', featured: ['white', 'lime', 'ink', 'tomato', 'lemon'] },
];

/** Keep every existing saved choice accessible, including the additional colours. */
export function lookOptions(av: AvatarSpec, part: keyof AvatarSpec): [string, string][] {
  switch (part) {
    case 'head': return Object.entries(HEADS).map(([id,value]) => [id,value.label]);
    case 'porcelain': return Object.entries(headTones(av.head)).map(([id, value]) => [id, value.label]);
    case 'seat': return Object.entries(SEATS).map(([id, value]) => [id, value.label]);
    case 'hat': return Object.entries(HATS);
    case 'face': return Object.entries(FACES);
    case 'ball': return Object.entries(BALLS).map(([id, value]) => [id, value.label]);
  }
}

function Part({ avatar, part }: { avatar: AvatarSpec; part: keyof AvatarSpec }) {
  const id = useId();
  const art = avatarPartSvg(avatar, part, id);
  return <svg className="studio-part" viewBox={art.viewBox} aria-hidden="true" dangerouslySetInnerHTML={{ __html: art.markup }} />;
}

interface Props {
  avatar: AvatarSpec;
  busy: boolean;
  error: string | null;
  onChange: (avatar: AvatarSpec) => void;
  onSave: () => void;
  onClose: () => void;
  headProgress: HeadProgress | null;
  progressLoading: boolean;
}

export function AvatarCustomizer({ avatar, busy, error, onChange, onSave, onClose, headProgress, progressLoading }: Props) {
  const [category, setCategory] = useState<keyof AvatarSpec>('head');
  const [inspected,setInspected]=useState<{part:keyof AvatarSpec;value:string}|null>(null);
  const preview=inspected?{...avatar,[inspected.part]:inspected.value}:avatar;
  const inspectedReward=inspected?rewardFor(inspected.part,inspected.value):null;
  const inspectedCurrent=inspectedReward?headProgress?.stats[inspectedReward.metric]??0:0;
  const dialog = useRef<HTMLDivElement>(null);
  const collection = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (collection.current) collection.current.scrollTop = 0;
    setInspected(null);
  }, [category]);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const id = useId();
  const group = LOOK_CATEGORIES.find((item) => item.key === category)!;
  const options = lookOptions(avatar, category);
  const label = group.label;
  const ordered = [...group.featured, ...options.map(([key]) => key).filter((key) => !group.featured.includes(key))];
  const visible = ordered.flatMap(key => options.filter(([value]) => value === key));

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.querySelector<HTMLButtonElement>('.studio-back')?.focus({ preventScroll: true });
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);

  return (
    <div className="studio-overlay" onClick={() => { if (!busy) onClose(); }}>
      <div ref={dialog} className="avatar-studio" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => {
        if (event.key === 'Escape' && !busy) { event.stopPropagation(); closeRef.current(); }
        if (event.key !== 'Tab') return;
        const items = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled):not([tabindex="-1"])') ?? []);
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}>
        <div className="studio-room">
          <img className="studio-backdrop" src="/art/avatar-locker-room.webp" alt="" />
          <header className="studio-heading">
            <button className="studio-circle studio-back" aria-label="Back to profile" disabled={busy} onClick={onClose}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5-7 7 7 7M8 12h12" /></svg></button>
            <div><h1 id={`${id}-title`}>YOUR <em>LOOK</em></h1><p>Same holes. Better style.</p></div>
            <button className="studio-circle" aria-label="Close customizer" disabled={busy} onClick={onClose}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
          </header>
          <div className="studio-golfer" role="img" aria-label={`${inspected?'Preview':'Your golfer'}: ${LOOK_CATEGORIES.map(({key}) => lookOptions(preview, key).find(([value]) => value === preview[key])?.[1]).join(', ')}`}>
            <Avatar av={preview} size={240} />
          </div>
        </div>
        <div className="studio-wardrobe">
          <div className="studio-tabs" role="tablist" aria-label="Appearance categories">
            {LOOK_CATEGORIES.map((item, index) => <button key={item.key} id={`${id}-tab-${item.key}`} role="tab" aria-selected={category === item.key} aria-controls={`${id}-choices`} tabIndex={category === item.key ? 0 : -1} onClick={() => setCategory(item.key)} onKeyDown={(event) => {
              const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
              if (!direction && event.key !== 'Home' && event.key !== 'End') return;
              event.preventDefault();
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? LOOK_CATEGORIES.length - 1 : (index + direction + LOOK_CATEGORIES.length) % LOOK_CATEGORIES.length;
              setCategory(LOOK_CATEGORIES[next].key);
              event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
            }}>{item.label}</button>)}
          </div>
          <div ref={collection} className="studio-collection" id={`${id}-choices`} role="tabpanel" aria-labelledby={`${id}-tab-${category}`}>
            {inspectedReward&&<div className="studio-unlock-detail" aria-live="polite"><div><strong>{inspectedReward.label}</strong><button onClick={()=>setInspected(null)}>Back to my look ×</button></div><p>{inspectedReward.requirement}</p><progress value={Math.min(inspectedCurrent,inspectedReward.target)} max={inspectedReward.target}/><small>{progressLoading?'Checking progress…':`${inspectedCurrent.toLocaleString()} / ${inspectedReward.target.toLocaleString()} ${progressUnit(inspectedReward.metric)}`} · Permanent unlock · No TP spent</small></div>}
            <div className="studio-options" data-expanded="true" aria-label={`Choose ${label.toLowerCase()}`}>
              {visible.map(([value, title]) => {
                const locked=category==='head' ? !headUnlocked(value,headProgress) : !gearUnlocked(category,value,headProgress);
                const reward=rewardFor(category,value);
                const current=reward ? headProgress?.stats[reward.metric] ?? 0 : 0;
                const unit=progressUnit(reward?.metric??'');
                return <button key={`${category}-${value}`} className="studio-option" data-locked={locked||undefined} aria-pressed={preview[category] === value} disabled={busy} aria-label={locked?`${title}. Locked. ${reward?.requirement}. Tap to preview.`:title} onClick={() => {
                  if(locked){setInspected({part:category,value});return;}
                  setInspected(null); onChange({ ...avatar, [category]: value });
                }}>
                  <span className="studio-option-art">
                    <Part avatar={{ ...avatar, [category]: value }} part={category} />
                    {locked&&<span className="studio-lock-overlay" aria-hidden="true">
                      <svg viewBox="0 0 48 56"><path d="M13 24V15a11 11 0 0 1 22 0v9" fill="none" stroke="#061e30" strokeWidth="10"/><path d="M13 24V15a11 11 0 0 1 22 0v9" fill="none" stroke="#ffe999" strokeWidth="6"/><rect x="5" y="21" width="38" height="30" rx="7" fill="#ffdb62" stroke="#061e30" strokeWidth="3"/><path d="M8 40v4q0 4 5 4h22q5 0 5-4v-4" fill="#dca332"/><path d="M12 26h24" stroke="#fff3b8" strokeWidth="3" strokeLinecap="round"/><circle cx="24" cy="33" r="4" fill="#09283c"/><path d="m22 35-1 8h6l-1-8" fill="#09283c"/></svg>
                      <strong>LOCKED</strong>
                    </span>}
                  </span>
                  <span>{title}</span>
                  {locked&&reward&&<small className="studio-lock">{progressLoading?'Checking…':`${Math.min(current,reward.target)} / ${reward.target} ${unit}`}</small>}
                </button>;
              })}
            </div>
          </div>
        </div>
        <footer className="studio-footer">
          {error && <p className="studio-error" role="alert">{error}</p>}
          <button className="studio-save" disabled={busy||!!inspected} onClick={onSave}>{busy ? 'Saving your look…' : inspected ? 'Locked · complete the milestone' : 'Save my look'}</button>
        </footer>
      </div>
    </div>
  );
}
