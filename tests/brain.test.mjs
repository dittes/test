import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { median, makeNumber, normalizeDigits, typingScore, nextWord, targetPosition, words, passage } from '../assets/brain-core.js';
import { brainPages } from '../content/brain-pages.mjs';

test('median uses the middle sample without mutating a run',()=>{
 const samples=[450,200,210,900,220];
 assert.equal(median(samples),220);assert.deepEqual(samples,[450,200,210,900,220]);
 assert.equal(median([]),0);assert.equal(median([100,200]),150);
});
test('digit strings preserve precision and never begin with zero',()=>{
 assert.equal(makeNumber(20,()=>0),'10000000000000000000');
 assert.equal(makeNumber(20,()=>.999),'99999999999999999999');
 assert.equal(normalizeDigits('12 34\n56'),'123456');
 for(let length=1;length<=20;length++){const value=makeNumber(length);assert.equal(value.length,length);assert.match(value,/^[1-9]\d*$/);}
});
test('typing reports positional final-text accuracy and five-character WPM',()=>{
 assert.deepEqual(typingScore('hello world','hello world',60),{correct:11,wpm:2,gross:2,accuracy:100});
 assert.deepEqual(typingScore('abcde','abXde',60),{correct:4,wpm:1,gross:1,accuracy:80});
 assert.equal(typingScore('a'.repeat(200),'a'.repeat(200),60).wpm,40);
 assert.equal(typingScore('a'.repeat(200),'a'.repeat(200),30).wpm,80);
 assert.equal(typingScore('abc','',0).wpm,0);
 assert.equal(typingScore('abc','abcd',60).accuracy,75);
 assert.ok(passage.length>1500);
});
test('verbal draws distinguish unused and previously seen words',()=>{
 assert.equal(new Set(words).size,words.length);assert.ok(words.length>60);
 const seen=new Set([words[0]]);
 assert.equal(nextWord(seen,()=>0),words[0]);
 assert.ok(!seen.has(nextWord(seen,()=>.9)));
 assert.ok(words.includes(nextWord(new Set(words),()=>.9)));
 assert.equal(nextWord(new Set(),()=>0),words[0]);
});
test('aim positions fit a mobile arena and move away from the last target',()=>{
 let previous={x:8,y:8};
 for(let i=0;i<100;i++){
  const point=targetPosition(250,270,previous);
  assert.ok(point.x>=8&&point.x+48<=242);assert.ok(point.y>=8&&point.y+48<=262);
  assert.ok(Math.hypot(point.x-previous.x,point.y-previous.y)>=60);previous=point;
 }
 const fallback=targetPosition(250,270,{x:8,y:8},()=>0);
 assert.ok(Math.hypot(fallback.x-8,fallback.y-8)>=60);
});
test('brain pages ship indexable unique guides, metadata, icons and the correct loader',async()=>{
 const titles=new Set(),descriptions=new Set();
 for(const page of brainPages){
  titles.add(page.title);descriptions.add(page.description);
  const html=await readFile(new URL(`../dist/${page.slug}/index.html`,import.meta.url),'utf8');
  assert.ok(html.includes(`<h1>${page.name}</h1>`));
  assert.ok(html.includes(`https://test.institute/${page.slug}/`));
  assert.ok(html.includes(`data-tool="${page.id}"`));
  assert.match(html,/brain-tools.css/);assert.match(html,/href="\/brain-tests\/"/);
  assert.doesNotMatch(html,/undefined|INSTRUMENT/);
  assert.ok(page.steps.length>=3&&page.faqs.length>=3&&page.method.length>=2);
 }
 assert.equal(titles.size,5);assert.equal(descriptions.size,5);
 const hub=await readFile(new URL('../dist/brain-tests/index.html',import.meta.url),'utf8');
 assert.equal((hub.match(/class="test-card"/g)||[]).length,6);
 const loader=await readFile(new URL('../assets/site.js',import.meta.url),'utf8');
 assert.match(loader,/mountBrainTool/);
});
