import fs from 'fs';
const src = fs.readFileSync('/Users/macbookair2022/.kelvers/OmniAntigravityRemoteChat/src/server.js','utf8');
// Extract the REAL function text from the deployed source, don't retype it.
const m = src.match(/let sendLock = Promise\.resolve\(\);\nfunction withSendLock\(fn\) \{[\s\S]*?\n\}/);
if (!m) { console.log('FAIL: could not extract withSendLock from source'); process.exit(1); }
console.log('extracted from source:\n' + m[0].split('\n').map(l=>'    '+l).join('\n'));
const withSendLock = new Function(m[0] + '; return withSendLock;')();

let log = [];
const t0 = Date.now();
// 1. a throwing task must RESOLVE {threw}, never reject
const a = await withSendLock(async () => { throw new Error('boom'); });
log.push(['throwing task resolves with sentinel', !!a.threw && a.threw.message === 'boom']);
// 2. the chain must survive that throw — next task still runs
const b = await withSendLock(async () => 'alive');
log.push(['chain survives a throw', b === 'alive']);
// 3. serialization: overlapping tasks must not interleave
let order = [];
const p1 = withSendLock(async () => { order.push('s1'); await new Promise(r=>setTimeout(r,120)); order.push('e1'); });
const p2 = withSendLock(async () => { order.push('s2'); await new Promise(r=>setTimeout(r,10));  order.push('e2'); });
await Promise.all([p1,p2]);
log.push(['tasks serialized (no interleave)', order.join(',') === 's1,e1,s2,e2']);
// 4. a throw must not break serialization either
order = [];
const q1 = withSendLock(async () => { order.push('s1'); await new Promise(r=>setTimeout(r,80)); throw new Error('x'); });
const q2 = withSendLock(async () => { order.push('s2'); });
await Promise.all([q1,q2]);
log.push(['serialization holds across a throw', order.join(',') === 's1,s2']);

let pass = true;
for (const [name, ok] of log) { console.log(`  ${ok ? 'PASS' : '*** FAIL'}  ${name}`); if(!ok) pass=false; }
console.log(pass ? 'ALL PASS' : 'FAILURES PRESENT');
process.exit(pass?0:1);
