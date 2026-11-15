const HTML="";
const ASSETS={};
const randomUUID=()=>crypto.randomUUID(),randomInt=n=>{let a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]%n};
const shape=[[0,0],[-2,1],[-1,1],[0,1],[1,1],[2,1],[0,2],[-1,3],[0,3],[1,3]];
function cells(x,y,r){return shape.map(([a,b])=>{for(let i=0;i<r;i++) [a,b]=[-b,a];return [x+a,y+b]})}
function fleet(){let planes=[];for(let i=0;i<3;i++){let p;for(let tries=0;tries<10000;tries++){let c=cells(randomInt(10),randomInt(10),randomInt(4));if(c.every(([x,y])=>x>=0&&y>=0&&x<10&&y<10&&!planes.some(p=>p.cells.some(([a,b])=>a===x&&b===y)))){p={cells:c,dead:false};break}}if(!p)return fleet();planes.push(p)}return planes}
function view(room,id){return {code:room.code,capacity:room.capacity,phase:room.phase,turn:room.turn,winner:room.winner,log:room.log,players:room.players.map(p=>({id:p.id,name:p.name,ready:p.ready,alive:p.planes.filter(x=>!x.dead).length,shots:p.shots,...(p.id===id?{planes:p.planes}:room.phase==='end'?{planes:p.planes}:{})}))}}

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
 if(room.phase!=='play'||room.turn!==p.id)throw Error('Așteaptă-ți rândul.');
 if(!t||t===p||t.planes.every(q=>q.dead))throw Error('Alege un adversar activ.');
 if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>9||y<0||y>9)throw Error('Coordonate invalide.');
 if(p.shots.some(s=>s.target===t.id&&s.x===x&&s.y===y))throw Error('Ai atacat deja această celulă.');
 const plane=t.planes.find(q=>q.cells.some(([a,b])=>a===x&&b===y));let result='miss';
 if(plane){result='hit';if(plane.cells[0][0]===x&&plane.cells[0][1]===y){plane.dead=true;result='kill'}}
 p.shots.push({target:t.id,x,y,result});
 room.log.unshift({actorId:p.id,text:`${p.name} → ${t.name} · ${'ABCDEFGHIJ'[x]}${y+1}: ${result==='kill'?'Avion doborât!':result==='hit'?'Lovit':'Ratat'}`});room.log=room.log.slice(0,40);
 const alive=room.players.filter(p=>p.planes.some(q=>!q.dead));
 if(alive.length===1){room.phase='end';room.winner=alive[0].name;room.turn=null}
 else {let i=room.players.indexOf(p);do{i=(i+1)%room.players.length}while(!room.players[i].planes.some(q=>!q.dead));room.turn=room.players[i].id}
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
 if(!['create','join','state','fleet','ready','fire','leave','rename'].includes(action))throw Error('Acțiune necunoscută.');
 const code=String(a.code||'').toUpperCase(),row=code?await env.DB.prepare('SELECT data, revision FROM rooms WHERE code = ?').bind(code).first():null;
 let room=row?JSON.parse(row.data):null,p=room?.players.find(p=>!p.bot&&!p.left&&p.id===a.id&&p.token===a.token),created=false;
 if(action==='create'){
  let code;do{code=randomUUID().replaceAll('-','').slice(0,8).toUpperCase()}while(await env.DB.prepare('SELECT code FROM rooms WHERE code = ?').bind(code).first());
  p=pilot(a.name);room={code,capacity:a.bot?2:([2,3,4].includes(a.capacity)?a.capacity:2),phase:'lobby',players:[p],turn:null,log:[]};
  if(a.bot)room.players.push(pilot('Copilot · bot',true));created=true;
 }else if(action==='join'){
  if(!room)throw Error('Camera nu există.');
  if(room.phase!=='lobby'||room.players.length>=room.capacity)throw Error('Camera este plină sau jocul a început.');
  p=pilot(a.name);room.players.push(p);
 }else{
  if(!room||!p)throw Error('Sesiunea nu mai există. Creează o cameră nouă.');
  if(action==='rename'){
   if(typeof a.name!=='string'||!a.name.trim()||a.name.trim().length>18||/[\x00-\x1f\x7f]/.test(a.name))throw Error('Alege un indicativ de 1–18 caractere.');
   const name=a.name.trim();if(room.players.some(q=>q.id!==p.id&&q.name.toLocaleLowerCase()===name.toLocaleLowerCase()))throw Error('Acest indicativ este deja folosit.');
   if(room.phase==='end'&&room.winner===p.name)room.winner=name;
   p.name=name;
  }
  if(action==='leave'){
   if(room.phase==='lobby')room.players=room.players.filter(q=>q.id!==p.id);
   else{p.left=true;p.planes.forEach(q=>q.dead=true);room.log.unshift(`${p.name} s-a retras din cameră.`);
    if(room.phase==='play'){const alive=room.players.filter(q=>q.planes.some(f=>!f.dead));if(alive.length<=1){room.phase='end';room.winner=alive[0]?.name||null;room.turn=null}else if(room.turn===p.id){let i=room.players.indexOf(p);do{i=(i+1)%room.players.length}while(!room.players[i].planes.some(f=>!f.dead));room.turn=room.players[i].id}}
   }
  }
  if(action==='fleet'){
   if(p.ready||room.phase!=='lobby')throw Error('Flota este confirmată.');
   p.planes=a.planes?validFleet(a.planes):fleet();
  }
  if(action==='ready'){
   if(p.ready||room.phase!=='lobby')throw Error('Flota este deja confirmată.');
   if(a.planes)p.planes=validFleet(a.planes);
   p.ready=true;
   if(room.players.length===room.capacity&&room.players.every(p=>p.ready)){room.phase='play';room.turn=room.players[0].id;room.log.unshift('Toți piloții sunt pregătiți. Începe misiunea!')}
  }
  if(action==='fire'){
   shoot(room,p,room.players.find(t=>t.id===a.target),a.x,a.y);
   // Judge resolves outcomes separately. The policy sees ONLY its prior attacks.
   const bot=room.players.find(q=>q.bot&&q.id===room.turn);
   if(room.phase==='play'&&bot){const target=room.players.find(q=>!q.bot&&q.planes.some(p=>!p.dead));const move=chooseBotShot(bot.shots.map(({x,y,result})=>({x,y,result})));if(move)shoot(room,bot,target,move.x,move.y)}
  }
 }
 if(action!=='state'){
  if(created)await env.DB.prepare('INSERT INTO rooms(code,data,updated_at) VALUES(?,?,?)').bind(room.code,JSON.stringify(room),Date.now()).run();
  else {const result=await env.DB.prepare('UPDATE rooms SET data=?,revision=revision+1,updated_at=? WHERE code=? AND revision=?').bind(JSON.stringify(room),Date.now(),room.code,row.revision).run();if(result.meta.changes!==1)throw Error('Camera s-a actualizat. Încearcă din nou.')}
 }
 return Response.json({id:p.id,token:p.token,...view(room,p.id)},{headers:{'Cache-Control':'no-store'}});
}catch(e){return Response.json({error:e.message},{status:400,headers:{'Cache-Control':'no-store'}})}}};
