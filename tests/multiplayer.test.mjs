import test from 'node:test';
import assert from 'node:assert/strict';
import game,{circuitCompletions,chooseBotShot} from '../server-game.js';

import {harness,specs} from './helpers.mjs';
function freeCell(history,start=0){for(let n=start;n<start+100;n++){let x=n%10,y=Math.floor(n%100/10);if(!history.some(s=>s.x===x&&s.y===y))return {x,y};}throw Error('no free cell');}
function unhitHead(room,p){const t=room.players.find(t=>t.id===p.targetId);return t.planes.find(q=>!q.dead).cells[0];}
async function finish(h,pilots){let turns=0;while(h.room(pilots[0].code).phase==='play'){
 const before=h.room(pilots[0].code),p=before.players.find(p=>p.id===before.turn),session=pilots.find(s=>s.id===p.id),[x,y]=unhitHead(before,p);
 const r=await h.shot(session,x,y);assert.equal(r.http,200,r.error);const after=h.room(session.code);
 assert.equal(after.players.flatMap(p=>p.shots).length,before.players.flatMap(p=>p.shots).length+1);
 if(after.phase==='play'){const order=after.turnOrder;let i=order.indexOf(p.id);do{i=(i+1)%order.length}while(!after.players.find(p=>p.id===order[i]).planes.some(q=>!q.dead));assert.equal(after.turn,order[i]);}
 assert(++turns<50);
 }return h.room(pilots[0].code);}

for(const n of [2,3,4])test(`complete ${n}-pilot game; stable chronological turns and one winner`,async()=>{
 const h=harness(),pilots=await h.create(n);assert.deepEqual(h.room(pilots[0].code).players.map(p=>p.name),pilots.map((_,i)=>'MIG'+(i+1)));
 const s=await h.ready(pilots);assert.equal(s.phase,n===2?'play':'targeting');
 if(n>2){assert.equal(s.turn,null);assert.deepEqual(s.turnOrder,[]);await h.choose(pilots,n===4?[0,2,1,3]:[0,1,2]);}
 const result=await finish(h,pilots);assert.equal(result.phase,'end');assert.equal(result.players.filter(p=>p.planes.some(q=>!q.dead)).length,1);
 assert(result.winnerId);assert.equal(result.turn,null);assert.equal(result.turnOrder.length,n);
});

test('all 2–4 pilot circuits are single closed cycles; incompatible subcycles rejected',async()=>{
 for(let n=2;n<=4;n++){
  const ids=Array.from({length:n},(_,i)=>String(i)),cycles=circuitCompletions(ids);
  assert.equal(cycles.length,[0,0,1,2,6][n]);
  for(const c of cycles){const seen=new Set();let p=ids[0];for(let i=0;i<n;i++){assert(!seen.has(p));seen.add(p);p=c[p];}assert.equal(p,ids[0]);assert.equal(seen.size,n);for(const id of ids)assert.notEqual(c[id],id);}
 }
 const h=harness(),ps=await h.create(4);await h.ready(ps);
 const state=await h.call(ps[0],'state');assert.equal((await h.call(ps[0],'select-target',{target:ps[1].id,revision:state.revision})).http,200);
 const b=await h.call(ps[1],'state');assert(!b.targetOptions.includes(ps[0].id));
 assert.equal((await h.call(ps[1],'select-target',{target:ps[0].id,revision:b.revision})).http,400);
 assert.equal((await h.call(ps[1],'select-target',{target:ps[1].id,revision:b.revision})).http,400);
});

test('simultaneous target claims: only one commits; refreshed loser cannot claim occupied target',async()=>{
 const h=harness(),ps=await h.create(4);await h.ready(ps);const s=await h.call(ps[0],'state');
 const rs=await Promise.all([0,1].map(i=>h.call(ps[i],'select-target',{target:ps[2].id,revision:s.revision})));
 assert.deepEqual(rs.map(r=>r.http).sort(),[200,409]);
 const loser=rs.findIndex(r=>r.http===409),latest=await h.call(ps[loser],'state');assert(!latest.targetOptions.includes(ps[2].id));
 assert.equal((await h.call(ps[loser],'select-target',{target:ps[2].id,revision:latest.revision})).http,400);
});

