import { ensureSession, supabase } from './supabase';
export type Correction = { id: string; name: string | null; hidden: boolean };
export type LocationReport = { id: number; location_id: string; location_name: string; reason: string; details: string };
export async function loadCorrections(): Promise<Map<string, Correction>> {
  await ensureSession();
  const all = new Map<string, Correction>();
  for (let start=0;;start+=500) {
    const {data,error}=await supabase.from('location_corrections').select('id,name,hidden').order('id').range(start,start+499);
    if(error) throw error;
    for(const row of data ?? []) all.set(row.id,row);
    if(!data || data.length<500) return all;
  }
}
export async function sendLocationReport(id:string,name:string,reason:string,details:string) {
  await ensureSession();
  const {error}=await supabase.rpc('report_location',{loc:id,label:name,problem:reason,note:details});
  if(error) throw new Error(error.code==='23505' ? 'You already have a report pending for this place.' : error.message);
}
export async function canReviewLocations() {
  await ensureSession();
  const {data,error}=await supabase.rpc('can_review_locations');
  return !error && data===true;
}
export async function reviewQueue():Promise<LocationReport[]> {
  const {data,error}=await supabase.from('location_reports').select('id,location_id,location_name,reason,details').eq('status','pending').order('created_at').limit(30);
  if(error) throw error;
  return data ?? [];
}
export async function reviewLocation(id:number,decision:string,name:string) {
  const {error}=await supabase.rpc('review_location',{report_id:id,decision,corrected_name:name || null});
  if(error) throw error;
}
