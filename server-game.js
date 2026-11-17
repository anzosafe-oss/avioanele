const HTML="";
const ASSETS={};
const randomUUID=()=>crypto.randomUUID(),randomInt=n=>{let a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]%n};
const shape=[[0,0],[-2,1],[-1,1],[0,1],[1,1],[2,1],[0,2],[-1,3],[0,3],[1,3]];
function cells(x,y,r){return shape.map(([a,b])=>{for(let i=0;i<r;i++) [a,b]=[-b,a];return [x+a,y+b]})}
function fleet(){let planes=[];for(let i=0;i<3;i++){let p;for(let tries=0;tries<10000;tries++){let c=cells(randomInt(10),randomInt(10),randomInt(4));if(c.every(([x,y])=>x>=0&&y>=0&&x<10&&y<10&&!planes.some(p=>p.cells.some(([a,b])=>a===x&&b===y)))){p={cells:c,dead:false};break}}if(!p)return fleet();planes.push(p)}return planes}
const alive=p=>!p.left&&p.planes.some(q=>!q.dead);
const modern=room=>room.rulesVersion===2;
function conflict(){const e=Error('Camera s-a actualizat. Încearcă din nou.');e.code='conflict';throw e}
function uniqueName(room,name,except){
 const value=String(name||'').trim();
 if(!value||value.length>18||/[\x00-\x1f\x7f]/.test(value))throw Error('Alege un indicativ de 1–18 caractere.');
 if(room.players.some(q=>q.id!==except&&q.name.toLocaleLowerCase()===value.toLocaleLowerCase()))throw Error('Acest indicativ este deja folosit.');
 return value;
}
function addPilot(room,name,bot=false){
 const slot=[1,2,3,4].find(n=>!room.players.some(p=>p.slot===n));
 const fallback=[1,2,3,4].map(n=>'MIG'+n).find(n=>!room.players.some(p=>p.name.toLocaleLowerCase()===n.toLocaleLowerCase()));
 const p=pilot(uniqueName(room,String(name||'').trim()||fallback),bot);p.slot=slot;room.players.push(p);return p;
}
function upgradeLobby(room){
 if(room.phase!=='lobby'||modern(room))return;
 room.rulesVersion=2;room.selections={};room.players.forEach((p,i)=>p.slot=i+1);
}
// Enumerate single closed cycles with the first pilot fixed: at most 3! = 6.
export function circuitCompletions(ids,selections={}){
 if(ids.length<2)return [];
 const cycles=[];
 function visit(path,remaining){
  if(!remaining.length){const map=Object.fromEntries(path.map((id,i)=>[id,path[(i+1)%path.length]]));if(Object.entries(selections).every(([id,t])=>!t||map[id]===t))cycles.push(map);return;}
  for(const id of remaining)visit([...path,id],remaining.filter(x=>x!==id));
 }
 visit([ids[0]],ids.slice(1));return cycles;
}
function targetOptions(room,id){
 const selections={...room.selections};delete selections[id];
 return [...new Set(circuitCompletions(room.players.map(p=>p.id),selections).map(c=>c[id]))];
}
function startCircuit(room,map){
 room.turnOrder=room.players.map(p=>p.id);room.turnSeq=1;
 for(const p of room.players){p.targetId=map[p.id];p.radarAccess={[p.targetId]:[p.id]};p.attackReceipts=[];}
 room.phase='play';room.turn=room.turnOrder[0];room.log.unshift('Circuit stabilit. Începe misiunea!');
}
function prepareCircuit(room){
 room.selections={};
 if(room.players.length===2)startCircuit(room,circuitCompletions(room.players.map(p=>p.id))[0]);
 else {room.phase='targeting';room.turn=null;room.log.unshift('Flote confirmate. Alegeți țintele pentru circuit.');}
}
function radar(room,p){
 if(!p||!alive(p)||!p.targetId)return [];
 const sources=new Set(p.radarAccess?.[p.targetId]||[p.id]);
 return room.players.filter(q=>sources.has(q.id)).flatMap(q=>q.shots.filter(s=>s.target===p.targetId).map(s=>({...s,actorId:q.id})));
}
function eliminate(room,p){
 const successor=p.targetId,predecessor=room.players.find(q=>q.id!==p.id&&alive(q)&&q.targetId===p.id);
 if(predecessor&&successor&&successor!==predecessor.id){
  predecessor.radarAccess||={};
  predecessor.radarAccess[successor]=[...new Set([...(predecessor.radarAccess[successor]||[predecessor.id]),...(p.radarAccess?.[successor]||[p.id])])];
  predecessor.targetId=successor;
 }
 p.targetId=null;
 const remaining=room.players.filter(alive);
 if(remaining.length<=1){room.phase='end';room.winnerId=remaining[0]?.id||null;room.winner=remaining[0]?.name||null;room.turn=null;}
}
function nextTurn(room,id){
 const order=room.turnOrder||room.players.map(p=>p.id);let i=order.indexOf(id);
 for(let n=0;n<order.length;n++){i=(i+1)%order.length;const p=room.players.find(p=>p.id===order[i]);if(p&&alive(p)){room.turn=p.id;return;}}
 room.turn=null;
}
function view(room,id){
 const me=room.players.find(p=>p.id===id),v2=modern(room);
 return {code:room.code,capacity:room.capacity,phase:room.phase,turn:room.turn,winner:room.winner,log:room.log,
 ...(v2?{rulesVersion:2,turnSeq:room.turnSeq||0,turnOrder:room.turnOrder||[],targetId:me?.targetId||null,targetOptions:room.phase==='targeting'?targetOptions(room,id):[],selections:room.phase==='targeting'?room.selections:{},radar:radar(room,me)}:{}),
 players:room.players.map(p=>({id:p.id,name:p.name,ready:p.ready,alive:p.planes.filter(x=>!x.dead).length,
 shots:v2?p.shots.filter(s=>p.id===id||s.target===id):p.shots,
 ...(v2?{slot:p.slot,targetId:p.targetId||null}:{}),
 ...(p.id===id||room.phase==='end'?{planes:p.planes}:{})}))};
}