test('selection changes update peer options and preserve at least one valid completion',async()=>{
 const h=harness(),ps=await h.create(4);await h.ready(ps);
 let a=await h.call(ps[0],'state');await h.call(ps[0],'select-target',{target:ps[1].id,revision:a.revision});
 let b=await h.call(ps[1],'state');assert(!b.targetOptions.includes(ps[0].id));
 a=await h.call(ps[0],'state');assert.equal((await h.call(ps[0],'select-target',{target:ps[2].id,revision:a.revision})).http,200);
 b=await h.call(ps[1],'state');assert(b.targetOptions.includes(ps[0].id));assert(!b.targetOptions.includes(ps[2].id));
});

test('radar inheritance preserves miss/hit/kill and original authors; inherited cells are blocked',async()=>{
 const h=harness(),ps=await h.create(3);await h.ready(ps);await h.choose(ps);
 const aMoves=[[9,9],[2,0],[7,0],[2,5]],bMoves=[[9,9],[2,1],[2,0]],cMoves=[[9,9],[8,9],[7,9],[6,9]];
 for(let round=0;round<4;round++){
  assert.equal((await h.shot(ps[0],...aMoves[round])).http,200);
  if(round<3)assert.equal((await h.shot(ps[1],...bMoves[round])).http,200);
  assert.equal((await h.shot(ps[2],...cMoves[round])).http,200);
 }
 const a=await h.call(ps[0],'state');assert.equal(a.targetId,ps[2].id);assert.deepEqual(a.radar.map(s=>s.result),['miss','hit','kill']);assert(a.radar.every(s=>s.actorId===ps[1].id));
 const snapshot=structuredClone(h.db.rows.get(a.code));
 assert.equal((await h.shot(ps[0],9,9)).http,400);assert.deepEqual(h.db.rows.get(a.code),snapshot);
 assert.equal(h.room(a.code).players[0].shots.length,4);assert.equal(h.room(a.code).players[1].shots.length,3);
 const spectator=await h.call(ps[1],'state');assert.equal(spectator.http,200);assert.deepEqual(spectator.radar,[]);assert(!spectator.players[2].planes);assert.equal(spectator.players[1].alive,0);
 assert.equal((await h.shot(ps[1],0,9)).http,400);
 assert.equal((await h.call(ps[1],'select-target',{target:ps[0].id,revision:spectator.revision})).http,400);
 assert.equal((await h.call(ps[1],'fleet')).http,400);assert.equal((await h.call(ps[1],'ready')).http,400);
 await finish(h,ps);
});

test('successive elimination transfers inherited radar through 4 → 3 → 2 → 1',async()=>{
 const h=harness(),ps=await h.create(4);await h.ready(ps);await h.choose(ps);const counts=new Map(),sizes=[4];
 while(h.room(ps[0].code).players[1].planes.some(q=>!q.dead)){
  const room=h.room(ps[0].code),p=room.players.find(p=>p.id===room.turn),idx=ps.findIndex(s=>s.id===p.id),n=counts.get(idx)||0;counts.set(idx,n+1);
  let move;if(idx===1&&n<3||idx===0&&n>=3)move=unhitHead(room,p);else{
   const s=await h.call(ps[idx],'state');const cell=freeCell(s.radar,90);move=[cell.x,cell.y];
  }
  const r=await h.shot(ps[idx],...move);assert.equal(r.http,200,r.error);
  const active=h.room(ps[0].code).players.filter(p=>p.planes.some(q=>!q.dead)).length;if(active!==sizes.at(-1))sizes.push(active);
 }
 const s=await h.call(ps[0],'state');assert.equal(s.targetId,ps[3].id);assert(s.radar.some(x=>x.actorId===ps[2].id));assert(s.radar.some(x=>x.actorId===ps[1].id));
 assert.equal(new Set(s.radar.map(x=>`${x.x},${x.y}`)).size,s.radar.length);
 const ended=await finish(h,ps);sizes.push(ended.players.filter(p=>p.planes.some(q=>!q.dead)).length);assert.deepEqual(sizes,[4,3,2,1]);
});

