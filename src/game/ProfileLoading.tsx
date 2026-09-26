import { BrandedLoading } from './BrandedLoading';
import './Profile.css';
import './ProfilePolish.css';
import './ProfileLoading.css';

let artwork: Promise<void> | undefined;
/** Decode the scene before revealing it alongside the profile data. */
export function prepareProfileArtwork(): Promise<void> {
  return artwork ??= Promise.all([
    '/art/profile-course-v4.webp', '/art/profile-slogan-sign.webp',
    '/art/ranks-nearby.webp', '/art/ranks-city-hero.webp',
  ].map(async src => {
    const image = new Image();
    image.src = src;
    try { await image.decode(); } catch { /* A failed asset must not block the profile. */ }
  })).then(() => {});
}

export function ProfileLoading({ publicProfile = false }: { publicProfile?: boolean }) {
  return <BrandedLoading page="profile" label={publicProfile ? 'Meeting your rival' : 'Getting your golfer ready'} />;
}
