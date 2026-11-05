import { Capacitor, registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';
import { ensureSession, supabase } from './supabase';
import { call } from './api';
export const isNative=Capacitor.isNativePlatform();
interface StoreBridge {
 appleIdentity():Promise<{token:string;nonce:string}>;
 purchase(options:{productId:string;accountToken:string}):Promise<{signedTransaction?:string;transactionId?:string;status:string;price?:string}>;
 recover():Promise<{transactions:{signedTransaction:string;transactionId:string}[]}>;
 restore():Promise<{transactions:{signedTransaction:string;transactionId:string}[]}>;
 finish(options:{transactionId:string}):Promise<void>;
}
const store=registerPlugin<StoreBridge>('PottyStore');
async function deliver(t:{signedTransaction?:string;transactionId?:string}){
 if(!t.signedTransaction||!t.transactionId)throw new Error('Purchase is pending. It will be delivered after confirmation.');
 await call({action:'store-verify',signedTransaction:t.signedTransaction});
 await store.finish({transactionId:t.transactionId});
}
export async function nativeBuy(id:string){
 if(!isNative)throw new Error('Purchases are available in the iPhone app.');
 const session=await ensureSession();if(session.user.is_anonymous)throw new Error('Save your progress with an email in Profile before purchasing.');
 const result=await store.purchase({productId:`com.puttputtpotty.${id}`,accountToken:session.user.id});
 if(result.status==='cancelled')return false;
 await deliver(result);return true;
}
export async function appleAccount(link:boolean){
 if(!isNative)throw new Error('Open the iPhone app to continue with Apple.');
 await ensureSession();
 const {token,nonce}=await store.appleIdentity();
 const credentials={provider:'apple' as const,token,nonce};
 const r=link?await supabase.auth.linkIdentity(credentials):await supabase.auth.signInWithIdToken(credentials);
 if(r.error)throw new Error(r.error.message);
}
export async function nativeRestore(){if(!isNative)throw new Error('Open the iPhone app to restore purchases.');const r=await store.restore();for(const t of r.transactions)await deliver(t);}
let listeners:Promise<void>|null=null;
const deviceKey='ppp.preview.pushDevice';
function attachPush(){
 return listeners??=(async()=>{
  await PushNotifications.addListener('registration',t=>{
   void call({action:'push-register',token:t.value}).then(()=>localStorage.setItem(deviceKey,t.value)).catch(()=>{});
  });
  await PushNotifications.addListener('pushNotificationActionPerformed',()=>window.dispatchEvent(new CustomEvent('potty-open-activity')));
 })();
}
export async function forgetNativePush(){
 if(!isNative)return;
 const token=localStorage.getItem(deviceKey);
 if(token)await call({action:'push-unregister',token});
 await PushNotifications.unregister();
 localStorage.removeItem(deviceKey);
}
export async function enablePush(){
 if(!isNative)throw new Error('Push alerts are available in the iPhone build. Your in-app inbox works here.');
 await attachPush();
 const permission=await PushNotifications.requestPermissions();if(permission.receive!=='granted')throw new Error('Notifications are off. You can enable them in iPhone Settings.');
 await PushNotifications.register();
}
let initialized:Promise<void>|null=null;
export function initializeNative(){return initialized??=bootNative();}
async function bootNative(){
 if(!isNative)return;
 await attachPush();
 if(localStorage.getItem(deviceKey) && (await PushNotifications.checkPermissions()).receive==='granted')await PushNotifications.register();
 const handle=async(url:string)=>{
  const u=new URL(url);if(u.protocol!=='puttputtpotty:' || u.host!=='auth' || u.pathname!=='/callback')return;
  const hash=new URLSearchParams(u.hash.slice(1));const access_token=hash.get('access_token'),refresh_token=hash.get('refresh_token');
  if(access_token&&refresh_token){const {error}=await supabase.auth.setSession({access_token,refresh_token});if(error)throw error;}
  else if(u.searchParams.get('code')){const {error}=await supabase.auth.exchangeCodeForSession(u.searchParams.get('code')!);if(error)throw error;}
 };
 await App.addListener('appUrlOpen',e=>{void handle(e.url).catch(()=>{});});
 const initial=await App.getLaunchUrl();if(initial)await handle(initial.url);
 const recover=async()=>{const {data}=await supabase.auth.getSession();if(!data.session||data.session.user.is_anonymous)return;const {transactions}=await store.recover();for(const t of transactions)await deliver(t).catch(()=>{});};
 await recover();
 await App.addListener('appStateChange',({isActive})=>{if(isActive)void recover().catch(()=>{});});
}
