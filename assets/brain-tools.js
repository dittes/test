import { median, makeNumber, normalizeDigits, typingScore, nextWord, targetPosition, passage } from './brain-core.js';

const button = (label, action, secondary = false) => `<button type="button" class="button${secondary ? ' button-secondary' : ''}" data-action="${action}">${label}</button>`;
const metric = (label, key, value = '—') => `<div><dt>${label}</dt><dd data-${key}>${value}</dd></div>`;

export function mountBrainTool(root, kind) {
  const lifecycle = new AbortController();
  let timers = new Set(), frames = new Set(), active = false, interrupt = () => {};
  const on = (element, event, fn) => element.addEventListener(event, e => {
    if (event === 'click' && element.dataset?.action === 'start') game.scrollIntoView({ block: 'start', behavior: 'instant' });
    fn(e);
  }, { signal: lifecycle.signal });
  const later = (fn, delay) => { const id = setTimeout(() => { timers.delete(id); fn(); }, delay); timers.add(id); };
  const frame = fn => { const id = requestAnimationFrame(() => { frames.delete(id); fn(); }); frames.add(id); };
  const clear = () => { timers.forEach(clearTimeout); timers.clear(); frames.forEach(cancelAnimationFrame); frames.clear(); active = false; };
  root.innerHTML = `<section class="brain-tool" aria-label="${kind} game"><div class="brain-game"></div><p class="brain-status" role="status" aria-live="polite" aria-atomic="true"></p><div class="brain-footer">${button('Reset', 'reset', true)}<span>Practice game. Not an IQ or medical test. Results stay on this page.</span></div></section>`;
  const game = root.querySelector('.brain-game'), status = root.querySelector('.brain-status');
  const q = selector => game.querySelector(selector);
  const say = text => { status.textContent = text; };
  const write = (key, value) => { q(`[data-${key}]`).textContent = value; };
  const focus = element => element.focus({ preventScroll: true });
  const stop = () => { if (active) { clear(); interrupt(); say('Run cancelled because the page was hidden or the window lost focus. Start a fresh run when ready.'); } };
  on(document, 'visibilitychange', () => { if (document.hidden) stop(); });
  on(window, 'blur', stop);
  on(window, 'pagehide', event => { stop(); clear(); if (!event.persisted) lifecycle.abort(); });
  on(root, 'keydown', event => { if (event.repeat && ['Enter', ' '].includes(event.key)) event.preventDefault(); });

  function reaction() {
    game.innerHTML = `<button type="button" class="brain-reaction" data-target>Start test</button><dl class="brain-metrics">${metric('Valid attempts', 'count', '0 / 5')}${metric('Median', 'median')}${metric('Fastest', 'best')}</dl><p data-samples>Five attempts. Early clicks do not count.</p>`;
    let phase = 'idle', started = 0, values = [];
    const target = q('[data-target]');
    const reset = () => { clear(); phase = 'idle'; values = []; target.dataset.state = ''; target.textContent = 'Start test'; write('count','0 / 5'); write('median','—'); write('best','—'); write('samples','Five attempts. Early clicks do not count.'); say('Start on the blue target. Wait for green and “Click now”.'); };
    interrupt = () => { phase = 'ended'; target.dataset.state = ''; target.textContent = 'Start again'; };
    const respond = () => {
      if (phase === 'waiting') { clear(); phase = 'between'; target.dataset.state = 'early'; target.textContent = 'Too soon. Try again'; say('Early click excluded. Start this attempt again.'); return; }
      if (phase === 'ready') {
        const elapsed = Math.round(performance.now() - started); clear(); values.push(elapsed); phase = values.length === 5 ? 'ended' : 'between';
        target.dataset.state = ''; target.textContent = values.length === 5 ? 'Run complete. Try again' : 'Next attempt';
        write('count', `${values.length} / 5`); write('median', `${Math.round(median(values))} ms${values.length < 5 ? ' so far' : ''}`); write('best',`${Math.min(...values)} ms`); write('samples', values.map((v,i)=>`${i+1}: ${v} ms`).join(' · '));
        say(values.length === 5 ? `Complete. Median ${Math.round(median(values))} milliseconds over five attempts.` : `${elapsed} milliseconds. Start attempt ${values.length+1} when ready.`); return;
      }
      if (phase === 'ended') reset();
      game.scrollIntoView({ block: 'start', behavior: 'instant' });
      active = true; phase = 'waiting'; target.dataset.state = 'waiting'; target.textContent = 'Wait for green'; say('Wait for the cue.');
      later(() => frame(() => { phase = 'ready'; target.dataset.state = 'ready'; target.textContent = 'Click now'; started = performance.now(); say('Click now.'); }),1200 + Math.random()*2200);
    };
    on(target,'pointerdown',event=>{ if(event.button!==0)return; event.preventDefault(); focus(target); respond(); });
    on(target,'click',event=>{ if(event.detail===0) respond(); });
    on(target,'keydown',event=>{ if(event.repeat && ['Enter',' '].includes(event.key))event.preventDefault(); });
    reset(); return reset;
  }

  function sequence() {
    game.innerHTML = `<div class="brain-toolbar">${button('Start test','start')}<strong data-progress>Longest sequence: 0</strong></div><div class="sequence-grid" role="group" aria-label="Sequence tiles, numbered left to right">${Array.from({length:9},(_,i)=>`<button type="button" class="sequence-tile" data-tile="${i}" aria-label="Tile ${i+1}" aria-disabled="true">${i+1}</button>`).join('')}</div><p>Watch, then repeat. You can also use keys 1–9.</p>`;
    let pattern = [], index = 0, completed = 0, accepting = false;
    const tiles = [...game.querySelectorAll('[data-tile]')], start = q('[data-action=start]');
    const lock = locked => tiles.forEach(tile=>tile.setAttribute('aria-disabled',String(locked)));
    const reset = () => { clear(); pattern=[]; index=completed=0; accepting=false; lock(true); tiles.forEach(tile=>tile.classList.remove('lit')); start.disabled=false; start.textContent='Start test'; write('progress','Longest sequence: 0'); say('Watch the pattern first; answer when Your turn appears.'); };
    interrupt = () => { accepting=false; lock(true); tiles.forEach(tile=>tile.classList.remove('lit')); start.disabled=false; start.textContent='Start again'; };
    const playback = () => {
      accepting=false; lock(true); index=0; say(`Watch ${pattern.length} ${pattern.length===1?'tile':'tiles'}.`);
      pattern.forEach((tile,i)=>{ later(()=>tiles[tile].classList.add('lit'),400+i*850); later(()=>tiles[tile].classList.remove('lit'),1000+i*850); });
      later(()=>{ accepting=true; lock(false); say(`Your turn. Repeat ${pattern.length} ${pattern.length===1?'tile':'tiles'}.`); focus(tiles[0]); },400+pattern.length*850);
    };
    const answer = tile => {
      if(!accepting)return;
      if(pattern[index]!==tile){ clear(); accepting=false; lock(true); start.disabled=false; start.textContent='Try again'; say(`Run complete. Longest sequence: ${completed}. The next tile was ${pattern[index]+1}.`); focus(start); return; }
      index++;
      if(index===pattern.length){ completed=pattern.length; write('progress',`Longest sequence: ${completed}`); accepting=false; lock(true); say('Correct. Watch the next round.'); pattern.push(Math.floor(Math.random()*9)); later(playback,900); }
      else say(`Correct. ${index} of ${pattern.length} selected.`);
    };
    on(start,'click',()=>{ reset(); active=true; start.disabled=true; pattern=[Math.floor(Math.random()*9)]; playback(); });
    tiles.forEach((tile,i)=>on(tile,'click',()=>answer(i)));
    on(root,'keydown',event=>{ if(/^[1-9]$/.test(event.key)&&!event.repeat){ event.preventDefault(); answer(Number(event.key)-1); } });
    reset(); return reset;
  }

  function aim() {
    game.innerHTML = `<div class="brain-toolbar">${button('Start test','start')}<strong data-progress>0 / 20 targets</strong></div><div class="aim-arena" aria-label="Target arena"><button type="button" class="aim-target" aria-label="Hit target" hidden><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="15"/><circle cx="24" cy="24" r="7"/><path d="M24 3v10m0 22v10M3 24h10m22 0h10"/></svg></button><p data-hint>20 targets. The whole marked square counts.</p></div><dl class="brain-metrics">${metric('Total time','time')}${metric('Per target','average')}${metric('Hit accuracy','accuracy')}</dl><p data-mode>Mouse, trackpad and touch results should be compared separately.</p>`;
    const arena=q('.aim-arena'), target=q('.aim-target'), start=q('[data-action=start]');
    let hits=0,misses=0,started=0,position=null,modes=new Set();
    const reset = () => { clear(); hits=misses=0; modes.clear(); position=null; target.hidden=true; q('[data-hint]').hidden=false; start.disabled=false; start.textContent='Start test'; write('progress','0 / 20 targets'); ['time','average','accuracy'].forEach(key=>write(key,'—')); write('mode','Mouse, trackpad and touch results should be compared separately.'); say('Choose Start test, then hit each target.'); };
    interrupt=()=>{ target.hidden=true; start.disabled=false; start.textContent='Start again'; };
    const move=()=>{ const bounds=arena.getBoundingClientRect(); position=targetPosition(bounds.width-2,bounds.height-2,position); target.style.left=`${position.x}px`; target.style.top=`${position.y}px`; };
    const record=(hit,mode)=>{
      if(!active)return;
      modes.add(mode); if(hit)hits++; else misses++;
      write('progress',`${hits} / 20 targets`); write('accuracy',`${Math.round(hits/(hits+misses)*100)}%`);
      write('mode',modes.has('keyboard')?'Keyboard-assisted practice — not a pointer aim result.':`Input: ${[...modes].join(' + ')}. Compare with the same input method.`);
      if(hits===20){ const elapsed=performance.now()-started; clear(); target.hidden=true; start.disabled=false; start.textContent='Try again'; write('time',`${(elapsed/1000).toFixed(2)} s`); write('average',`${Math.round(elapsed/20)} ms`); say(`Complete. 20 hits, ${misses} misses. ${modes.has('keyboard')?'Keyboard-assisted practice.':''}`); focus(start); }
      else if(hit)move();
    };
    on(start,'click',()=>{ reset(); active=true; start.disabled=true; q('[data-hint]').hidden=true; target.hidden=false; move(); focus(target); started=performance.now(); say('Hit 20 targets.'); });
    on(arena,'pointerdown',event=>{ if(event.button!==0 || !active)return; event.preventDefault(); record(target.contains(event.target),event.pointerType||'mouse'); });
    on(target,'click',event=>{ if(event.detail===0)record(true,'keyboard'); });
    on(target,'keydown',event=>{ if(event.repeat)event.preventDefault(); });
    on(window,'resize',()=>{ if(active){ clear(); interrupt(); say('Run cancelled because the arena changed size. Start again in this orientation.'); } });
    reset(); return reset;
  }

  function number() {
    game.innerHTML = `<div class="brain-toolbar">${button('Start test','start')}<strong data-progress>Digits recalled: 0</strong></div><div class="memory-display" data-number aria-live="polite">Ready?</div><form class="number-form" hidden><label for="number-answer">What was the number?</label><input id="number-answer" name="answer" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" aria-describedby="number-help"><p id="number-help">Digits only. Spaces are allowed.</p><button class="button" type="submit">Check answer</button></form>`;
    let length=1, expected='', phase='idle';
    const start=q('[data-action=start]'), form=q('form'), input=q('input');
    const reset = () => { clear(); length=1; expected=''; phase='idle'; start.disabled=false; start.textContent='Start test'; form.hidden=true; input.value=''; input.removeAttribute('aria-invalid'); write('number','Ready?'); write('progress','Digits recalled: 0'); say('Memorize the number, then enter it after it disappears.'); };
    interrupt=()=>{ phase='ended'; expected=''; write('number','Run cancelled'); form.hidden=true; start.disabled=false; start.textContent='Start again'; };
    const show = () => {
      active=true; phase='showing'; start.disabled=true; form.hidden=true; input.value=''; input.removeAttribute('aria-invalid'); expected=makeNumber(length); write('number',expected); say(`Memorize ${length} ${length===1?'digit':'digits'}.`);
      later(()=>{ phase='answer'; write('number','Enter your answer'); form.hidden=false; say('The number is hidden. Type it in the same order.'); focus(input); },1200+600*length);
    };
    on(start,'click',()=>{ if(phase!=='next')reset(); show(); });
    on(form,'submit',event=>{
      event.preventDefault(); if(phase!=='answer')return; const answer=normalizeDigits(input.value);
      if(!/^\d+$/.test(answer)){ input.setAttribute('aria-invalid','true'); say('Enter digits 0–9, with optional spaces. This has not used your attempt.'); focus(input); return; }
      clear(); form.hidden=true; start.disabled=false; write('number',expected);
      if(answer===expected){ write('progress',`Digits recalled: ${length}`); if(length===20){phase='ended';start.textContent='Try again';say('Complete. You recalled all 20 digits.');}else{length++;phase='next';start.textContent='Next number';say('Correct. Continue when ready.');} }
      else { phase='ended'; start.textContent='Try again'; say(`Run complete. You recalled ${length-1} ${length===2?'digit':'digits'}. Your answer: ${answer}. The number was ${expected}.`); }
      focus(start);
    });
    reset(); return reset;
  }

  function verbal() {
    game.innerHTML = `<div class="brain-toolbar">${button('Start test','start')}<strong data-progress>0 correct · 3 mistakes left</strong></div><div class="memory-display" data-word aria-live="polite">Ready?</div><div class="brain-actions">${button('Seen · S','seen')}${button('New · N','new')}</div><p data-round>Up to 60 decisions. No time limit.</p>`;
    const start=q('[data-action=start]'), seenButton=q('[data-action=seen]'), newButton=q('[data-action=new]');
    let seen=new Set(), word='', correct=0, mistakes=0, decisions=0, locked=false;
    const reset=()=>{clear();seen.clear();word='';correct=mistakes=decisions=0;locked=false;start.disabled=false;start.textContent='Start test';seenButton.disabled=newButton.disabled=true;write('word','Ready?');write('progress','0 correct · 3 mistakes left');write('round','Up to 60 decisions. No time limit.');say('Choose New for a word you have not seen in this run.');};
    interrupt=()=>{start.disabled=false;start.textContent='Start again';seenButton.disabled=newButton.disabled=true;write('word','Run cancelled');};
    const draw=()=>{word=nextWord(seen);write('word',word);write('round',`Decision ${decisions+1} / 60`);locked=false;};
    const answer=guess=>{
      if(!active||locked)return; locked=true; const wasSeen=seen.has(word), right=guess===wasSeen;
      if(right)correct++;else mistakes++; decisions++;seen.add(word);write('progress',`${correct} correct · ${3-mistakes} mistakes left`);
      if(mistakes===3||decisions===60){clear();start.disabled=false;start.textContent='Try again';seenButton.disabled=newButton.disabled=true;write('round',`${decisions} decisions completed`);say(`Run complete. ${correct} correct out of ${decisions}. Last word was ${wasSeen?'Seen':'New'}.`);focus(start);}
      else{say(right?'Correct. Next word.':`That word was ${wasSeen?'Seen':'New'}. ${3-mistakes} mistakes left.`);later(draw,200);}
    };
    on(start,'click',()=>{reset();active=true;start.disabled=true;seenButton.disabled=newButton.disabled=false;draw();focus(newButton);say('Is this word Seen or New?');});
    on(seenButton,'click',()=>answer(true));on(newButton,'click',()=>answer(false));
    on(root,'keydown',event=>{if(!event.repeat&&['s','n'].includes(event.key.toLowerCase())){event.preventDefault();answer(event.key.toLowerCase()==='s');}});
    reset();return reset;
  }

  function typing() {
    game.innerHTML = `<div class="brain-toolbar">${button('Start test','start')}<strong data-clock>60 seconds</strong></div><div class="typing-passage" tabindex="0" aria-label="Passage to copy"></div><label for="typing-answer">Type the passage here</label><textarea id="typing-answer" rows="4" disabled spellcheck="false" autocomplete="off" autocapitalize="off" autocorrect="off" aria-describedby="typing-help"></textarea><p id="typing-help">Case, spaces and punctuation count. Backspace is allowed.</p><dl class="brain-metrics">${metric('Correct-character WPM','wpm')}${metric('Gross WPM','gross')}${metric('Final-text accuracy','accuracy')}</dl>`;
    const start=q('[data-action=start]'), input=q('textarea'), display=q('.typing-passage');
    let begun=null, phase='idle';
    display.textContent=passage;
    const elapsed=()=>begun===null?0:Math.min(60,(performance.now()-begun)/1000);
    const stats=seconds=>{const result=typingScore(passage,input.value,seconds);write('wpm',seconds<1?'—':result.wpm);write('gross',seconds<1?'—':result.gross);write('accuracy',`${result.accuracy}%`);return result;};
    const reset=()=>{clear();begun=null;phase='idle';input.value='';input.disabled=true;start.disabled=false;start.textContent='Start test';display.textContent=passage;display.scrollTop=0;write('clock','60 seconds');['wpm','gross','accuracy'].forEach(key=>write(key,'—'));say('Start, then type. The clock begins with your first character.');};
    interrupt=()=>{phase='ended';input.disabled=true;start.disabled=false;start.textContent='Start again';write('clock','Cancelled');};
    const finish=()=>{const seconds=elapsed();clear();phase='ended';input.disabled=true;start.disabled=false;start.textContent='Try again';const result=stats(seconds);write('clock',`${seconds.toFixed(1)} seconds`);say(`Complete. ${result.wpm} correct-character WPM, ${result.accuracy}% final-text accuracy.`);};
    const tick=()=>{if(phase!=='running')return;const seconds=elapsed();if(seconds>=60){finish();return;}write('clock',`${Math.ceil(60-seconds)} seconds left`);stats(seconds);later(tick,100);};
    const paint=()=>{
      const fragment=document.createDocumentFragment();
      [...passage].forEach((char,i)=>{const span=document.createElement('span');span.textContent=char;if(i<input.value.length)span.className=input.value[i]===char?'typed-correct':'typed-error';if(i===input.value.length)span.classList.add('typing-caret');fragment.append(span);});
      display.replaceChildren(fragment);const caret=display.querySelector('.typing-caret');if(caret)display.scrollTop=Math.max(0,caret.offsetTop-display.offsetTop-display.clientHeight/2);
    };
    on(start,'click',()=>{reset();phase='armed';active=true;start.disabled=true;input.disabled=false;focus(input);say('Ready. Type the first character to start the clock.');});
    on(input,'beforeinput',event=>{if(phase==='running'&&elapsed()>=60){event.preventDefault();finish();}else if(['insertFromPaste','insertFromDrop'].includes(event.inputType)){event.preventDefault();say('Please type the passage; pasted or dropped text is not scored.');}});
    for(const event of ['paste','drop'])on(input,event,e=>{e.preventDefault();say('Please type the passage; pasted or dropped text is not scored.');});
    on(input,'input',()=>{if(phase==='armed'&&input.value.length){begun=performance.now();phase='running';say('Clock running. Copy the passage; corrections are allowed.');tick();}if(phase!=='running')return;paint();stats(elapsed());if(input.value===passage)finish();});
    reset();return reset;
  }
  const reset = ({reaction,sequence,aim,number,verbal,typing})[kind]();
  on(root.querySelector('[data-action=reset]'),'click',()=>{reset();const first=game.querySelector('button');if(first)focus(first);});
}
