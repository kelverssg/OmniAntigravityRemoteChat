// Route-level invariant test: every path through a /send-shaped route must
// TERMINATE THE HTTP EXCHANGE, including a throw inside the locked task.
// adv2's point: testing withSendLock in isolation cannot see the boundary
// between express async handling and the lock contract, which is where the
// hang lived. Both pieces below are EXTRACTED from the deployed server.js.
import fs from 'fs';
import express from '/Users/macbookair2022/.kelvers/OmniAntigravityRemoteChat/node_modules/express/index.js';

const SRC = '/Users/macbookair2022/.kelvers/OmniAntigravityRemoteChat/src/server.js';
const src = fs.readFileSync(SRC, 'utf8');

const lockSrc = src.match(/let sendLock = Promise\.resolve\(\);\nfunction withSendLock\(fn\) \{[\s\S]*?\n\}/);
const threwSrc = src.match(/if \(outcome\.threw\) \{[\s\S]*?\n    \}/);
if (!lockSrc || !threwSrc) { console.log('FAIL: could not extract from source'); process.exit(1); }
console.log('extracted lock + threw-branch from deployed source\n');

const withSendLock = new Function(lockSrc[0] + '; return withSendLock;')();
// Wrap the extracted threw-branch verbatim in a route.
const handlerBody = `
return async function (req, res, mode) {
    const msgHash = 'testhash';
    const outcome = await withSendLock(async () => {
        if (mode === 'throw')  throw new Error('simulated injection failure');
        if (mode === 'dedupe') return { deduped: true };
        return { result: { ok: true, method: 'click_send' } };
    });
    ${threwSrc[0]}
    if (outcome.deduped) return res.json({ success: true, method: 'deduped' });
    return res.json({ success: true, method: outcome.result.method });
};`;
const makeHandler = new Function('withSendLock', 'console', handlerBody);
const handler = makeHandler(withSendLock, { error: () => {} });

const app = express();
app.post('/send/:mode', (req, res) => handler(req, res, req.params.mode));
const server = app.listen(4899);

async function hit(mode) {
    const t0 = Date.now();
    const r = await fetch(`http://127.0.0.1:4899/send/${mode}`, { method: 'POST' });
    return { status: r.status, body: await r.json().catch(() => null), ms: Date.now() - t0 };
}

const checks = [];
const thrown = await Promise.race([
    hit('throw'),
    new Promise(r => setTimeout(() => r({ status: 'HUNG', ms: 3000 }), 3000)),
]);
checks.push(['throw path terminates the exchange (no hang)', thrown.status !== 'HUNG']);
checks.push(['throw path answers 500', thrown.status === 500]);
checks.push(['throw path returns success:false', thrown.body?.success === false]);
checks.push(['throw path surfaces the error text', String(thrown.body?.details?.error || '').includes('simulated injection failure')]);
checks.push(['throw path is prompt (<1s)', thrown.ms < 1000]);

const ok = await hit('ok');
checks.push(['normal path still 200', ok.status === 200 && ok.body?.success === true]);
const dd = await hit('dedupe');
checks.push(['dedupe path still 200', dd.status === 200 && dd.body?.method === 'deduped']);

let pass = true;
for (const [n, v] of checks) { console.log(`  ${v ? 'PASS' : '*** FAIL'}  ${n}`); if (!v) pass = false; }
console.log('\n' + (pass ? 'ALL PASS — route-level invariant holds' : 'FAILURES PRESENT'));
server.close();
process.exit(pass ? 0 : 1);
