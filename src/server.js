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
        const cancel = document.querySelector('[data-tooltip-id="input-send-button-cancel-tooltip"]');
        if (cancel && cancel.offsetParent !== null) return { ok:false, reason:"busy" };
        const editors = [...document.querySelectorAll('#conversation [contenteditable="true"], #chat [contenteditable="true"], #cascade [contenteditable="true"]')]
            .filter(el => el.offsetParent !== null);
        const editor = editors.at(-1);
        if (!editor) return { ok:false, error:"editor_not_found" };
        const textToInsert = ${safeText};
        editor.focus();
        document.execCommand?.("selectAll", false, null);
        document.execCommand?.("delete", false, null);
        let inserted = false;
        try { inserted = !!document.execCommand?.("insertText", false, textToInsert); } catch {}
        if (!inserted) {
            editor.textContent = textToInsert;
            editor.dispatchEvent(new InputEvent("beforeinput", { bubbles:true, inputType:"insertText", data: textToInsert }));
            editor.dispatchEvent(new InputEvent("input", { bubbles:true, inputType:"insertText", data: textToInsert }));
        }
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const submit = document.querySelector("svg.lucide-arrow-right")?.closest("button");
        if (submit && !submit.disabled) { submit.click(); return { ok:true, method:"click_submit" }; }
        editor.dispatchEvent(new KeyboardEvent("keydown", { bubbles:true, key:"Enter", code:"Enter" }));
        editor.dispatchEvent(new KeyboardEvent("keyup",  { bubbles:true, key:"Enter", code:"Enter" }));
        return { ok:true, method:"enter_keypress" };
    })()`;

    for (const ctx of cdp.contexts) {
        try {
            const result = await cdp.call("Runtime.evaluate", {
                expression: EXPRESSION, returnByValue: true, awaitPromise: true, contextId: ctx.id
            });
            if (result.result?.value) return result.result.value;
        } catch {}
    }
    return { ok: false, reason: "no_context" };
}

// ── Routes ────────────────────────────────────────────────────────
app.post('/send', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    if (!cdpConnection) return res.status(503).json({ error: 'CDP not connected' });
    const result = await injectMessage(cdpConnection, message);
    res.json({ success: result.ok !== false, method: result.method || 'attempted', details: result });
});

app.get('/snapshot', (req, res) => {
    if (!lastSnapshot) return res.status(503).json({ error: 'No snapshot yet' });
    res.json(lastSnapshot);
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        cdpConnected: cdpConnection?.ws?.readyState === 1,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});

// ── Start ─────────────────────────────────────────────────────────
app.listen(PORT, '127.0.0.1', () => {
    console.log(`[omni-bridge] listening on 127.0.0.1:${PORT}`);
    connect();
});
