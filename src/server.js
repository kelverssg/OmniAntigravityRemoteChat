// @ts-check
/**
 * OmniAntigravity CDP Bridge — minimal server.
 * Provides only the 3 endpoints used by send_to_ntg.py:
 *   POST /send      — inject message into Antigravity chat via CDP
 *   GET  /snapshot  — return last CDP snapshot
 *   GET  /health    — CDP connection status
 */
import './env.js';
import express from 'express';
import { discoverCDP, connectCDP } from './cdp/connection.js';
import { getJson } from './utils/network.js';
import { PORTS } from './config.js';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// ── Mid-Session Memory Recall Hook Integration ─────────────────────
const RECALL_SCRIPT = '/Users/macbookair2022/.claude/scripts/mnemon_recall_dual.py';
const SEEN_DIR = '/Users/macbookair2022/.claude';
const corruptedSessions = new Set();

// Rolling history of turns for tripwires: sent, recall_failed, injection_failed, or bypass variants.
const turnHistory = [];
const MAX_HISTORY_LEN = 50;

// Metrics
let totalQueries = 0;
let successfulRecalls = 0;
let recallTimeouts = 0;
let totalLatencyMs = 0;
let recoveryCount = 0;
let totalBypasses = 0;

// Health state tracking
let lastHealthyTimestamp = new Date().toISOString();
let degradedSince = null;
let degradedReason = null;
let lastTransitionReason = 'initialization';
let lastState = 'healthy'; // 'healthy', 'tripwire_fast_active', 'tripwire_slow_active', 'session_corrupted'

function updateHealthStatus(currentState, transitionReason) {
    if (currentState !== lastState) {
        const wasHealthy = lastState === 'healthy';
        const isHealthy = currentState === 'healthy';
        
        if (isHealthy) {
            lastHealthyTimestamp = new Date().toISOString();
            degradedSince = null;
            degradedReason = null;
            if (!wasHealthy) {
                recoveryCount++;
            }
        } else {
            if (wasHealthy) {
                degradedSince = new Date().toISOString();
            }
            degradedReason = currentState;
        }
        lastTransitionReason = transitionReason;
        lastState = currentState;
        console.log(`[health-state] Transitioned to ${currentState}. Transition: ${transitionReason}`);
    }
}

function refreshHealthStatus(sessionId) {
    const tripwire = getTripwireStatus();
    const isCorrupted = sessionId && sessionId !== 'none' && sessionId !== 'default' ? corruptedSessions.has(sessionId) : false;
    
    let targetState = 'healthy';
    let transition = 'no_change';
    
    if (isCorrupted) {
        targetState = 'session_corrupted';
        if (lastState !== 'session_corrupted') {
            transition = 'corruption_detected';
        }
    } else if (tripwire.fastTripwire) {
        targetState = 'tripwire_fast_active';
        if (lastState !== 'tripwire_fast_active') {
            transition = 'tripwire_tripped';
        }
    } else if (tripwire.slowTripwire) {
        targetState = 'tripwire_slow_active';
        if (lastState !== 'tripwire_slow_active') {
            transition = 'tripwire_tripped';
        }
    } else {
        if (lastState !== 'healthy') {
            transition = 'tripwire_recovered';
        }
    }
    
    updateHealthStatus(targetState, transition);
}

function sha256(str) {
    return crypto.createHash('sha256').update(str).digest('hex').substring(0, 16);
}

function recordTurn(state) {
    turnHistory.push(state);
    if (state.startsWith('bypassed')) {
        totalBypasses++;
    }
    if (turnHistory.length > MAX_HISTORY_LEN) {
        turnHistory.shift();
    }
}