test('auth, unauthorized target, out-of-turn, replay, late attack and atomic simultaneous attack',async()=>{
 const h=harness(),ps=await h.create(3);await h.ready(ps);await h.choose(ps);
 assert.equal((await h.call({...ps[0],token:'wrong'},'state')).http,400);
 const s=await h.call(ps[0],'state'),attack={target:s.targetId,x:9,y:9,turnSeq:s.turnSeq,requestId:crypto.randomUUID()};
 assert.equal((await h.call(ps[0],'fire',{...attack,target:ps[2].id})).http,400);
 assert.equal((await h.call(ps[1],'fire',{...attack,target:ps[2].id})).http,400);
 const before=h.db.rows.get(s.code).revision;
 const rs=await Promise.all([h.call(ps[0],'fire',attack),h.call(ps[0],'fire',attack)]);assert.deepEqual(rs.map(r=>r.http).sort(),[200,409]);assert.equal(h.db.rows.get(s.code).revision,before+1);
 assert.equal((await h.call(ps[0],'fire',attack)).http,200);assert.equal(h.db.rows.get(s.code).revision,before+1);
 assert.equal((await h.call(ps[0],'fire',{...attack,x:8})).http,400);
 assert.equal((await h.call(ps[0],'fire',{...attack,requestId:crypto.randomUUID()})).http,409);
 for(const i of [1,2])assert.equal((await h.shot(ps[i],9,9)).http,200);
 assert.equal((await h.call(ps[0],'fire',{...attack,requestId:crypto.randomUUID()})).http,409);
 const reconnect=await h.call({...ps[0]},'state');assert.equal(reconnect.targetId,s.targetId);assert.equal(reconnect.turnSeq,4);assert.deepEqual(reconnect.turnOrder,ps.map(p=>p.id));
 assert(reconnect.players.filter(p=>p.id!==ps[0].id).every(p=>!p.planes&&!('token' in p)&&p.shots.every(x=>x.target===ps[0].id)));
});

test('departure during selection resets circuit, frees a stable slot and accepts replacement',async()=>{
 const h=harness(),ps=await h.create(4);await h.ready(ps);const s=await h.call(ps[0],'state');await h.call(ps[0],'select-target',{target:ps[1].id,revision:s.revision});
 assert.equal((await h.call(ps[1],'leave')).http,200);const room=h.room(ps[0].code);assert.equal(room.phase,'lobby');assert.deepEqual(room.selections,{});assert.deepEqual(room.players.map(p=>p.name),['MIG1','MIG3','MIG4']);
 const replacement=await h.call({code:s.code},'join');assert.equal(replacement.players.find(p=>p.id===replacement.id).name,'MIG2');
 const newSession=h.session(replacement);await h.call(newSession,'ready',{planes:specs});const all=[ps[0],ps[2],ps[3],newSession];await h.choose(all);await finish(h,all);
});

test('manual naming remains unique, supports reserved MIG collisions and never changes internal ids',async()=>{
 const h=harness();const a=await h.call(null,'create',{capacity:4,name:'MIG2'}),s=h.session(a);
 const b=await h.call({code:a.code},'join');assert.equal(b.players.find(p=>p.id===b.id).name,'MIG1');
 assert.equal((await h.call(s,'rename',{name:'mig1'})).http,400);
 assert.equal((await h.call(s,'rename',{name:'Alpha'})).http,200);assert.equal((await h.call(s,'state')).id,s.id);
 assert.equal((await h.call({code:a.code},'join',{name:'Alpha'})).http,400);
});

test('explicit departure in play reconnects circuit and skips the departing turn; disconnect does nothing',async()=>{
 const h=harness(),ps=await h.create(4);await h.ready(ps);await h.choose(ps);
 const r=await h.call(ps[0],'leave');assert.equal(r.http,200);const s=await h.call(ps[3],'state');assert.equal(s.targetId,ps[1].id);assert.equal(s.turn,ps[1].id);
 assert.equal((await h.call(ps[0],'state')).http,400);const before=h.db.rows.get(s.code);await h.call(ps[1],'state');assert.deepEqual(h.db.rows.get(s.code),before);await finish(h,ps);
});

