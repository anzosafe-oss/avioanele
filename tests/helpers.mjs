import assert from 'node:assert/strict';
import game from '../server-game.js';

// In-memory adapter implements the production row-level compare-and-swap contract.
export function memoryDB(){
 const rows=new Map();
 return {rows,prepare(sql){return {bind(...a){return {
  async first(){return structuredClone(rows.get(a[0])||null)},
  async run(){
   if(sql.startsWith('INSERT')){assert(!rows.has(a[0]));rows.set(a[0],{data:a[1],revision:0,updated_at:a[2]});return {meta:{changes:1}};}
   const r=rows.get(a[2]);if(!r||r.revision!==a[3])return {meta:{changes:0}};
   rows.set(a[2],{data:a[0],revision:r.revision+1,updated_at:a[1]});return {meta:{changes:1}};
  }
 }}}}};
}
export const specs=[{x:2,y:0,r:0},{x:7,y:0,r:0},{x:2,y:5,r:0}];
export function harness(){
 const db=memoryDB(),env={DB:db};
 async function call(session,action,extra={}){const r=await game.fetch(new Request('https://test/api/'+action,{method:'POST',body:JSON.stringify({...session,...extra})}),env);return {...await r.json(),http:r.status};}
 const room=code=>JSON.parse(db.rows.get(code).data);
 const session=s=>({id:s.id,token:s.token,code:s.code});
 async function create(n,bot=false){const a=await call(null,'create',{capacity:n,bot});assert.equal(a.http,200);const pilots=[session(a)];for(let i=1;i<n&&!bot;i++){const p=await call({code:a.code},'join');assert.equal(p.http,200);pilots.push(session(p));}return pilots;}
 async function ready(pilots){for(const p of pilots){const r=await call(p,'ready',{planes:specs});assert.equal(r.http,200,r.error);}return call(pilots[0],'state');}
 async function choose(pilots,order=pilots.map((_,i)=>i)){for(const i of order){const state=await call(pilots[i],'state');if(state.phase==='play')break;const next=order[(order.indexOf(i)+1)%order.length];const r=await call(pilots[i],'select-target',{target:pilots[next].id,revision:state.revision});assert.equal(r.http,200,r.error);}return call(pilots[0],'state');}
 async function shot(p,x,y,extras={}){const s=await call(p,'state');return call(p,'fire',{target:s.targetId,turnSeq:s.turnSeq,requestId:crypto.randomUUID(),x,y,...extras});}
 return {db,call,room,session,create,ready,choose,shot};
}