function getTripwireStatus() {
    const activeTurns = turnHistory.filter(s => s === 'sent' || s === 'recall_failed' || s === 'injection_failed');
    const totalActive = activeTurns.length;
    if (totalActive === 0) {
        return { fastTripwire: false, slowTripwire: false, failRate10: 0, failRate50: 0 };
    }
    
    // Fast Tripwire: failures over last 10 active turns
    const last10 = activeTurns.slice(-10);
    const fails10 = last10.filter(s => s === 'recall_failed' || s === 'injection_failed').length;
    const failRate10 = fails10 / last10.length;
    const fastTripwire = last10.length >= 5 && failRate10 > 0.20; // Require min 5 turns
    
    // Slow Tripwire: failures over last 50 active turns
    const fails50 = activeTurns.filter(s => s === 'recall_failed' || s === 'injection_failed').length;
    const failRate50 = fails50 / totalActive;
    const slowTripwire = totalActive >= 20 && failRate50 > 0.10; // Require min 20 turns
    
    return { fastTripwire, slowTripwire, failRate10, failRate50 };
}

function extractQuery(message) {
    let cleaned = message.trim();
    // Strip prefixes like [clc→ntg] or [any_tag]
    cleaned = cleaned.replace(/^\[[^\]]+\]\s*/g, '');
    // Strip uppercase markers like PLAN:, ASK:, TODO:
    cleaned = cleaned.replace(/^(PLAN|TODO|NOTE|TASK|ASK):\s*/gi, '');
    return cleaned.substring(0, 300).trim();
}

function runRecall(query) {
    return new Promise((resolve) => {
        execFile('python3', [RECALL_SCRIPT, query, '--limit', '2', '--threshold', '0.50'], { timeout: 6000 }, (error, stdout, stderr) => {
            if (error) {
                console.error('[recall] error or timeout running recall script:', error.message);
                resolve(null); // Return null to indicate error/timeout explicitly
                return;
            }
            try {
                const results = JSON.parse(stdout);
                resolve(results);
            } catch (e) {
                console.error('[recall] error parsing JSON output:', e.message);
                resolve(null);
            }
        });
    });
}

async function getActiveSessionId(cdp) {
    try {
        const result = await cdp.call('Runtime.evaluate', {
            expression: '[window.location.href, document.title].join("|")',
            returnByValue: true,
            timeout: 2000
        });
        const val = result.result?.value || 'default';
        return crypto.createHash('sha256').update(val).digest('hex').substring(0, 16);
    } catch (e) {
        console.error('[recall] failed to fetch active session id:', e.message);
        return 'default';
    }
}

function getSeenPath(sessionId) {
    const safe = sessionId.replace(/[^a-zA-Z0-9-_]/g, '').substring(0, 40) || 'default';
    return path.join(SEEN_DIR, `.gemini-recall-seen-${safe}.json`);
}

/**
 * Loads the seen set for a session.
 * Returns null if the seen file is corrupted or unparseable.
 * @param {string} sessionId
 * @returns {Set<string> | null}
 */
function loadSeen(sessionId) {
    try {
        const filePath = getSeenPath(sessionId);
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            return new Set(JSON.parse(data));
        }
        return new Set();
    } catch (e) {
        console.error('[recall] error loading seen file — marking session as corrupted:', e.message);
        corruptedSessions.add(sessionId);
        return null;
    }
}

/**
 * Saves the seen set for a session.
 * Returns false if writing fails.
 * @param {string} sessionId
 * @param {Set<string>} seenSet
 * @returns {boolean}
 */
function saveSeen(sessionId, seenSet) {
    try {
        const filePath = getSeenPath(sessionId);
        fs.writeFileSync(filePath, JSON.stringify(Array.from(seenSet)), 'utf8');
        return true;
    } catch (e) {
        console.error('[recall] error saving seen file — marking session as corrupted:', e.message);
        corruptedSessions.add(sessionId);
        return false;
    }
}

