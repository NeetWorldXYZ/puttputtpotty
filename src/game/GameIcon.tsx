/** Small, resolution-independent presentation assets shared across the interface. */
export function GameIcon({ kind }: { kind: 'home' | 'map' | 'crown' | 'flag' | 'dice' | 'trophy' }) {
  const paths = {
    home: <><path d="M5 22 24 6l19 16v21H29V29H19v14H5Z" fill="currentColor" /></>,
    map: <><path d="m4 17 13-5 14 5 13-5v29l-13 5-14-5-13 5Z" fill="#55d6bb"/><path d="M17 13v27m14-22v27" fill="none"/><path d="M34 15c0 8-10 17-10 17S14 23 14 15a10 10 0 1 1 20 0Z" fill="currentColor"/><circle cx="24" cy="15" r="3" fill="white"/></>,
    crown: <><path d="m5 13 9 9L24 7l10 15 9-9-5 25H10Z" fill="currentColor"/><path d="M10 43h28"/><circle cx="24" cy="7" r="3" fill="#fff2ae"/></>,
    flag: <><path d="M12 43V6"/><path d="m13 7 27 8-27 10Z" fill="#ff526c"/><ellipse cx="13" cy="43" rx="9" ry="3" fill="#50d499"/><circle cx="34" cy="39" r="6" fill="white"/></>,
    dice: <><rect x="6" y="6" width="36" height="36" rx="10" fill="#eef7ff"/><circle cx="16" cy="16" r="2"/><circle cx="32" cy="16" r="2"/><circle cx="24" cy="24" r="2"/><circle cx="16" cy="32" r="2"/><circle cx="32" cy="32" r="2"/></>,
    trophy: <><path d="M13 8H5v9q0 12 12 12m18-21h8v9q0 12-12 12" fill="none"/><path d="M13 5h22v16q0 12-11 12T13 21Z" fill="currentColor"/><path d="M24 33v9m-11 2h22"/></>,
  };
  return <svg className="game-icon" viewBox="0 0 48 48" fill="none" stroke="#14213d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}
