import { SignedDataVerifier, Environment } from 'npm:@apple/app-store-server-library@3.1.0';
import { Buffer } from 'node:buffer';
function verifier(){
 const roots=JSON.parse(Deno.env.get('APPLE_ROOT_CERTIFICATES_BASE64')??'[]');
 const bundle=Deno.env.get('APPLE_BUNDLE_ID');const environment=Deno.env.get('APPLE_STORE_ENVIRONMENT');
 if(!bundle||!roots.length||!['Sandbox','Production'].includes(environment??''))throw new Error('Apple purchases are not configured for this preview yet.');
 return new SignedDataVerifier(roots.map((s:string)=>Buffer.from(s,'base64')),true,environment==='Production'?Environment.PRODUCTION:Environment.SANDBOX,bundle,environment==='Production'?Number(Deno.env.get('APPLE_APP_ID')):undefined);
}
export async function verifyApplePurchase(signed:unknown,userId:string,db:any){
 if(typeof signed!=='string'||signed.length>50000)throw new Error('Missing Apple-signed transaction');
 const tx=await verifier().verifyAndDecodeTransaction(signed);
 if(tx.appAccountToken?.toLowerCase()!==userId.toLowerCase())throw new Error('This purchase belongs to another account');
 if(tx.revocationDate)throw new Error('This purchase was refunded or revoked');
 if(!tx.transactionId||!tx.productId?.startsWith('com.puttputtpotty.'))throw new Error('Unknown purchase');
 const {data,error}=await db.rpc('credit_store_purchase',{p_user:userId,p_transaction:tx.transactionId,p_product:tx.productId.slice('com.puttputtpotty.'.length),p_environment:tx.environment});
 if(error)throw error;return {ok:true,credited:data};
}
export async function appleNotification(signed:unknown,db:any){
 if(typeof signed!=='string'||signed.length>100000)throw new Error('Missing signed notification');
 const v=verifier();const event=await v.verifyAndDecodeNotification(signed);
 if(['REFUND','REVOKE'].includes(event.notificationType??'')){
  if(!event.data?.signedTransactionInfo)throw new Error('Missing transaction');
  const tx=await v.verifyAndDecodeTransaction(event.data.signedTransactionInfo);
  const {error}=await db.rpc('revoke_store_purchase',{p_transaction:tx.transactionId});if(error)throw error;
 }
 return {ok:true};
}
