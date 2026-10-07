const crypto = require('crypto');
const { TelegramClient } = require('teleproto');
const { StringSession } = require('teleproto/sessions');

const SECRET = process.env.SESSION_COOKIE_SECRET || '';
const KEY = crypto.createHash('sha256').update(SECRET || 'temporary-unconfigured-secret').digest();
const COOKIE = 'tg_qp_session';

function enc(obj) {
  const iv=crypto.randomBytes(12);
  const c=crypto.createCipheriv('aes-256-gcm',KEY,iv);
  const data=Buffer.from(JSON.stringify(obj));
  const out=Buffer.concat([c.update(data),c.final()]);
  return Buffer.concat([iv,c.getAuthTag(),out]).toString('base64url');
}
function dec(v) {
  try { const b=Buffer.from(v,'base64url'); const iv=b.subarray(0,12), tag=b.subarray(12,28), body=b.subarray(28); const d=crypto.createDecipheriv('aes-256-gcm',KEY,iv); d.setAuthTag(tag); return JSON.parse(Buffer.concat([d.update(body),d.final()]).toString()); } catch { return null; }
}
function getCookie(req) { const h=req.headers.cookie||''; const m=h.match(new RegExp('(?:^|;\\s*)'+COOKIE+'=([^;]+)')); return m ? dec(m[1]) : null; }
function setCookie(res,obj,maxAge=86400*30) { res.setHeader('Set-Cookie',`${COOKIE}=${enc(obj)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`); }
function clearCookie(res) { res.setHeader('Set-Cookie',`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`); }
function json(res,status,data){res.status(status).setHeader('Content-Type','application/json');res.end(JSON.stringify(data));}
async function body(req){ if(req.body && typeof req.body==='object') return req.body; if(req.body && typeof req.body==='string'){try{return JSON.parse(req.body)}catch(e){throw new Error('Request JSON invalid: '+e.message)}} return await new Promise((resolve,reject)=>{let s='';req.on('data',c=>s+=c);req.on('end',()=>{try{resolve(s?JSON.parse(s):{})}catch(e){reject(new Error('Request JSON invalid: '+e.message))}});req.on('error',reject);}); }
function creds(apiId,apiHash){return Number.isInteger(Number(apiId))&&Number(apiId)>0&&/^[a-f0-9]{20,}$/i.test(String(apiHash));}
async function makeClient(apiId,apiHash,session=''){const c=new TelegramClient(new StringSession(session),Number(apiId),String(apiHash),{connectionRetries:3,deviceModel:'Quiz Publisher',appVersion:'1.0.0'});await c.connect();return c;}
function err(e){return e?.message||e?.errorMessage||String(e)}
function clean(q){const question=String(q?.question??'').trim();const options=Array.isArray(q?.options)?q.options.map(x=>String(x).trim()).filter(Boolean):[];const correct=Number(q?.correctOption);if(!question)throw Error('Question is empty.');if(options.length<2||options.length>10)throw Error('Each quiz must have 2-10 options.');if(!Number.isInteger(correct)||correct<0||correct>=options.length)throw Error('correctOption is invalid.');return{question,options,correctOption:correct,explanation:String(q?.explanation||'').slice(0,200)}}
async function withClient(s,fn){if(!s?.apiId||!s?.apiHash||!s?.session)throw Error('Telegram account is not logged in.');const c=await makeClient(s.apiId,s.apiHash,s.session);try{return await fn(c)}finally{try{await c.disconnect()}catch{}}}

module.exports=async(req,res)=>{
 try{
  if(!SECRET){ return json(res,503,{ok:false,error:'SESSION_COOKIE_SECRET is not configured on the server. Add it in Vercel → Settings → Environment Variables, then redeploy.'}); }

  const path=(req.url||'').split('?')[0].replace(/^\/api/,'')||'/status';
  if(req.method==='GET'&&path==='/health'){ return json(res,200,{ok:true,service:'telegram-quiz-publisher',node:process.version}); }
  if(req.method==='GET'&&path==='/status'){const s=getCookie(req);return json(res,200,{ok:true,state:s?.state||'logged_out',hasApi:!!(s?.apiId),hasSession:!!(s?.session),user:s?.user||null});}
  const b=await body(req);
  if(req.method==='POST'&&path==='/login/start'){
   const {apiId,apiHash,phone}=b;if(!creds(apiId,apiHash)||!phone)return json(res,400,{ok:false,error:'API ID/API Hash/phone invalid.'});
   const c=await makeClient(apiId,apiHash,'');
   try{const sent=await c.sendCode({apiId:Number(apiId),apiHash:String(apiHash)},String(phone));setCookie(res,{state:'code_sent',apiId:Number(apiId),apiHash:String(apiHash),phone:String(phone),phoneCodeHash:sent.phoneCodeHash,session:''},900);return json(res,200,{ok:true,state:'code_sent',viaApp:!!sent.isCodeViaApp});}finally{try{await c.disconnect()}catch{}}
  }
  if(req.method==='POST'&&path==='/login/verify'){
   const s=getCookie(req);if(!s?.phoneCodeHash)return json(res,400,{ok:false,error:'First request a login code.'});
   const c=await makeClient(s.apiId,s.apiHash,'');
   try{let result;try{result=await c.api.auth.signIn({phoneNumber:s.phone,phoneCodeHash:s.phoneCodeHash,phoneCode:String(b.code||'')})}catch(e){if(!/SESSION_PASSWORD_NEEDED/i.test(err(e)))throw e;if(!b.password)return json(res,401,{ok:false,need2fa:true,error:'Telegram 2FA password required.'});result=await c.signInWithPassword({apiId:s.apiId,apiHash:s.apiHash},{password:async()=>String(b.password)})}
    const session=c.session.save();const u=result?.user||result;setCookie(res,{state:'logged_in',apiId:s.apiId,apiHash:s.apiHash,session,user:{id:String(u?.id||''),firstName:u?.firstName||'',username:u?.username||''}});return json(res,200,{ok:true,state:'logged_in',user:{id:String(u?.id||''),firstName:u?.firstName||'',username:u?.username||''}});
   }finally{try{await c.disconnect()}catch{}}
  }
  if(req.method==='POST'&&path==='/logout'){clearCookie(res);return json(res,200,{ok:true});}
  if(req.method==='POST'&&path==='/check-group'){const s=getCookie(req);return withClient(s,async c=>{const e=await c.getEntity(String(b.groupId||'').trim());return json(res,200,{ok:true,title:e?.title||e?.username||'Telegram chat',id:String(e?.id||b.groupId)})});}
  if(req.method==='POST'&&(path==='/test'||path==='/publish')){const s=getCookie(req);return withClient(s,async c=>{const group=await c.getEntity(String(b.groupId||'').trim());const send=async q=>{const x=clean(q);return c.sendPoll(group,{question:x.question,answers:x.options,quiz:true,correctAnswers:x.correctOption,solution:x.explanation||undefined})};if(path==='/test'){const m=await send(b.question);return json(res,200,{ok:true,messageId:m?.id||null})}const qs=Array.isArray(b.questions)?b.questions:[];if(!qs.length)throw Error('No questions supplied.');const delay=Math.max(1000,Math.min(60000,Number(b.delayMs||3000)));let sent=0;for(const q of qs){await send(q);sent++;if(sent<qs.length)await new Promise(r=>setTimeout(r,delay))}return json(res,200,{ok:true,sent,total:qs.length})});}
  return json(res,404,{ok:false,error:'API route not found.'});
 }catch(e){return json(res,400,{ok:false,error:err(e)})}
};
