import { useId } from 'react';
import { AVATAR_VIEWBOX, avatarSvg, type Avatar as AvatarSpec } from './avatarParts';

/** A player's toilet, any size. */
export function Avatar({ av, size = 40, className = '' }: { av: AvatarSpec | null | undefined; size?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  return <svg className={`avatar ${className}`.trim()} width={size} height={size * (170 / 160)} viewBox={AVATAR_VIEWBOX} aria-hidden="true" dangerouslySetInnerHTML={{ __html: avatarSvg(av, `a${id}`) }} />;
}