async function handleMemoryRecall(message, cdp, traceInfo) {
    const tStart = Date.now();
    traceInfo.rawQueryHash = sha256(message);
    traceInfo.status = 'bypassed'; // Default state

    const sessionId = cdp ? await getActiveSessionId(cdp) : 'default';

    // Check corruption state (fail-closed for recall, fail-silent/pass-through for prompt)
    if (corruptedSessions.has(sessionId)) {
        console.warn(`[recall] session ${sessionId} marked corrupted. Bypassing recall to contain state corruption.`);
        traceInfo.status = 'bypassed_corrupt';
        traceInfo.corrupted = true;
        traceInfo.latencyMs = Date.now() - tStart;
        return message;
    }

    // Check tripwires
    const tripwire = getTripwireStatus();
    if (tripwire.fastTripwire || tripwire.slowTripwire) {
        console.warn(`[recall] tripwire active (fast: ${tripwire.fastTripwire}, slow: ${tripwire.slowTripwire}). Bypassing recall.`);
        traceInfo.status = 'bypassed_tripwire';
        traceInfo.tripwired = true;
        traceInfo.latencyMs = Date.now() - tStart;
        return message;
    }

    try {
        if (!cdp) {
            traceInfo.latencyMs = Date.now() - tStart;
            return message;
        }
        const cleanQuery = extractQuery(message);
        traceInfo.canonicalQueryHash = sha256(cleanQuery);
        if (!cleanQuery) {
            traceInfo.latencyMs = Date.now() - tStart;
            return message;
        }

        const results = await runRecall(cleanQuery);
        const elapsed = Date.now() - tStart;
        traceInfo.latencyMs = elapsed;
        totalLatencyMs += elapsed;
        totalQueries++;

        if (!results) {
            traceInfo.status = 'recall_failed';
            recallTimeouts++;
            return message;
        }

        traceInfo.status = 'recall_ok';

        // ⚠️ CRITICAL: The entire block between loadSeen and saveSeen MUST remain strictly
        // synchronous. Introducing any 'await', promise yields, or asynchronous continuations
        // will break the single-process event loop atomicity guarantee, exposing the session 
        // to concurrent state interleaving and potential disk-write race conditions.
        const seen = loadSeen(sessionId);
        if (seen === null) {
            console.warn(`[recall] session ${sessionId} marked corrupted during load. Bypassing recall immediately.`);
            traceInfo.status = 'bypassed_corrupt';
            traceInfo.corrupted = true;
            return message;
        }

        const fresh = results.filter(r => r.id && !seen.has(r.id));

        if (fresh.length === 0) {
            successfulRecalls++;
            return message;
        }

        const blocks = [];
        for (const r of fresh) {
            const store = r.store || '?';
            const tier = r.tier;
            const label = (store === 'pyramid' && tier) ? `${store}/${tier}` : store;
            const score = r.score || 0.0;
            const content = r.content_trimmed || '';
            const contentHash = sha256(content);
            
            blocks.push(`[recalled memory — id: ${r.id}, score: ${score.toFixed(2)}, store: ${label}, latency: ${elapsed}ms, raw_sha256: ${traceInfo.rawQueryHash}, canonical_sha256: ${traceInfo.canonicalQueryHash}, content_sha256: ${contentHash}]\n${content}`);
            seen.add(r.id);
            traceInfo.recalledIds = traceInfo.recalledIds || [];
            traceInfo.recalledIds.push(r.id);
        }

        const saved = saveSeen(sessionId, seen);
        if (!saved) {
            console.warn(`[recall] session ${sessionId} marked corrupted during save. Bypassing recall immediately.`);
            traceInfo.status = 'bypassed_corrupt';
            traceInfo.corrupted = true;
            return message;
        }

        successfulRecalls++;
        const injectedPrefix = blocks.join('\n\n') + '\n\n';
        return injectedPrefix + message;
    } catch (e) {
        console.error('[recall] global error in handleMemoryRecall:', e.message);
        traceInfo.status = 'recall_failed';
        traceInfo.latencyMs = Date.now() - tStart;
        return message; // fail-silent
    }
}

const app = express();
app.use(express.json());

const PORT = 4747;

let cdpConnection = null;
let lastSnapshot = null;