// The targeting policy accepts only its own shot history, never a room or fleet.
export function chooseBotShot(history, random = Math.random) {
 const used = new Set(history.map(s => `${s.x},${s.y}`));
 const free = [];
 for(let y=0;y<10;y++)for(let x=0;x<10;x++)if(!used.has(`${x},${y}`))free.push({x,y});
 const near = free.filter(c=>history.some(s=>s.result==='hit'&&Math.abs(c.x-s.x)+Math.abs(c.y-s.y)===1));
 const pool=near.length?near:free;
 return pool.length?pool[Math.floor(random()*pool.length)]:null;
}
function shoot(room,p,t,x,y){
 if(room.phase!=='play'||room.turn!==p.id||!alive(p))throw Error('Așteaptă-ți rândul.');
 if(!t||t===p||!alive(t))throw Error('Alege un adversar activ.');
 if(modern(room)&&p.targetId!==t.id)throw Error('Poți ataca doar ținta atribuită.');
 if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>9||y<0||y>9)throw Error('Coordonate invalide.');
 const history=modern(room)?radar(room,p):p.shots.filter(s=>s.target===t.id);
 if(history.some(s=>s.x===x&&s.y===y))throw Error('Ai atacat deja această celulă.');
 const plane=t.planes.find(q=>q.cells.some(([a,b])=>a===x&&b===y));let result='miss';
 if(plane){result='hit';if(plane.cells[0][0]===x&&plane.cells[0][1]===y){plane.dead=true;result='kill'}}
 p.shots.push({target:t.id,x,y,result});
 room.log.unshift({actorId:p.id,text:`${p.name} → ${t.name} · ${'ABCDEFGHIJ'[x]}${y+1}: ${result==='kill'?'Avion doborât!':result==='hit'?'Lovit':'Ratat'}`});room.log=room.log.slice(0,40);
 if(modern(room)){
  if(!alive(t))eliminate(room,t);
  if(room.phase==='play')nextTurn(room,p.id);
  room.turnSeq++;
 }else{
  const remaining=room.players.filter(alive);
  if(remaining.length===1){room.phase='end';room.winner=remaining[0].name;room.turn=null}else nextTurn(room,p.id);
 }
}
function runBot(room){
 const bot=room.players.find(q=>q.bot&&q.id===room.turn);
 if(room.phase!=='play'||!bot)return;
 const target=modern(room)?room.players.find(q=>q.id===bot.targetId):room.players.find(q=>!q.bot&&alive(q));
 const history=modern(room)?radar(room,bot):bot.shots;
 const move=chooseBotShot(history.map(({x,y,result})=>({x,y,result})));
 if(move)shoot(room,bot,target,move.x,move.y);
}
function validFleet(specs){
 if(!Array.isArray(specs)||specs.length!==3||specs.some(q=>!Number.isInteger(q.x)||!Number.isInteger(q.y)||!Number.isInteger(q.r)||q.r<0||q.r>3))throw Error('Poziție invalidă.');
 const planes=specs.map(q=>({cells:cells(q.x,q.y,q.r),dead:false})),all=planes.flatMap(p=>p.cells);
 if(all.some(([x,y])=>x<0||x>9||y<0||y>9)||new Set(all.map(c=>c.join(','))).size!==30)throw Error('Avioanele se suprapun sau ies din grilă.');
 return planes;
}
function pilot(name,bot=false){return {id:randomUUID(),token:randomUUID(),name:String(name||'Pilot').trim().slice(0,18)||'Pilot',bot,planes:fleet(),shots:[],ready:bot}}
export default {async fetch(request,env){try{
 const path=new URL(request.url).pathname;
 if(ASSETS[path]){const asset=ASSETS[path];return new Response(Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0)),{headers:{'Content-Type':asset.type,'Cache-Control':'public, max-age=3600'}})}
 if(!path.startsWith('/api/'))return new Response(HTML,{headers:{'Content-Type':'text/html; charset=utf-8'}});
 if(request.method!=='POST')return new Response('Method not allowed',{status:405});
 const raw=await request.text();if(raw.length>10000)throw Error('Cerere prea mare');
 const a=raw?JSON.parse(raw):{},action=path.slice(5);
 if(!['create','join','state','fleet','ready','fire','leave','rename','select-target'].includes(action))throw Error('Acțiune necunoscută.');
 const code=String(a.code||'').toUpperCase(),row=code?await env.DB.prepare('SELECT data, revision FROM rooms WHERE code = ?').bind(code).first():null;
 let room=row?JSON.parse(row.data):null,p=room?.players.find(p=>!p.bot&&!p.left&&p.id===a.id&&p.token===a.token),created=false;
 if(room&&action!=='state')upgradeLobby(room);
 if(action==='create'){
  let code;do{code=randomUUID().replaceAll('-','').slice(0,8).toUpperCase()}while(await env.DB.prepare('SELECT code FROM rooms WHERE code = ?').bind(code).first());
  room={code,capacity:a.bot?2:([2,3,4].includes(a.capacity)?a.capacity:2),phase:'lobby',players:[],turn:null,log:[],rulesVersion:2,selections:{}};
  p=addPilot(room,a.name);
  if(a.bot)addPilot(room,'Copilot · bot',true);created=true;
 }else if(action==='join'){
  if(!room)throw Error('Camera nu există.');
  if(room.phase!=='lobby'||room.players.length>=room.capacity)throw Error('Camera este plină sau jocul a început.');
  p=addPilot(room,a.name);
 }else{
  if(!room||!p)throw Error('Sesiunea nu mai există. Creează o cameră nouă.');
  if(action==='rename'){
   const name=uniqueName(room,a.name,p.id);
   if(room.phase==='end'&&(room.winnerId===p.id||room.winner===p.name))room.winner=name;
   p.name=name;
  }
  if(action==='leave'){
   if(['lobby','targeting'].includes(room.phase)){
    room.players=room.players.filter(q=>q.id!==p.id);room.phase='lobby';room.selections={};room.turn=null;
   }else{
    p.left=true;p.planes.forEach(q=>q.dead=true);room.log.unshift(`${p.name} s-a retras din cameră.`);
    if(room.phase==='play'){
     if(modern(room)){eliminate(room,p);if(room.phase==='play'&&room.turn===p.id)nextTurn(room,p.id);}
     else{const remaining=room.players.filter(alive);if(remaining.length<=1){room.phase='end';room.winner=remaining[0]?.name||null;room.turn=null}else if(room.turn===p.id)nextTurn(room,p.id);}
    }
   }
  }
  if(action==='select-target'){
   if(!modern(room)||room.phase!=='targeting'||!alive(p))throw Error('Selecția țintelor nu este disponibilă.');
   if(a.revision!==row.revision)conflict();
   if(a.target!==null&&(typeof a.target!=='string'||!room.players.some(q=>q.id===a.target&&q.id!==p.id)))throw Error('Țintă invalidă.');
   const selections={...room.selections};
   if(a.target===null)delete selections[p.id];else selections[p.id]=a.target;
   const completions=circuitCompletions(room.players.map(q=>q.id),selections);
   if(!completions.length)throw Error('Această alegere nu permite un circuit unic.');
   room.selections=selections;
   if(Object.keys(selections).length===room.players.length)startCircuit(room,completions[0]);
  }
  if(action==='fleet'){
   if(p.ready||room.phase!=='lobby')throw Error('Flota este confirmată.');
   p.planes=a.planes?validFleet(a.planes):fleet();
  }
  if(action==='ready'){
   if(p.ready||room.phase!=='lobby')throw Error('Flota este deja confirmată.');
   if(a.planes)p.planes=validFleet(a.planes);
   p.ready=true;
   if(room.players.length===room.capacity&&room.players.every(p=>p.ready)){prepareCircuit(room)}
  }
  if(action==='fire'){
   if(modern(room)){
    if(typeof a.requestId!=='string'||a.requestId.length<8||a.requestId.length>80)throw Error('Identificator de atac invalid.');
    const receipt=p.attackReceipts?.find(r=>r.id===a.requestId);
    if(receipt){
     if(receipt.turn!==a.turnSeq||receipt.target!==a.target||receipt.x!==a.x||receipt.y!==a.y)throw Error('Identificator de atac reutilizat.');
     return Response.json({id:p.id,token:p.token,revision:row.revision,...view(room,p.id)},{headers:{'Cache-Control':'no-store'}});
    }
    if(a.turnSeq!==room.turnSeq)conflict();
   }
   shoot(room,p,room.players.find(t=>t.id===a.target),a.x,a.y);
   if(modern(room)){p.attackReceipts||=[];p.attackReceipts.push({id:a.requestId,turn:a.turnSeq,target:a.target,x:a.x,y:a.y});p.attackReceipts=p.attackReceipts.slice(-32);}
  }
  if(action!=='state')runBot(room);
 }
 if(action!=='state'){
  if(created)await env.DB.prepare('INSERT INTO rooms(code,data,updated_at) VALUES(?,?,?)').bind(room.code,JSON.stringify(room),Date.now()).run();
  else {const result=await env.DB.prepare('UPDATE rooms SET data=?,revision=revision+1,updated_at=? WHERE code=? AND revision=?').bind(JSON.stringify(room),Date.now(),room.code,row.revision).run();if(result.meta.changes!==1)conflict()}
 }
 return Response.json({id:p.id,token:p.token,revision:created?0:row.revision+(action==='state'?0:1),...view(room,p.id)},{headers:{'Cache-Control':'no-store'}});
}catch(e){return Response.json({error:e.message,...(e.code?{errorCode:e.code}:{})},{status:e.code==='conflict'?409:400,headers:{'Cache-Control':'no-store'}})}}};