test('Copilot remains functional through a full game and policy receives only discovered history',async()=>{
 const h=harness(),ps=await h.create(2,true);await h.ready(ps);let n=0;
 while(h.room(ps[0].code).phase==='play'){
  const s=await h.call(ps[0],'state');assert.equal(s.turn,ps[0].id);const cell=freeCell(s.radar);const r=await h.shot(ps[0],cell.x,cell.y);assert.equal(r.http,200,r.error);assert(++n<=100);
 }
 assert.equal(h.room(ps[0].code).phase,'end');const h1=[{x:0,y:0,result:'hit'}];assert.deepEqual(chooseBotShot(h1,()=>0),{x:1,y:0});assert.equal(chooseBotShot(Array.from({length:100},(_,i)=>({x:i%10,y:Math.floor(i/10),result:'miss'}))),null);
});

test('legacy play retains free targeting and sessions; legacy lobby upgrades without resetting pilots',async()=>{
 const h=harness(),ps=await h.create(3);await h.ready(ps);await h.choose(ps);let r=h.room(ps[0].code);delete r.rulesVersion;delete r.turnOrder;h.db.rows.get(r.code).data=JSON.stringify(r);
 const before=await h.call(ps[0],'state');assert(!before.rulesVersion);assert.equal((await h.call(ps[0],'fire',{target:ps[2].id,x:9,y:9})).http,200);
 const h2=harness(),legacy=await h2.create(2);r=h2.room(legacy[0].code);delete r.rulesVersion;r.players[0].name='AnZo';h2.db.rows.get(r.code).data=JSON.stringify(r);
 await h2.ready(legacy);const after=await h2.call(legacy[0],'state');assert.equal(after.rulesVersion,2);assert.equal(after.players[0].name,'AnZo');assert.equal(after.id,legacy[0].id);
});

test('missing/malformed target cannot auto-complete a selection; circuit can be cleared',async()=>{
 const h=harness(),ps=await h.create(3);await h.ready(ps);
 let s=await h.call(ps[0],'state');await h.call(ps[0],'select-target',{target:ps[1].id,revision:s.revision});
 s=await h.call(ps[1],'state');await h.call(ps[1],'select-target',{target:ps[2].id,revision:s.revision});
 s=await h.call(ps[2],'state');const before=h.db.rows.get(s.code).revision;
 for(const target of [undefined,'',false,ps[2].id,'not-a-pilot'])assert.equal((await h.call(ps[2],'select-target',{target,revision:s.revision})).http,400);
 assert.equal(h.db.rows.get(s.code).revision,before);assert.equal(h.room(s.code).phase,'targeting');
 s=await h.call(ps[0],'state');assert.equal((await h.call(ps[0],'select-target',{target:null,revision:s.revision})).http,200);assert(!h.room(s.code).selections[ps[0].id]);
});

test('simultaneous final head shots commit elimination, radar transfer and next turn once',async()=>{
 const h=harness(),ps=await h.create(3);await h.ready(ps);await h.choose(ps);
 for(let round=0;round<2;round++){await h.shot(ps[0],...[[2,0],[7,0]][round]);await h.shot(ps[1],...[[9,9],[2,1]][round]);await h.shot(ps[2],9-round,9);}
 const s=await h.call(ps[0],'state'),attack={target:ps[1].id,x:2,y:5,turnSeq:s.turnSeq,requestId:crypto.randomUUID()};
 const rs=await Promise.all([h.call(ps[0],'fire',attack),h.call(ps[0],'fire',{...attack,requestId:crypto.randomUUID()})]);assert.deepEqual(rs.map(r=>r.http).sort(),[200,409]);
 const after=await h.call(ps[0],'state');assert.equal(after.targetId,ps[2].id);assert.equal(after.turn,ps[2].id);assert.equal(after.turnSeq,s.turnSeq+1);assert.equal(after.radar.length,2);assert.equal(h.room(s.code).players[0].shots.length,3);
});
