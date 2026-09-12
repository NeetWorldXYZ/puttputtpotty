import { TabBar } from './TabBar';
import './Profile.css';
import './ProfilePolish.css';
import './ProfileLoading.css';

/** Keep the course framing mounted while profile data is arriving. */
export function ProfilePlaceholder() {
  return <div className="profile-body pf-loading-body" role="status" aria-label="Loading profile" aria-busy="true">
    <section className="pf3-hero" aria-hidden="true"><div/><div className="pf-loading-copy"><i/><i/><i/></div></section>
    <div className="pf-loading-card" aria-hidden="true"/>
    <div className="pf-loading-row" aria-hidden="true"/>
    <div className="pf-loading-row" aria-hidden="true"/>
  </div>;
}

export function ProfileLoading({ publicProfile = false }: { publicProfile?: boolean }) {
  return <div className={`leaders profile profile-polished profile-v3 ${publicProfile ? 'pf-public' : 'pf-private'}`}>
    <div className="pf3-topbar" aria-hidden="true"><span className="pf-loading-control"/></div>
    <ProfilePlaceholder/>
    <TabBar active="profile"/>
  </div>;
}
