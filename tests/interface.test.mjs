import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {harness} from './helpers.mjs';
const {chromium,webkit,devices}=createRequire(import.meta.url)('playwright');
const mime={html:'text/html',png:'image/png',webp:'image/webp',ico:'image/x-icon',webmanifest:'application/manifest+json'};
const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;const file=path==='/'?'index.html':path.slice(1);if(file.includes('..'))throw Error();const data=await readFile(new URL('../'+file,import.meta.url));res.writeHead(200,{'Content-Type':mime[file.split('.').at(-1)]||'text/plain'});res.end(data);}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+server.address().port;
const matrix=[['desktop Chromium',chromium,{viewport:{width:1280,height:900}}],['iPhone WebKit emulation',webkit,devices['iPhone 13']],['Android Chromium emulation',chromium,devices['Pixel 7']]];
for(const [name,engine,device] of matrix)test(name,{timeout:60000},async()=>{
 const browser=await engine.launch({headless:true,...(engine===chromium&&(process.env.CHROMIUM_EXECUTABLE_PATH||(!existsSync(chromium.executablePath())&&existsSync('/usr/bin/chromium')))?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium'}:{})}),h=harness(),contexts=[],pages=[],errors=[];
 try{
  for(let i=0;i<4;i++){
   const context=await browser.newContext({...device});contexts.push(context);
   await context.route('https://fonts.googleapis.com/**',r=>r.abort());
   await context.route('https://fonts.gstatic.com/**',r=>r.abort());
   await context.route('https://caajrctjlxehhofuwhag.supabase.co/functions/v1/avioanele/**',async route=>{
    const a=route.request().postDataJSON(),action=route.request().url().split('/').at(-1),r=await h.call(a,action,a);const {http,...data}=r;
    await route.fulfill({status:http,contentType:'application/json',body:JSON.stringify(data)});
   });
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));pages.push(page);await page.goto(url);
  }
  await pages[0].selectOption('#capacity','4');await pages[0].getByRole('button',{name:'Creează o cameră'}).click();await pages[0].waitForFunction(()=>state?.players.length===1);
  const code=await pages[0].locator('#roomCode').textContent();
  for(let i=1;i<4;i++){await pages[i].fill('#code',code);await pages[i].getByRole('button',{name:'Intră →',exact:true}).click();await pages[i].waitForFunction(()=>state?.phase==='lobby');}
  const sessions=await Promise.all(pages.map(p=>p.evaluate(()=>session)));
  const sync=async()=>{for(const page of pages){await page.waitForFunction(()=>!busy);await page.evaluate(()=>api('state'));}};
  await sync();
  for(let i=0;i<4;i++){await pages[i].locator('#readyBtn').click();await pages[i].waitForFunction(()=>state.players.find(p=>p.id===session.id).ready);}
  await sync();
  assert.equal(await pages[0].locator('#turnIndicator').isVisible(),false);
  assert.equal(await pages[0].locator('#setup').isVisible(),false);
  for(const i of [0,2,1,3]){
   await sync();const order=[0,2,1,3],next=order[(order.indexOf(i)+1)%4];await pages[i].selectOption('#target',sessions[next].id);await pages[i].waitForFunction(()=>!busy);
  }
  await sync();
  for(const page of pages){
   assert.equal(await page.locator('#turnIndicator .turn-cell').count(),4);
   assert.equal(await page.locator('#target').isDisabled(),true);
   const geometry=await page.evaluate(()=>{const bar=document.getElementById('turnIndicator').getBoundingClientRect();return {widths:[...document.querySelectorAll('.turn-cell')].map(c=>c.getBoundingClientRect().width),bottom:bar.bottom,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth};});
   assert(Math.max(...geometry.widths)-Math.min(...geometry.widths)<1);assert(Math.abs(geometry.bottom-geometry.height)<2);assert(!geometry.overflow);
   const before=await page.locator('header').boundingBox();await page.locator('#appScroll').evaluate(el=>el.scrollTop=600);const after=await page.locator('header').boundingBox();assert.equal(before.y,after.y);
  }
  // Exercise real UI attack, eliminating each target through the actual API handler.
  let turn=0;
  while(h.room(code).phase==='play'){
   await sync();const room=h.room(code),p=room.players.find(p=>p.id===room.turn),i=sessions.findIndex(s=>s.id===p.id),target=room.players.find(t=>t.id===p.targetId),[x,y]=target.planes.find(q=>!q.dead).cells[0];
   await pages[i].getByRole('button',{name:`Atac ${'ABCDEFGHIJ'[x]}${y+1}`,exact:true}).click();await pages[i].waitForFunction(seq=>!busy&&state.turnSeq>seq,room.turnSeq);assert(++turn<40);
   await sync();
   for(let j=0;j<4;j++){const state=await pages[j].evaluate(()=>window.eval('state'));if(state.phase==='play'){
    for(const shot of state.radar){const cell=pages[j].getByRole('button',{name:`Atac ${'ABCDEFGHIJ'[shot.x]}${shot.y+1}`,exact:true});assert(await cell.isDisabled());assert((await cell.getAttribute('class')).includes(shot.result));}
    if(!state.players.find(p=>p.id===state.id).alive){assert(await pages[j].locator('#target').isDisabled());assert.equal((await pages[j].locator('#enemy button:not([disabled])').count()),0);}
   }}
  }
  await sync();for(const page of pages){assert.equal(await page.locator('.turn-cell.eliminated').count(),3);assert.equal(await page.locator('#title').textContent(),'Misiune încheiată');}
  if(device.hasTouch){
   const page=pages[0];await page.locator('#appScroll').evaluate(el=>el.scrollTop=0);await page.waitForFunction(()=>!busy);
   const before=await page.locator('header').boundingBox();
   await page.evaluate(()=>{const target=document.getElementById('status');for(const [type,y] of [['touchstart',150],['touchmove',270]]){const e=new Event(type,{bubbles:true,cancelable:true});Object.defineProperty(e,'touches',{value:[{clientX:100,clientY:y}]});target.dispatchEvent(e);}});
   assert(await page.locator('#pull-refresh-indicator').isVisible());const refreshBox=await page.locator('#pull-refresh-indicator').boundingBox();assert(refreshBox.y>=before.y+before.height);assert(refreshBox.height<60);
   await page.evaluate(()=>{const e=new Event('touchend',{bubbles:true});Object.defineProperty(e,'touches',{value:[]});document.dispatchEvent(e);});
   await page.waitForFunction(()=>document.getElementById('pull-refresh-indicator').dataset.state==='done');
   assert.equal((await page.locator('header').boundingBox()).y,before.y);
  }
  await pages[0].screenshot({path:'/tmp/avioanele-'+name.split(' ')[0]+'.png'});
  assert.deepEqual(errors,[]);
 }finally{await Promise.all(contexts.map(c=>c.close()));await browser.close();}
});
test.after(()=>new Promise(resolve=>server.close(resolve)));
