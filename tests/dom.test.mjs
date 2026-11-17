import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {harness} from './helpers.mjs';
const {JSDOM,VirtualConsole}=createRequire(import.meta.url)('jsdom');
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
function scene(h){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(html,{url:'https://anzosafe-oss.github.io/avioanele/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  w.matchMedia=()=>({matches:false,addEventListener(){}});Object.defineProperty(w.navigator,'maxTouchPoints',{value:1});w.crypto.randomUUID=()=>crypto.randomUUID();
  w.fetch=async(url,opts)=>{const a=JSON.parse(opts.body),r=await h.call(a,String(url).split('/').at(-1),a),{http,...data}=r;return new Response(JSON.stringify(data),{status:http});};
 }});return {dom,w:dom.window,errors};
}
const idle=async w=>{for(let i=0;i<50;i++){if(!w.eval('busy'))return;await new Promise(r=>setTimeout(r,1));}throw Error('UI busy');};
const sync=async scenes=>{for(const s of scenes)await s.w.eval("api('state')")};

test('DOM: full four-pilot UI flow, locked targets, equal cell structure and inherited radar rendering',async()=>{
 const h=harness(),scenes=Array.from({length:4},()=>scene(h));
 try{
  const a=scenes[0].w;a.document.getElementById('capacity').value='4';await a.eval("api('create',{capacity:4,name:''})");const code=a.eval('state.code');
  for(const {w} of scenes.slice(1))await w.eval(`api('join',{code:'${code}',name:''})`);
  await sync(scenes);for(const {w} of scenes){w.document.getElementById('readyBtn').click();await idle(w);}
  await sync(scenes);assert(scenes.every(s=>s.w.eval('state.phase')==='targeting'));
  assert(scenes.every(s=>s.w.document.getElementById('setup').style.display==='none'));
  const ids=scenes.map(s=>s.w.eval('session.id'));
  for(const i of [0,2,1,3]){await sync(scenes);const order=[0,2,1,3],next=order[(order.indexOf(i)+1)%4],w=scenes[i].w,select=w.document.getElementById('target');select.value=ids[next];select.dispatchEvent(new w.Event('change'));await idle(w);}
  await sync(scenes);assert(scenes.every(s=>s.w.eval('state.phase')==='play'));
  for(const {w} of scenes){assert.equal(w.document.querySelectorAll('.turn-cell').length,4);assert.equal(w.document.querySelectorAll('.turn-cell.current').length,1);assert(w.document.getElementById('target').disabled);}
  let n=0;
  while(h.room(code).phase==='play'){
   const r=h.room(code),p=r.players.find(p=>p.id===r.turn),i=ids.indexOf(p.id),target=r.players.find(t=>t.id===p.targetId),[x,y]=target.planes.find(q=>!q.dead).cells[0];
   scenes[i].w.document.querySelector(`[aria-label="Atac ${'ABCDEFGHIJ'[x]}${y+1}"]`).click();await idle(scenes[i].w);await sync(scenes);
   for(const {w} of scenes){const state=w.eval('state');if(state.phase!=='play')continue;for(const shot of state.radar){const cell=w.document.querySelector(`[aria-label="Atac ${'ABCDEFGHIJ'[shot.x]}${shot.y+1}"]`);assert(cell.disabled);assert(cell.classList.contains(shot.result));}}
   assert(++n<50);
  }
  for(const {w,errors} of scenes){assert.equal(w.document.querySelectorAll('.turn-cell.eliminated').length,3);assert.equal(w.document.getElementById('title').textContent,'Misiune încheiată');assert.deepEqual(errors,[]);}
 }finally{scenes.forEach(s=>s.dom.window.close());}
});

test('DOM: concurrent target selection refreshes conflict state and dependent options',async()=>{
 const h=harness(),ps=await h.create(4);await h.ready(ps);const scenes=[scene(h),scene(h)];
 try{for(let i=0;i<2;i++){scenes[i].w.eval(`session=${JSON.stringify(ps[i])}`);await scenes[i].w.eval("api('state')");}
  await Promise.all(scenes.map(s=>s.w.eval(`api('select-target',{target:'${ps[2].id}',revision:state.revision})`)));
  const stored=h.room(ps[0].code).selections;assert.equal(Object.keys(stored).length,1);const loser=scenes.find(s=>!stored[s.w.eval('session.id')]);assert(![...loser.w.document.getElementById('target').options].some(o=>o.value===ps[2].id));assert(scenes.every(s=>!s.w.eval('busy')));
 }finally{scenes.forEach(s=>s.dom.window.close());}
});

test('DOM: pull refresh stays a compact fixed top indicator and refreshes the same session',async()=>{
 const h=harness(),ps=await h.create(2);await h.ready(ps);const s=scene(h),w=s.w;
 try{w.eval(`session=${JSON.stringify(ps[0])}`);await w.eval("api('state')");const target=w.document.getElementById('status');
  for(const [type,y] of [['touchstart',100],['touchmove',210],['touchend',0]]){const e=new w.Event(type,{bubbles:true,cancelable:true});Object.defineProperty(e,'touches',{value:type==='touchend'?[]:[{clientX:50,clientY:y}]});target.dispatchEvent(e);}
  await idle(w);await new Promise(r=>setTimeout(r,10));const indicator=w.document.getElementById('pull-refresh-indicator');assert.equal(indicator.dataset.state,'done');assert.equal(indicator.textContent,'Date actualizate');assert.equal(w.getComputedStyle(indicator).position,'fixed');assert.equal(w.getComputedStyle(indicator.querySelector('svg')).width,'20px');assert.equal(w.eval('session.id'),ps[0].id);assert.deepEqual(s.errors,[]);
 }finally{w.close();}
});

test('DOM: retry after a lost attack response reuses request id and does not fire twice',async()=>{
 const h=harness(),ps=await h.create(2);await h.ready(ps);const s=scene(h),w=s.w;
 try{w.eval(`session=${JSON.stringify(ps[0])}`);await w.eval("api('state')");const normal=w.fetch;let lose=true;
  w.fetch=async(url,opts)=>{const response=await normal(url,opts);if(lose&&String(url).endsWith('/fire')){lose=false;throw Error('simulated response loss');}return response;};
  w.eval('fire(9,9)');await idle(w);assert.equal(h.room(ps[0].code).players[0].shots.length,1);
  w.eval('fire(9,9)');await idle(w);assert.equal(h.room(ps[0].code).players[0].shots.length,1);assert.equal(w.eval('state.turn'),ps[1].id);assert.deepEqual(s.errors,[]);
 }finally{w.close();}
});
