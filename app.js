let questions=[];
const $=id=>document.getElementById(id);
function status(id,msg,ok=false){const el=$(id); if(!el)return; el.textContent=msg; el.className='status '+(ok?'ok':'');}

// Robust JSON parser: handles BOM, ```json fences, arrays, {questions:[...]},
// and accidentally concatenated JSON values such as {...}{...} or [...][...].
function parseJSON(text){
  if(typeof text!=='string') throw new Error('JSON text नहीं मिला.');
  let clean=text.replace(/^\uFEFF/,'').trim();
  clean=clean.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
  if(!clean) throw new Error('JSON file खाली है.');

  let parsed;
  try {
    parsed=JSON.parse(clean);
  } catch(firstErr) {
    const values=[]; let i=0;
    while(i<clean.length){
      while(i<clean.length && /\s/.test(clean[i])) i++;
      if(i>=clean.length) break;
      const start=i; const opener=clean[i];
      if(opener!=='{' && opener!=='[') throw new Error(`JSON invalid है. Position ${start}: ${clean.slice(start,start+80)}`);
      let depth=0, quote=false, esc=false, end=-1;
      for(;i<clean.length;i++){
        const ch=clean[i];
        if(quote){ if(esc) esc=false; else if(ch==='\\') esc=true; else if(ch==='"') quote=false; continue; }
        if(ch==='"'){quote=true;continue;}
        if(ch===opener) depth++;
        else if((opener==='{'&&ch==='}')||(opener==='['&&ch===']')){depth--; if(depth===0){end=i+1;break;}}
      }
      if(end<0) throw new Error('JSON का closing bracket नहीं मिला.');
      try{values.push(JSON.parse(clean.slice(start,end)));}catch(e){throw new Error('JSON block invalid है: '+e.message)}
      i=end;
    }
    if(values.length===1) parsed=values[0];
    else if(values.length>1) parsed=values;
    else throw firstErr;
  }

  const blocks=Array.isArray(parsed)?parsed:[parsed];
  const arr=[];
  for(const block of blocks){
    if(Array.isArray(block)) arr.push(...block);
    else if(block && Array.isArray(block.questions)) arr.push(...block.questions);
    else if(block && block.question && Array.isArray(block.options)) arr.push(block);
  }
  if(!arr.length) throw new Error('JSON में questions array नहीं मिला.');
  return arr.map((q,i)=>{
    if(!q || !String(q.question||'').trim() || !Array.isArray(q.options)) throw new Error('Question '+(i+1)+' invalid है.');
    const options=q.options.map(x=>String(x).trim()).filter(Boolean);
    const correct=Number(q.correctOption);
    if(options.length<2||options.length>10) throw new Error('Question '+(i+1)+': options 2 से 10 होने चाहिए.');
    if(!Number.isInteger(correct)||correct<0||correct>=options.length) throw new Error('Question '+(i+1)+': correctOption invalid है.');
    return {...q,question:String(q.question).trim(),options,correctOption:correct};
  });
}

async function api(url,bodyData){
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(bodyData||{})});
  const text=await r.text();
  let j;
  try{j=JSON.parse(text)}catch(e){
    const preview=text.replace(/\s+/g,' ').slice(0,240);
    throw new Error(`Server ने JSON के बजाय response दिया (${r.status}). ${preview||'Empty response'}`);
  }
  if(!r.ok||j.ok===false) throw new Error(j.error||`Request failed (${r.status})`);
  return j;
}
async function refresh(){
  try{
    const r=await fetch('/api/status',{cache:'no-store'}); const text=await r.text();
    let j; try{j=JSON.parse(text)}catch{throw new Error(`Status API ने JSON नहीं दिया (${r.status}).`)}
    if(j.state==='logged_in') status('loginStatus','✅ Logged in'+(j.user?.username?' @'+j.user.username:''),true);
    else status('loginStatus','Status: '+(j.state||'unknown'));
  }catch(e){status('loginStatus','❌ '+e.message)}
}
$('sendCode').onclick=async()=>{try{status('loginStatus','Sending code...');const j=await api('/api/login/start',{apiId:$('apiId').value.trim(),apiHash:$('apiHash').value.trim(),phone:$('phone').value.trim()});$('codeBox').classList.remove('hidden');status('loginStatus','✅ Code sent. Telegram app/SMS में आया code डालें.',true)}catch(e){status('loginStatus','❌ '+e.message)}};
$('verify').onclick=async()=>{try{const j=await api('/api/login/verify',{code:$('code').value.trim(),password:$('password').value});status('loginStatus','✅ Login successful'+(j.user?.username?' @'+j.user.username:''),true)}catch(e){status('loginStatus','❌ '+e.message)}};
$('checkGroup').onclick=async()=>{try{const j=await api('/api/check-group',{groupId:$('groupId').value.trim()});status('groupStatus','✅ '+j.title+'\nID: '+j.id,true)}catch(e){status('groupStatus','❌ '+e.message)}};
$('file').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;questions=parseJSON(await f.text());$('preview').textContent=JSON.stringify(questions.slice(0,8),null,2)+(questions.length>8?'\n...':'');status('summary','✅ '+questions.length+' questions loaded',true)}catch(err){questions=[];status('summary','❌ '+err.message)}};
$('loadSample').onclick=async()=>{try{const r=await fetch('/sample-questions.json',{cache:'no-store'});const t=await r.text();if(!r.ok)throw new Error('Sample JSON नहीं मिला.');questions=parseJSON(t);$('preview').textContent=JSON.stringify(questions,null,2);status('summary','✅ Sample: '+questions.length+' questions',true)}catch(e){status('summary','❌ '+e.message)}};
$('sendTest').onclick=async()=>{try{if(!questions.length)throw new Error('पहले JSON load करें.');const j=await api('/api/test',{groupId:$('groupId').value.trim(),question:questions[0]});status('publishStatus','✅ Test quiz sent. Message ID: '+j.messageId,true)}catch(e){status('publishStatus','❌ '+e.message)}};
$('publish').onclick=async()=>{try{if(!questions.length)throw new Error('पहले JSON load करें.');if(!confirm(questions.length+' quizzes भेजें?'))return;status('publishStatus','Publishing...');const j=await api('/api/publish',{groupId:$('groupId').value.trim(),questions,delayMs:Number($('delay').value)});status('publishStatus','✅ Published '+j.sent+'/'+j.total,true)}catch(e){status('publishStatus','❌ '+e.message)}};
$('logout').onclick=async()=>{try{await api('/api/logout',{})}finally{refresh()}};
refresh();
