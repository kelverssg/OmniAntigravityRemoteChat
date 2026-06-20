import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
import WebSocket from 'ws';
import { fileURLToPath } from 'url';

const PORT = 4747;
const HEALTH_URL = `http://127.0.0.1:${PORT}/health`;
const SEND_URL = `http://127.0.0.1:${PORT}/send`;
const SEEN_DIR = '/Users/macbookair2022/.claude';

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.dirname(__filename);

async function fetchJson(url, options = {}) {
    let lastErr;
    for (let i = 0; i < 15; i++) {
        try {
            const res = await fetch(url, options);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return await res.json();
        } catch (err) {
            lastErr = err;
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    throw lastErr;
}

function restartServer() {
    try {
        const output = execSync(`lsof -t -iTCP:${PORT} -sTCP:LISTEN 2>/dev/null`).toString().trim();
        if (output) {
            const pid = output.split('\n')[0].trim();
            if (pid) {
                // Verify the process is running our node server script to prevent killing wrong processes
                let isTargetServer = false;
                try {
                    const cmd = execSync(`ps -p ${pid} -o command= 2>/dev/null`).toString().trim();
                    const expectedScript = path.join(PROJECT_ROOT, 'src/server.js');
                    if (cmd.includes(expectedScript)) {
                        isTargetServer = true;
                    } else {
                        const args = cmd.split(/\s+/).filter(Boolean);
                        const vaultRoot = path.dirname(PROJECT_ROOT);
                        isTargetServer = args.some(arg => {
                            if (!arg.endsWith('src/server.js')) return false;
                            return path.resolve(PROJECT_ROOT, arg) === expectedScript || 
                                   path.resolve(vaultRoot, arg) === expectedScript;
                        });
                    }
                } catch (psErr) {
                    // If we cannot verify the command line, do not kill the listener.
                    isTargetServer = false;
                }

                if (isTargetServer) {
                    console.log(`Restarting Node server (killing PID ${pid} listening on port ${PORT})...`);
                    execSync(`kill ${pid}`);
                    console.log('Server kill signal sent.');
                    
                    // Wait to see if supervisor restarts it automatically
                    let booted = false;
                    for (let i = 0; i < 5; i++) {
                        try {
                            const healthRes = execSync(`curl -s -m 1 http://127.0.0.1:${PORT}/health`).toString();
                            if (healthRes.includes('status')) {
                                booted = true;
                                break;
                            }
                        } catch (e) {
                            // ignore
                        }
                        execSync("sleep 1");
                    }
                    
                    if (!booted) {
                        console.log('Server did not restart automatically. Spawning standalone Node server in background...');
                        const serverScript = path.join(PROJECT_ROOT, 'src/server.js');
                        const logPath = path.join(PROJECT_ROOT, 'omni-chat.log');
                        const errPath = path.join(PROJECT_ROOT, 'omni-chat.err');
                        const out = fs.openSync(logPath, 'a');
                        const err = fs.openSync(errPath, 'a');
                        const subprocess = spawn('node', [serverScript, '--mode', 'local'], {
                            cwd: PROJECT_ROOT,
                            detached: true,
                            stdio: [ 'ignore', out, err ]
                        });
                        subprocess.unref();
                        console.log('Spawned background server process.');
                    } else {
                        console.log('Server automatically restarted by supervisor.');
                    }
                    return;
                } else {
                    console.log(`Process on port ${PORT} (PID ${pid}) is not the expected server.js. Skipping kill.`);
                    return;
                }
            }
        }
        console.log(`Node server process not found listening on port ${PORT}.`);
    } catch (e) {
        console.log('Server restart failed or not needed:', e.message);
    }
}

async function getFreshSessionId() {
    for (let i = 0; i < 20; i++) {
        try {
            const health = await fetchJson(HEALTH_URL);
            if (health.cdpConnected && health.recallStats.currentSessionId !== 'none' && health.recallStats.currentSessionId !== 'default') {
                return health.recallStats.currentSessionId;
            }
        } catch (e) {
            // Server might still be booting up
        }
        await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error('CDP not connected or session ID is none/default');
}

async function connectToCDP() {
    const ports = [7800, 7801, 7802, 7803];
    for (const port of ports) {
        try {
            const res = await fetch(`http://127.0.0.1:${port}/json/list`);
            if (!res.ok) continue;
            const list = await res.json();
            const target = list.find(t => t.url?.includes('58947') || t.url?.includes('workbench') || t.webSocketDebuggerUrl);
            if (target && target.webSocketDebuggerUrl) {
                const ws = new WebSocket(target.webSocketDebuggerUrl);
                await new Promise((resolve, reject) => {
                    ws.on('open', resolve);
                    ws.on('error', reject);
                });
                ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable', params: {} }));
                await new Promise(r => setTimeout(r, 500));
                return ws;
            }
        } catch (e) {
            // ignore
        }
    }
    return null;
}

async function evaluateInBrowser(ws, expression) {
    return new Promise((resolve, reject) => {
        const id = Math.floor(Math.random() * 100000);
        const onMessage = (raw) => {
            try {
                const data = JSON.parse(raw.toString());
                if (data.id === id) {
                    ws.off('message', onMessage);
                    resolve(data.result);
                }
            } catch (err) {
                ws.off('message', onMessage);
                reject(err);
            }
        };
        ws.on('message', onMessage);
        ws.send(JSON.stringify({
            id,
            method: 'Runtime.evaluate',
            params: {
                expression,
                returnByValue: true,
                awaitPromise: true
            }
        }));
    });
}

async function runTests() {
    console.log('=== Start Verification of Recall Invariants ===');
    
    // --- STATIC VERIFICATION: Event Loop Non-Interleavability Invariant ---
    // ⚠️ NOTE: This test is a brittle lexical guardrail, not a formal AST-backed semantic proof.
    // It verifies that direct inline async constructs ("await" or ".then(") do not exist in the
    // critical region, but it cannot detect indirect yields (e.g. queueMicrotask, callbacks,
    // or external helper execution). Correctness relies ultimately on reviewer vigilance and 
    // event-loop discipline.
    console.log('--- Static Test: Event-Loop Non-Interleavability Verification ---');
    const serverPath = path.join(PROJECT_ROOT, 'src/server.js');
    const serverSource = fs.readFileSync(serverPath, 'utf8');
    const loadIndex = serverSource.indexOf('const seen = loadSeen(sessionId);');
    const saveIndex = serverSource.indexOf('const saved = saveSeen(sessionId, seen);');
    if (loadIndex === -1 || saveIndex === -1 || loadIndex >= saveIndex) {
        throw new Error('Static Test failed: could not locate loadSeen/saveSeen critical block boundaries in src/server.js');
    }
    const criticalSpan = serverSource.slice(loadIndex, saveIndex);
    if (criticalSpan.includes('await') || criticalSpan.includes('.then(')) {
        throw new Error('Static Test failed: Event-loop non-interleavability invariant violated! Found async yield ("await" or ".then") in critical block between loadSeen and saveSeen in src/server.js');
    }
    console.log('Static Test passed: No direct lexical async markers (await or .then) found in loadSeen-to-saveSeen critical block.');
    
    // We will keep track of backups to restore them at the end
    const backups = new Map();
    const ws = await connectToCDP();
    let originalTitle = '';
    
    if (ws) {
        // Query original title to restore at the end
        const evalTitle = await evaluateInBrowser(ws, 'document.title');
        originalTitle = evalTitle?.result?.value || '';
        console.log(`Connected to CDP. Saved original title: "${originalTitle}"`);
        
        // Stabilize title to prevent drift during tests 1-4
        await evaluateInBrowser(ws, 'document.title = "Invariant Test Sandbox"');
        console.log('Stabilized document title to "Invariant Test Sandbox"');
    } else {
        console.log('Warning: CDP connection unavailable. Title stabilization skipped.');
    }
    
    function prepareFile(sessionId, content) {
        const seenPath = path.join(SEEN_DIR, `.gemini-recall-seen-${sessionId}.json`);
        if (!backups.has(sessionId)) {
            if (fs.existsSync(seenPath)) {
                const backupPath = seenPath + '.backup';
                fs.renameSync(seenPath, backupPath);
                backups.set(sessionId, backupPath);
            } else {
                backups.set(sessionId, null);
            }
        }
        if (content === null) {
            if (fs.existsSync(seenPath)) fs.unlinkSync(seenPath);
        } else {
            fs.writeFileSync(seenPath, content, 'utf8');
        }
        return seenPath;
    }
    
    try {
        // Start with a clean server to avoid active tripwires
        restartServer();

        // --- TEST 1: File Absence ---
        console.log('\n--- Test 1: File Absence (No prior seen file) ---');
        let sessionId = await getFreshSessionId();
        console.log(`Session ID for Test 1: ${sessionId}`);
        prepareFile(sessionId, null);
        
        let sendRes = await fetchJson(SEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'test prompt 1' })
        });
        console.log('Send response:', JSON.stringify(sendRes));
        
        let health = await fetchJson(HEALTH_URL);
        console.log(`Session corrupted flag: ${health.recallStats.tripwires.sessionCorrupted}`);
        if (health.recallStats.tripwires.sessionCorrupted) {
            throw new Error('Test 1 failed: file absence incorrectly triggered corruption.');
        }
        console.log('Test 1 passed: file absence handled normally.');

        // --- TEST 2: File Emptiness ---
        console.log('\n--- Test 2: File Emptiness (Valid empty array) ---');
        sessionId = await getFreshSessionId();
        console.log(`Session ID for Test 2: ${sessionId}`);
        prepareFile(sessionId, '[]');
        
        sendRes = await fetchJson(SEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'test prompt 2' })
        });
        console.log('Send response:', JSON.stringify(sendRes));
        
        health = await fetchJson(HEALTH_URL);
        console.log(`Session corrupted flag: ${health.recallStats.tripwires.sessionCorrupted}`);
        if (health.recallStats.tripwires.sessionCorrupted) {
            throw new Error('Test 2 failed: file emptiness incorrectly triggered corruption.');
        }
        console.log('Test 2 passed: file emptiness handled normally.');

        // Restart server again to clear any tripwires that might have tripped during verification
        restartServer();

        // --- TEST 3: File Corruption (Malformed JSON) ---
        console.log('\n--- Test 3: File Corruption (Malformed JSON) ---');
        sessionId = await getFreshSessionId();
        console.log(`Session ID for Test 3: ${sessionId}`);
        const test3Path = prepareFile(sessionId, '{invalid_json');
        
        sendRes = await fetchJson(SEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'test prompt 3' })
        });
        console.log('Send response:', JSON.stringify(sendRes));
        
        health = await fetchJson(HEALTH_URL);
        console.log('Health after corruption:', JSON.stringify(health, null, 2));
        
        if (!health.recallStats.tripwires.sessionCorrupted) {
            throw new Error('Test 3 failed: malformed JSON did not set sessionCorrupted.');
        }
        if (health.status !== 'degraded') {
            throw new Error('Test 3 failed: status did not transition to degraded.');
        }
        if (health.degradedReason !== 'session_corrupted') {
            throw new Error(`Test 3 failed: degradedReason expected session_corrupted, got ${health.degradedReason}`);
        }
        console.log('Test 3 passed: malformed JSON immediately triggered corruption bypass and degraded status.');
        
        // --- TEST 4: Stable Persistence & Isolation ---
        console.log('\n--- Test 4: Stable Persistence & Subsequent Request Isolation ---');
        
        // 1. Verify malformed JSON file on disk was NOT overwritten by handleMemoryRecall
        const diskContent = fs.readFileSync(test3Path, 'utf8');
        console.log(`Disk content of corrupted file: "${diskContent}"`);
        if (diskContent !== '{invalid_json') {
            throw new Error('Test 4 failed: corrupted file on disk was overwritten during fail-closed handling.');
        }
        console.log('Invariant passed: corrupted seen-store was NOT overwritten.');

        // 2. Send subsequent request and verify it stays in bypassed_corrupt mode cleanly without oscillation
        sendRes = await fetchJson(SEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'test prompt 4' })
        });
        console.log('Subsequent Send response:', JSON.stringify(sendRes));
        
        health = await fetchJson(HEALTH_URL);
        console.log(`Subsequent Session corrupted flag: ${health.recallStats.tripwires.sessionCorrupted}`);
        console.log(`Subsequent Turn history: ${JSON.stringify(health.recallStats.turnHistory)}`);
        
        if (!health.recallStats.tripwires.sessionCorrupted) {
            throw new Error('Test 4 failed: subsequent request cleared sessionCorrupted flag.');
        }
        const lastTurn = health.recallStats.turnHistory.at(-1);
        if (lastTurn !== 'bypassed_corrupt') {
            throw new Error(`Test 4 failed: expected last turn state to be bypassed_corrupt, got ${lastTurn}`);
        }
        console.log('Test 4 passed: subsequent request remained stable in bypassed_corrupt without oscillation.');

        // --- TEST 5: Cross-Session Isolation ---
        console.log('\n--- Test 5: Cross-Session Isolation (Sequential Session Isolation) ---');
        if (!ws) {
            console.log('CDP connection unavailable. Skipping Test 5.');
        } else {
            // Restart server to start from a clean health slate
            restartServer();

            // 1. Setup Session A (Healthy)
            console.log('Configuring Mock Session A...');
            await evaluateInBrowser(ws, `document.title = "Mock Session A"`);
            const sessionA = await getFreshSessionId();
            console.log(`Mock Session A ID: ${sessionA}`);
            prepareFile(sessionA, '[]'); // healthy seen file

            // 2. Setup Session B (Corrupt)
            console.log('Configuring Mock Session B...');
            await evaluateInBrowser(ws, `document.title = "Mock Session B"`);
            const sessionB = await getFreshSessionId();
            console.log(`Mock Session B ID: ${sessionB}`);
            prepareFile(sessionB, '{corrupted_json'); // corrupt seen file

            // 3. Trigger corruption on Session B
            console.log('Triggering corruption read on Mock Session B...');
            let sendB = await fetchJson(SEND_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'test prompt for B' })
            });
            let healthB = await fetchJson(HEALTH_URL);
            console.log(`Session B health after query: ${healthB.status} (sessionCorrupted: ${healthB.recallStats.tripwires.sessionCorrupted})`);
            if (!healthB.recallStats.tripwires.sessionCorrupted) {
                throw new Error('Test 5 failed: Session B did not transition to corrupted.');
            }

            // 4. Switch to Session A and verify it is completely isolated and healthy
            console.log('Switching to Mock Session A...');
            await evaluateInBrowser(ws, `document.title = "Mock Session A"`);
            const sessionA_check = await getFreshSessionId();
            if (sessionA_check !== sessionA) {
                throw new Error(`Session ID mismatch: expected ${sessionA}, got ${sessionA_check}`);
            }

            let sendA = await fetchJson(SEND_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'test prompt for A' })
            });
            let healthA = await fetchJson(HEALTH_URL);
            console.log(`Session A health after query: ${healthA.status} (sessionCorrupted: ${healthA.recallStats.tripwires.sessionCorrupted})`);
            
            const lastTurnA = healthA.recallStats.turnHistory.at(-1);
            console.log(`Session A last turn status: "${lastTurnA}"`);

            if (healthA.recallStats.tripwires.sessionCorrupted) {
                throw new Error('Test 5 failed: healthy Session A was cross-contaminated by corrupt Session B.');
            }
            if (lastTurnA === 'bypassed_corrupt') {
                throw new Error('Test 5 failed: Session A turn was incorrectly bypassed due to corruption.');
            }
            console.log('Isolation verified: Session A remains completely healthy and functional.');

            // 5. Switch back to B and verify it remains degraded
            console.log('Switching back to Mock Session B...');
            await evaluateInBrowser(ws, `document.title = "Mock Session B"`);
            let sendB2 = await fetchJson(SEND_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'second prompt for B' })
            });
            let healthB2 = await fetchJson(HEALTH_URL);
            const lastTurnB = healthB2.recallStats.turnHistory.at(-1);
            console.log(`Session B second turn status: "${lastTurnB}"`);
            if (lastTurnB !== 'bypassed_corrupt') {
                throw new Error(`Test 5 failed: Session B did not stay in bypassed_corrupt, got "${lastTurnB}"`);
            }
            console.log('Isolation verified: Session B remains stably degraded.');
            console.log('Test 5 passed: Cross-session isolation proved sequential session isolation invariants.');
        }
        
    } finally {
        if (ws) {
            // Restore original title
            console.log(`Restoring original document title to: "${originalTitle}"`);
            try {
                await evaluateInBrowser(ws, `document.title = ${JSON.stringify(originalTitle)}`);
            } catch (e) {
                console.log('Failed to restore title:', e.message);
            }
            ws.close();
        }
        // Restore backups
        for (const [sessId, backupFile] of backups.entries()) {
            const seenPath = path.join(SEEN_DIR, `.gemini-recall-seen-${sessId}.json`);
            if (fs.existsSync(seenPath)) fs.unlinkSync(seenPath);
            if (backupFile && fs.existsSync(backupFile)) {
                fs.renameSync(backupFile, seenPath);
                console.log(`Restored original seen file for session ${sessId}.`);
            }
        }
        console.log('=== Verification Completed ===');
    }
}

runTests().catch(err => {
    console.error('Verification failed with error:', err);
    process.exit(1);
});
