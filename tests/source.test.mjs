import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const base='4c8e54086128558cba15cd534e0627a2001423be';
const original=path=>execFileSync('git',['show',base+':'+path],{encoding:'utf8'});
const current=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('header, all existing styles, branding assets and refresh mechanism remain unchanged',()=>{
 const before=original('index.html'),after=current('index.html');
 assert.equal(after.match(/<header>.*?<\/header>/s)[0],before.match(/<header>.*?<\/header>/s)[0]);
 assert(after.match(/<style>(.*?)<\/style>/s)[1].startsWith(before.match(/<style>(.*?)<\/style>/s)[1]));
 const marker='/* Keep the header stationary';assert.equal(after.slice(after.indexOf(marker)),before.slice(before.indexOf(marker)));
 for(const asset of execFileSync('git',['ls-tree','-r','--name-only',base],{encoding:'utf8'}).trim().split('\n').filter(p=>/\.(png|webp|ico|webmanifest)$/.test(p)))assert.equal(execFileSync('git',['hash-object',asset],{encoding:'utf8'}).trim(),execFileSync('git',['rev-parse',base+':'+asset],{encoding:'utf8'}).trim());
 assert.equal(current('server-index.ts'),original('server-index.ts'));
});
test('plane geometry, placement validation and bot targeting policy remain unchanged',()=>{
 const before=original('server-game.js'),after=current('server-game.js');
 for(const [start,end] of [['const shape=','const alive='],['export function chooseBotShot','function shoot('],['function validFleet','function pilot(']]){
  const oldEnd=start==='const shape='?'function view(':end;
  assert.equal(after.slice(after.indexOf(start),after.indexOf(end)),before.slice(before.indexOf(start),before.indexOf(oldEnd)));
 }
});
