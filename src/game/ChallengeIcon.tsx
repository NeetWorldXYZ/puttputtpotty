import { ProfileStatIcon, type ProfileStatKind } from './ProfileStatIcon';
export function ChallengeIcon({challenge}: {challenge:string}) {
  const kind:ProfileStatKind=/ace|birdies/.test(challenge)?'ace':/match.*win/.test(challenge)?'win':/match/.test(challenge)?'match':/daily|checkin/.test(challenge)?'best':/throne|hold|claim|found/.test(challenge)?'throne':'rounds';
  return <ProfileStatIcon kind={kind}/>;
}
export function ChallengeFlame() {
  return <svg viewBox="0 0 64 76" aria-hidden="true"><path d="M34 4c9 19 0 23 5 30 7-2 7-8 8-13 22 25 10 49-15 50C7 71-4 47 17 26c-2 13 5 15 8 18C17 25 36 23 34 4Z" fill="#ff8849" stroke="#08283e" strokeWidth="4" strokeLinejoin="round"/><path d="M32 32c7 13-1 18 3 22 3-1 6-4 7-8 8 14 1 21-10 21-12 0-18-12-9-21 0 9 4 9 7 11-4-12 3-16 2-25Z" fill="#ffe68e"/></svg>;
}
export function ChallengeCrown() {
  return <svg viewBox="0 0 48 40" aria-hidden="true"><path d="m4 10 11 7L24 3l9 14 11-7-5 23H9Z" fill="#ffda57" stroke="#08283e" strokeWidth="3" strokeLinejoin="round"/><path d="M10 28h28" stroke="#fff3b1" strokeWidth="3"/><path d="M10 35h28" stroke="#d29a2a" strokeWidth="3"/></svg>;
}