// ── CDP auto-connect ──────────────────────────────────────────────
async function connect() {
    try {
        const { url } = await discoverCDP();
        cdpConnection = await connectCDP(url);
        console.log('[cdp] connected');
        cdpConnection.ws.on('close', () => {
            console.log('[cdp] disconnected — will retry in 10s');
            cdpConnection = null;
            setTimeout(connect, 10000);
        });
        // Capture snapshots from CDP messages
        cdpConnection.ws.on('message', (raw) => {
            try {
                const msg = JSON.parse(raw.toString());
                if (msg.method) lastSnapshot = msg;
            } catch {}
        });
    } catch (e) {
        console.log('[cdp] not available yet, retry in 10s');
        setTimeout(connect, 10000);
    }
}

// ── injectMessage (lifted verbatim from original server.js) ───────
async function injectMessage(cdp, text) {
    const safeText = JSON.stringify(text);
    const EXPRESSION = `(async () => {
        // Busy check — stop/cancel button visible (VS Code era + Gemini era)
        const cancel = document.querySelector('[data-tooltip-id="input-send-button-cancel-tooltip"]')
                    || document.querySelector('button[aria-label="Stop"]')
                    || document.querySelector('button[aria-label="Cancel"]');
        if (cancel && cancel.offsetParent !== null) return { ok:false, reason:"busy", domStatus:"editor-found" };

        // Editor: Gemini Antigravity (Lexical) → VS Code fallback
        const editor = document.querySelector('[data-lexical-editor="true"][contenteditable="true"]')
                    || document.querySelector('[aria-label="Message input"]')
                    || [...document.querySelectorAll('#conversation [contenteditable="true"], #chat [contenteditable="true"], #cascade [contenteditable="true"]')]
                        .filter(el => el.offsetParent !== null).at(-1);
        if (!editor) return { ok:false, error:"editor_not_found", domStatus:"attempted" };

        const textToInsert = ${safeText};
        editor.focus();
        document.execCommand?.("selectAll", false, null);
        document.execCommand?.("delete", false, null);
        let inserted = false;
        try { inserted = !!document.execCommand?.("insertText", false, textToInsert); } catch {}
        if (!inserted) {
            editor.textContent = textToInsert;
            editor.dispatchEvent(new InputEvent("beforeinput", { bubbles:true, inputType:"insertText", data: textToInsert, composed:true }));
            editor.dispatchEvent(new InputEvent("input", { bubbles:true, inputType:"insertText", data: textToInsert, composed:true }));
        }

        await new Promise(r => setTimeout(r, 200));

        // Staging check (Lexical input boundary verification)
        const editorText = editor.innerText || editor.textContent || "";
        const staged = editorText.replace(/\\s/g, '').includes(textToInsert.replace(/\\s/g, ''));
        if (!staged) {
            return { ok: false, error: "staging_failed", domStatus: "editor_found_unverified" };
        }

        // Submit: Gemini "Send message" button → VS Code lucide-arrow-right fallback
        const box = document.getElementById('antigravity.agentSidePanelInputBox');
        const sendBtn = (box ? [...box.querySelectorAll('button')] : [...document.querySelectorAll('button')])
            .find(b => b.getAttribute('aria-label') === 'Send message');
        if (sendBtn && !sendBtn.disabled) { 
            sendBtn.click(); 
            return { ok:true, domStatus:"verified-present", method:"click_send" }; 
        }
        const submit = document.querySelector("svg.lucide-arrow-right")?.closest("button");
        if (submit && !submit.disabled) { 
            submit.click(); 
            return { ok:true, domStatus:"verified-present", method:"click_submit" }; 
        }
        editor.dispatchEvent(new KeyboardEvent("keydown", { bubbles:true, key:"Enter", code:"Enter" }));
        editor.dispatchEvent(new KeyboardEvent("keyup",  { bubbles:true, key:"Enter", code:"Enter" }));
        return { ok:true, domStatus:"verified-present", method:"enter_keypress" };
    })()`;

    for (const ctx of cdp.contexts) {
        try {
            const result = await cdp.call("Runtime.evaluate", {
                expression: EXPRESSION, returnByValue: true, awaitPromise: true, contextId: ctx.id, timeout: 5000
            });
            if (result.result?.value) return result.result.value;
        } catch {}
    }
    return { ok: false, reason: "no_context", domStatus: "attempted" };
}

