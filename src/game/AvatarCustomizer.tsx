import { useEffect, useId, useRef, useState } from 'react';
import { Avatar } from './Avatar';
import { BALLS, FACES, HATS, HEADS, SEATS, avatarPartSvg, headTones, type Avatar as AvatarSpec } from './avatarParts';
import './AvatarCustomizer.css';

export const LOOK_CATEGORIES: readonly { key: keyof AvatarSpec; label: string; featured: readonly string[] }[] = [
  { key: 'head', label: 'Head', featured: ['classic', 'roll', 'turd', 'alien', 'dawg'] },
  { key: 'porcelain', label: 'Skin', featured: ['white', 'mint', 'sky', 'lavender', 'gold'] },
  { key: 'seat', label: 'Shirt', featured: ['blue', 'ink', 'white', 'red', 'wood'] },
  { key: 'hat', label: 'Hat', featured: ['none', 'crown', 'cap', 'tophat', 'plunger'] },
  { key: 'face', label: 'Face', featured: ['happy', 'cool', 'wink', 'angry', 'sleepy'] },
  { key: 'ball', label: 'Ball', featured: ['white', 'lime', 'ink', 'tomato', 'lemon'] },
];

/** Keep every existing saved choice accessible, including the additional colours. */
export function lookOptions(av: AvatarSpec, part: keyof AvatarSpec): [string, string][] {
  switch (part) {
    case 'head': return Object.entries(HEADS).map(([id, value]) => [id, value.label]);
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
}

export function AvatarCustomizer({ avatar, busy, error, onChange, onSave, onClose }: Props) {
  const [category, setCategory] = useState<keyof AvatarSpec>('head');
  const [expanded, setExpanded] = useState<Partial<Record<keyof AvatarSpec, boolean>>>({});
  const dialog = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const id = useId();
  const group = LOOK_CATEGORIES.find((item) => item.key === category)!;
  const options = lookOptions(avatar, category);
  const label = category === 'porcelain' && avatar.head !== 'classic' ? 'Colour' : group.label;
  const showingAll = expanded[category] ?? !group.featured.includes(avatar[category]);
  const ordered = [...group.featured, ...options.map(([key]) => key).filter((key) => !group.featured.includes(key))];
  const visible = (showingAll ? ordered : group.featured).map((key) => options.find(([value]) => value === key)!);

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
          <div className="studio-golfer" role="img" aria-label={`Your golfer: ${LOOK_CATEGORIES.map(({key}) => lookOptions(avatar, key).find(([value]) => value === avatar[key])?.[1]).join(', ')}`}>
            <Avatar av={avatar} size={240} />
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
            }}>{item.key === 'porcelain' && avatar.head !== 'classic' ? 'Colour' : item.label}</button>)}
          </div>
          <div className="studio-collection" id={`${id}-choices`} role="tabpanel" aria-labelledby={`${id}-tab-${category}`}>
            <div className="studio-options" aria-label={`Choose ${label.toLowerCase()}`}>
              {visible.map(([value, title]) => <button key={`${category}-${value}`} className="studio-option" aria-pressed={avatar[category] === value} disabled={busy} onClick={() => { setExpanded((current) => ({ ...current, [category]: showingAll })); onChange({ ...avatar, [category]: value }); }}>
                <Part avatar={{ ...avatar, [category]: value }} part={category} />
                <span>{title}</span>
              </button>)}
            </div>
            {options.length > group.featured.length && <button className="studio-more" aria-expanded={showingAll} onClick={() => setExpanded((current) => ({ ...current, [category]: !showingAll }))}>{showingAll ? 'Show favourites' : `More ${label === 'Skin' || label === 'Colour' ? 'colours' : label.toLowerCase() + 's'}`}<span aria-hidden="true">{showingAll ? '−' : '+'}</span></button>}
          </div>
        </div>
        <footer className="studio-footer">
          {error && <p className="studio-error" role="alert">{error}</p>}
          <button className="studio-save" disabled={busy} onClick={onSave}>{busy ? 'Saving your look…' : 'Save my look'}</button>
        </footer>
      </div>
    </div>
  );
}
