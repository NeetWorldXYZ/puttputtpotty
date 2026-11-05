import { call } from './api';
import type { Hole, Stroke } from '../sim/types';
export interface Activity {id:string;category:string;title:string;message:string;location_id:string|null;match_id:string|null;read_at:string|null;created_at:string}
export interface Preferences {crowns:boolean;defenses:boolean;friends:boolean;daily:boolean;submissions:boolean;rewards:boolean;quiet_start:number;quiet_end:number;timezone:string}
export interface Visit {id:string;name:string;poi_type:string;lat:number;lng:number}
export interface LaunchState {balance:number;events:Activity[];preferences:Preferences|null;entitlements:{product_id:string}[];visits:Visit[];admin:boolean}
export interface PrivateCourse {id:string;name:string;theme:string;owner_id:string;holes?:Hole[]}
export interface PrivateBoardRow {user_id:string;score:number;hole_scores:number[];profiles:{display_name:string};created_at:string}
export const launch={
 state:()=>call<LaunchState>({action:'launch-state'}),
 read:(id:string)=>call({action:'activity-read',id}),
 preferences:(p:Preferences)=>call({action:'notification-preferences',...p}),
 weekly:()=>call<{awarded:number}>({action:'weekly-passes'}),
 remote:(locationId:string,requestId:string)=>call<{ok:true;startedAt:string}>({action:'remote-start',locationId,requestId}),
 list:()=>call<{courses:PrivateCourse[]}>({action:'private-list'}),
 create:(name:string,theme:string)=>call<{course:PrivateCourse}>({action:'private-create',name,theme}),
 invite:(courseId:string,friendCode:string,remove=false)=>call({action:remove?'private-remove':'private-invite',courseId,friendCode}),
 course:(courseId:string)=>call<{course:PrivateCourse;rows:PrivateBoardRow[]}>({action:'private-course',courseId}),
 submit:(courseId:string,requestId:string,strokes:Stroke[][])=>call<{run:{score:number}}>({action:'private-submit',courseId,requestId,strokes}),
};