// ── Method 2: scan all tabs and retry on editor_not_found ─────────
async function injectMessageAnyTab(text) {
    let lastResult = { ok: false, error: 'editor_not_found_all_tabs', domStatus: 'attempted' };
    for (const port of PORTS) {
        let list;
        try { list = await getJson(`http://127.0.0.1:${port}/json/list`); } catch { continue; }
        for (const tab of list) {
            if (!tab.webSocketDebuggerUrl) continue;
            let conn;
            try { conn = await connectCDP(tab.webSocketDebuggerUrl); } catch { continue; }
            try {
                const result = await injectMessage(conn, text);
                conn.ws.close();
                lastResult = { ...result, tab: tab.title || tab.id, method2: true };
                if (result.ok !== false) return lastResult;
            } catch {
                conn.ws.close();
            }
        }
    }
    return lastResult;
}

// ── Routes ────────────────────────────────────────────────────────
app.post('/send', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    if (!cdpConnection) return res.status(503).json({ error: 'CDP not connected' });
    
    const traceInfo = { status: 'bypassed', rawQueryHash: '', canonicalQueryHash: '', recalledIds: [], latencyMs: 0 };
    const injectedMessage = await handleMemoryRecall(message, cdpConnection, traceInfo);
    
    // Inject message (primary tab)
    let result = await injectMessage(cdpConnection, injectedMessage);
    
    // Method-2 Fallback check (only if primary had editor_not_found)
    if (!result.ok && result.error === 'editor_not_found') {
        console.log('[cdp] editor_not_found on primary tab — scanning all tabs (method 2)');
        result = await injectMessageAnyTab(injectedMessage);
    }
    
    // Determine DOM status from final result
    const domStatus = result.domStatus || 'attempted';
    
    // Finalize state accounting
    if (traceInfo.status === 'recall_ok') {
        if (result.ok) {
            traceInfo.status = 'sent';
        } else {
            traceInfo.status = 'injection_failed';
        }
    }
    
    recordTurn(traceInfo.status);
    const sessionId = await getActiveSessionId(cdpConnection);
    refreshHealthStatus(sessionId);
    
    // Structured audit logging including latencyMs
    console.log(`[recall-audit] sessionId: ${sessionId}, status: ${traceInfo.status}, domStatus: ${domStatus}, latencyMs: ${traceInfo.latencyMs}, rawQueryHash: ${traceInfo.rawQueryHash}, canonicalQueryHash: ${traceInfo.canonicalQueryHash}, recalledIds: ${JSON.stringify(traceInfo.recalledIds || [])}`);

    res.json({ success: result.ok !== false, method: result.method || 'attempted', details: result });
});

app.get('/snapshot', (req, res) => {
    if (!lastSnapshot) return res.status(503).json({ error: 'No snapshot yet' });
    res.json(lastSnapshot);
});

// ── /ask — synchronous inject + wait + scrape ─────────────────────
// POST { message, timeout_ms? } → { success, response, elapsed_ms }
// Waits for ntg to finish generating before returning the response text.
const RESPONSE_SEL = 'div.leading-relaxed.select-text.text-sm';
const BUSY_CHECK   = `!!(
    document.querySelector('[data-tooltip-id="input-send-button-cancel-tooltip"]')?.offsetParent ||
    document.querySelector('button[aria-label="Stop"]')?.offsetParent
)`;

async function scrapeState(cdp) {
    const expr = `(() => {
        const busy = ${BUSY_CHECK};
        const msgs = [...document.querySelectorAll('${RESPONSE_SEL}')];
        return { busy, count: msgs.length, last: msgs.at(-1)?.innerText ?? '' };
    })()`;
    for (const ctx of cdp.contexts) {
        try {
            const r = await cdp.call('Runtime.evaluate', {
                expression: expr, returnByValue: true, contextId: ctx.id, timeout: 5000
            });
            if (r.result?.value) return r.result.value;
        } catch {}
    }
    return null;
}

app.post('/ask', async (req, res) => {
    const { message, timeout_ms = 120_000 } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    if (!cdpConnection) return res.status(503).json({ error: 'CDP not connected' });

    const t0 = Date.now();

    // Snapshot baseline before sending
    const baseline = await scrapeState(cdpConnection);
    if (!baseline) return res.status(500).json({ error: 'Could not snapshot DOM' });

    const traceInfo = { status: 'bypassed', rawQueryHash: '', canonicalQueryHash: '', recalledIds: [], latencyMs: 0 };
    const injectedMessage = await handleMemoryRecall(message, cdpConnection, traceInfo);

    // Inject — retry up to 5x if busy (2s gap)
    let result;
    for (let i = 0; i < 5; i++) {
        result = await injectMessage(cdpConnection, injectedMessage);
        if (result.ok !== false) break;
        if (result.reason !== 'busy') break;
        await new Promise(r => setTimeout(r, 2000));
    }
    
    // Method-2 Fallback check (only if primary had editor_not_found)
    if (!result.ok && result.error === 'editor_not_found') {
        console.log('[cdp] editor_not_found on primary tab — scanning all tabs (method 2)');
        result = await injectMessageAnyTab(injectedMessage);
    }
    
    // Determine DOM status from final result
    const domStatus = result.domStatus || 'attempted';
    
    // Finalize state accounting
    if (traceInfo.status === 'recall_ok') {
        if (result.ok) {
            traceInfo.status = 'sent';
        } else {
            traceInfo.status = 'injection_failed';
        }
    }
    
    recordTurn(traceInfo.status);
    const sessionId = await getActiveSessionId(cdpConnection);
    refreshHealthStatus(sessionId);
    
    // Structured audit logging including latencyMs
    console.log(`[recall-audit] sessionId: ${sessionId}, status: ${traceInfo.status}, domStatus: ${domStatus}, latencyMs: ${traceInfo.latencyMs}, rawQueryHash: ${traceInfo.rawQueryHash}, canonicalQueryHash: ${traceInfo.canonicalQueryHash}, recalledIds: ${JSON.stringify(traceInfo.recalledIds || [])}`);

    if (result.ok === false) {
        return res.json({ success: false, error: result.reason || result.error, elapsed_ms: Date.now() - t0 });
    }

    // Poll until not busy and a new response has appeared
    const deadline = Date.now() + timeout_ms;
    while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 2000));
        const state = await scrapeState(cdpConnection);
        if (!state) continue;
        const done = !state.busy && (state.count > baseline.count || state.last !== baseline.last);
        if (done) {
            return res.json({ success: true, response: state.last, elapsed_ms: Date.now() - t0 });
        }
    }

    res.status(504).json({ success: false, error: 'timeout', elapsed_ms: Date.now() - t0 });
});

app.get('/health', async (req, res) => {
    const tripwire = getTripwireStatus();
    const sessionId = cdpConnection ? await getActiveSessionId(cdpConnection) : 'none';
    refreshHealthStatus(sessionId);
    const isCorrupted = corruptedSessions.has(sessionId);
    
    res.json({
        status: lastState === 'healthy' ? 'ok' : 'degraded',
        cdpConnected: cdpConnection?.ws?.readyState === 1,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        degradedReason,
        degradedSince,
        lastHealthyTimestamp,
        lastTransitionReason,
        recallStats: {
            totalQueries,
            successfulRecalls,
            recallTimeouts,
            averageLatencyMs: totalQueries > 0 ? (totalLatencyMs / totalQueries) : 0,
            currentSessionId: sessionId,
            tripwires: {
                fastTripwireActive: tripwire.fastTripwire,
                slowTripwireActive: tripwire.slowTripwire,
                sessionCorrupted: isCorrupted
            },
            errorRate10Turns: tripwire.failRate10,
            errorRate50Turns: tripwire.failRate50,
            turnHistory: turnHistory,
            recoveryCount,
            totalBypasses
        }
    });
});

// ── Start ─────────────────────────────────────────────────────────
app.listen(PORT, '127.0.0.1', () => {
    console.log(`[omni-bridge] listening on 127.0.0.1:${PORT}`);
    connect();
});
