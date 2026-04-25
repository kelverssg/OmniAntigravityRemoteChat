import morphdom from './vendor/morphdom-lite.js';
import { FileBrowser } from './components/file-browser.js';
import { TerminalView } from './components/terminal-view.js';
import { GitPanel } from './components/git-panel.js';
import { StatsPanel } from './components/stats-panel.js';
import { AssistPanel } from './components/assist-panel.js';
import { TimelinePanel } from './components/timeline-panel.js';

const MODELS = [
  'Gemini 3.1 Pro (High)',
  'Gemini 3.1 Pro (Low)',
  'Gemini 3 Flash',
  'Claude Sonnet 4.6 (Thinking)',
  'Claude Opus 4.6 (Thinking)',
  'GPT-OSS 120B (Medium)',
];

const THEMES = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'slate', label: 'Slate' },
  { value: 'pastel', label: 'Pastel' },
  { value: 'rainbow', label: 'Rainbow' },
];
const USER_SCROLL_LOCK_DURATION = 15000;
const SCROLL_SYNC_DEBOUNCE = 150;

const chatContainer = document.getElementById('chatContainer');
const chatContent = document.getElementById('chatContent');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const refreshBtn = document.getElementById('refreshBtn');
const stopBtn = document.getElementById('stopBtn');
const newChatBtn = document.getElementById('newChatBtn');
const historyBtn = document.getElementById('historyBtn');
const scrollToBottomBtn = document.getElementById('scrollToBottom');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const statsText = document.getElementById('statsText');
const modeBtn = document.getElementById('modeBtn');
const modelBtn = document.getElementById('modelBtn');
const targetBtn = document.getElementById('targetBtn');
const themeBtn = document.getElementById('themeBtn');
const suggestionsBtn = document.getElementById('suggestionsBtn');
const quotaBtn = document.getElementById('quotaBtn');
const modeText = document.getElementById('modeText');
const modelText = document.getElementById('modelText');
const targetText = document.getElementById('targetText');
const themeText = document.getElementById('themeText');
const suggestionsText = document.getElementById('suggestionsText');
const quotaText = document.getElementById('quotaText');
const workspaceLayer = document.getElementById('workspaceLayer');
const workspaceToggleBtn = document.getElementById('workspaceToggleBtn');
const workspaceStatusText = document.getElementById('workspaceStatusText');
const workspaceCloseBtn = document.getElementById('workspaceCloseBtn');
const sessionStatsBtn = document.getElementById('sessionStatsBtn');
const sessionStatsText = document.getElementById('sessionStatsText');
const quickActions = document.getElementById('quickActions');
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const modalList = document.getElementById('modalList');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const historyLayer = document.getElementById('historyLayer');
const historyList = document.getElementById('historyList');
const historyBackBtn = document.getElementById('historyBackBtn');
const screenFrame = document.getElementById('screenStreamFrame');
const screenStatus = document.getElementById('screenStreamStatus');
const screenStartBtn = document.getElementById('screenStartBtn');
const screenStopBtn = document.getElementById('screenStopBtn');
const imageUploadBtn = document.getElementById('imageUploadBtn');
const imageInput = document.getElementById('imageInput');
const sslBanner = document.getElementById('sslBanner');
const enableHttpsBtn = document.getElementById('enableHttpsBtn');
const dismissSslBtn = document.getElementById('dismissSslBtn');

const state = {
  ws: null,
  currentMode: 'Fast',
  chatIsOpen: true,
  currentTheme: localStorage.getItem('omni-theme') || 'dark',
  workspaceOpen: false,
  activeWorkspacePanel: 'files',
  userIsScrolling: false,
  userScrollLockUntil: 0,
  snapshotReloadPending: false,
  lastScrollSync: 0,
  quickCommands: [],
  suggestMode: false,
  pendingSuggestions: 0,
  suggestions: [],
  screenActive: false,
  sessionStats: null,
  quota: null,
  timeline: null,
  panelInitialized: {
    files: false,
    terminal: false,
    git: false,
    assist: false,
    stats: false,
    timeline: false,
  },
};

const fileBrowser = new FileBrowser(document.getElementById('workspacePanel-files'), {
  fetchWithAuth,
  notify: showSlideInNotification,
});
const terminalView = new TerminalView(document.getElementById('workspacePanel-terminal'), {
  fetchWithAuth,
  notify: showSlideInNotification,
});
const gitPanel = new GitPanel(document.getElementById('workspacePanel-git'), {
  fetchWithAuth,
  notify: showSlideInNotification,
});
const assistPanel = new AssistPanel(
  document.getElementById('workspacePanel-assist'),
  {
    fetchWithAuth,
    notify: showSlideInNotification,
    onAction: handleAssistAction,
    getContext: () => ({
      sessionStats: state.sessionStats,
      pendingSuggestions: state.pendingSuggestions,
      quota: state.quota,
    }),
  }
);
const statsPanel = new StatsPanel(document.getElementById('workspacePanel-stats'), {
  fetchWithAuth,
  notify: showSlideInNotification,
});
const timelinePanel = new TimelinePanel(document.getElementById('workspacePanel-timeline'), {
  fetchWithAuth,
  notify: showSlideInNotification,
});

let scrollSyncTimeout = null;
let idleTimer = null;

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function fetchWithAuth(url, options = {}) {
  const nextOptions = { ...options };
  nextOptions.headers = { ...(options.headers || {}), 'ngrok-skip-browser-warning': 'true' };
  const response = await fetch(url, nextOptions);
  if (response.status === 401) {
    window.location.href = '/login.html';
    return new Promise(() => {});
  }
  return response;
}

function updateThemeLabel() {
  const match = THEMES.find((theme) => theme.value === state.currentTheme);
  themeText.textContent = match?.label || 'Dark';
}

function updateSuggestionLabel() {
  if (!suggestionsText) return;
  suggestionsText.textContent = state.suggestMode
    ? `${state.pendingSuggestions} Pending`
    : 'Off';
  suggestionsBtn?.classList.toggle('active', state.suggestMode || state.pendingSuggestions > 0);
}

function updateSessionStatsLabel() {
  if (!sessionStatsText) return;
  const metrics = state.sessionStats?.metrics || {};
  const uptime = state.sessionStats?.uptime || '0s';
  const messages = Number(metrics.messagesSent || 0);
  const errors = Number(metrics.errorsDetected || 0);
  sessionStatsText.textContent = `${uptime} · ${messages} msg · ${errors} err`;
  sessionStatsBtn?.classList.toggle('active', messages > 0 || errors > 0);
  assistPanel.renderContextSummary();
}

function buildQuotaBar(usagePercent, width = 10) {
  const clamped = Math.max(0, Math.min(100, Number(usagePercent) || 0));
  const filled = Math.round((clamped / 100) * width);
  return `${'▓'.repeat(filled)}${'░'.repeat(width - filled)}`;
}

function updateQuotaLabel() {
  if (!quotaText) return;
  if (!state.quota) {
    quotaText.textContent = 'Check';
    quotaBtn?.classList.remove('active');
    return;
  }

  if (!state.quota.available) {
    quotaText.textContent = state.quota.enabled ? 'Offline' : 'Off';
    quotaBtn?.classList.remove('active');
    return;
  }

  quotaText.textContent =
    state.quota.criticalModels > 0
      ? `${state.quota.criticalModels} Hot`
      : `${state.quota.highestUsagePercent || 0}% Max`;
  quotaBtn?.classList.toggle(
    'active',
    state.quota.criticalModels > 0 || state.quota.warningModels > 0
  );
  assistPanel.renderContextSummary();
}

function setSuggestionState(payload = {}) {
  state.suggestMode = Boolean(payload.suggestMode);
  state.pendingSuggestions = Number(payload.pendingCount || 0);
  state.suggestions = Array.isArray(payload.suggestions) ? payload.suggestions : state.suggestions;
  updateSuggestionLabel();
  assistPanel.renderContextSummary();
  if (state.sessionStats) {
    setStatsState({
      ...state.sessionStats,
      pendingSuggestions: state.pendingSuggestions,
    });
  }
}

function setStatsState(stats) {
  if (!stats) return;
  state.sessionStats = {
    ...stats,
    pendingSuggestions: Number(
      stats.pendingSuggestions ?? state.pendingSuggestions ?? 0
    ),
  };
  updateSessionStatsLabel();
  statsPanel.handleState(state.sessionStats);
}

async function loadSessionStats() {
  try {
    const response = await fetchWithAuth('/api/stats');
    const payload = await response.json();
    setStatsState(payload);
  } catch (_) {}
}

function setQuotaState(quota) {
  if (!quota) return;
  state.quota = quota;
  updateQuotaLabel();
}

async function loadQuota() {
  try {
    const response = await fetchWithAuth('/api/quota');
    const payload = await response.json();
    setQuotaState(payload);
    return payload;
  } catch (error) {
    setQuotaState({
      available: false,
      enabled: false,
      error: error.message,
      criticalModels: 0,
      warningModels: 0,
      highestUsagePercent: 0,
      models: [],
    });
    return null;
  }
}

function setTimelineState(timeline) {
  if (!timeline) return;
  state.timeline = timeline;
  timelinePanel.handleState(timeline);
}

async function loadTimeline() {
  try {
    const response = await fetchWithAuth('/api/timeline');
    const payload = await response.json();
    setTimelineState(payload);
    return payload;
  } catch (_) {
    return state.timeline;
  }
}

function applyTheme(theme, persist = true) {
  state.currentTheme = theme;
  document.documentElement.dataset.theme = theme;
  updateThemeLabel();
  if (persist) {
    localStorage.setItem('omni-theme', theme);
  }
  const themeColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--accent')
    .trim();
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta && themeColor) {
    themeMeta.setAttribute('content', themeColor);
  }
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

async function checkSslStatus() {
  if (window.location.protocol === 'https:') return;
  if (localStorage.getItem('sslBannerDismissed')) return;
  sslBanner.classList.add('show');
}

async function enableHttps() {
  enableHttpsBtn.disabled = true;
  enableHttpsBtn.textContent = 'Generating...';
  try {
    const response = await fetchWithAuth('/generate-ssl', { method: 'POST' });
    const payload = await response.json();
    if (payload.success) {
      showSlideInNotification(payload.message, 'success');
      enableHttpsBtn.textContent = 'Restart Server';
    } else {
      throw new Error(payload.error || 'HTTPS generation failed');
    }
  } catch (error) {
    showSlideInNotification(error.message, 'error');
    enableHttpsBtn.disabled = false;
    enableHttpsBtn.textContent = 'Enable HTTPS';
  }
}

function dismissSslBanner() {
  sslBanner.classList.remove('show');
  localStorage.setItem('sslBannerDismissed', 'true');
}

function updateStatus(connected) {
  statusDot.classList.toggle('connected', connected);
  statusDot.classList.toggle('disconnected', !connected);
  statusText.textContent = connected ? 'Live' : 'Reconnecting';
}

function showSlideInNotification(message, type = 'info') {
  let container = document.getElementById('notification-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notification-container';
    container.className = 'notification-container';
    document.body.appendChild(container);
  }

  const alert = document.createElement('div');
  alert.className = `slide-in-alert ${type}`;
  alert.innerHTML = `
    <div class="alert-message">${message}</div>
    <button class="panel-btn" type="button">Dismiss</button>
  `;
  alert.querySelector('button').addEventListener('click', () => alert.remove());
  container.appendChild(alert);
  requestAnimationFrame(() => alert.classList.add('show'));
  setTimeout(() => {
    alert.classList.remove('show');
    setTimeout(() => alert.remove(), 250);
  }, 4500);
}

function showActionRequiredPrompt(message) {
  if (document.getElementById('action-prompt-layer')) return;
  const layer = document.createElement('div');
  layer.id = 'action-prompt-layer';
  layer.className = 'modal-overlay show';
  layer.innerHTML = `
    <div class="modal-panel">
      <div class="modal-title">Action Required</div>
      <div class="panel-subtitle modal-copy">${message}</div>
      <div class="screen-actions">
        <button class="panel-btn danger" data-action="reject">Reject</button>
        <button class="panel-btn primary" data-action="accept">Accept</button>
      </div>
    </div>
  `;
  layer.querySelectorAll('button[data-action]').forEach((button) => {
    button.addEventListener('click', () =>
      handleActionInteract(button.getAttribute('data-action'), button)
    );
  });
  document.body.appendChild(layer);
}

async function handleActionInteract(action, button) {
  button.disabled = true;
  try {
    const response = await fetchWithAuth('/api/interact-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const payload = await response.json();
    if (payload.success) {
      showSlideInNotification(`Action ${action} executed.`, 'success');
    } else {
      showSlideInNotification(payload.error || `Failed to ${action}.`, 'error');
    }
  } catch (error) {
    showSlideInNotification(error.message, 'error');
  } finally {
    document.getElementById('action-prompt-layer')?.remove();
  }
}

async function loadSuggestions() {
  try {
    const response = await fetchWithAuth('/api/suggestions/pending');
    const payload = await response.json();
    setSuggestionState(payload);
  } catch (_) {}
}

function formatSuggestionLabel(suggestion) {
  const verb = suggestion.action === 'accept' ? 'Approve' : 'Reject';
  const command = String(suggestion.command || 'Pending action')
    .replace(/\s+/g, ' ')
    .trim();
  const summary = command.length > 64 ? `${command.slice(0, 64)}…` : command;
  return `${verb} · ${summary}`;
}

function showSuggestionPrompt(suggestion) {
  if (!suggestion?.id) return;
  document.getElementById('suggestion-prompt-layer')?.remove();

  const actionLabel = suggestion.action === 'accept' ? 'Approve' : 'Reject';
  const layer = document.createElement('div');
  layer.id = 'suggestion-prompt-layer';
  layer.className = 'modal-overlay show';
  layer.innerHTML = `
    <div class="modal-panel">
      <div class="modal-title">Supervisor Suggestion</div>
      <div class="panel-subtitle modal-copy">${escapeHtml(
        suggestion.summary || `The supervisor recommends ${actionLabel.toLowerCase()}ing this pending action.`
      )}</div>
      <div class="code-preview">${escapeHtml(suggestion.command || 'Pending action')}</div>
      <div class="panel-subtitle modal-copy">Reason: <code>${escapeHtml(suggestion.reason || 'manual-review')}</code></div>
      <div class="screen-actions">
        <button class="panel-btn" data-decision="reject">Reject Suggestion</button>
        <button class="panel-btn primary" data-decision="approve">${actionLabel} Suggestion</button>
      </div>
    </div>
  `;

  layer.querySelectorAll('button[data-decision]').forEach((button) => {
    button.addEventListener('click', () =>
      handleSuggestionDecision(suggestion.id, button.getAttribute('data-decision'), button)
    );
  });
  layer.addEventListener('click', (event) => {
    if (event.target === layer) {
      layer.remove();
    }
  });

  document.body.appendChild(layer);
}

function formatQuotaSummary(quota) {
  if (!quota?.available) {
    return quota?.error || 'Quota data is unavailable right now.';
  }

  const lines = [];
  if (quota.user?.planName) {
    lines.push(`Plan: ${quota.user.planName}`);
  }
  if (quota.credits?.prompt) {
    lines.push(
      `Prompt credits: ${quota.credits.prompt.usagePercent}% used (${quota.credits.prompt.used}/${quota.credits.prompt.monthly})`
    );
  }
  if (quota.credits?.flow) {
    lines.push(
      `Flow credits: ${quota.credits.flow.usagePercent}% used (${quota.credits.flow.used}/${quota.credits.flow.monthly})`
    );
  }
  if (lines.length) {
    lines.push('');
  }

  (quota.models || []).forEach((model) => {
    lines.push(`${model.name}`);
    lines.push(
      `${buildQuotaBar(model.usagePercent)} ${model.usagePercent}% used · ${model.remainingPercent}% left`
    );
    if (model.resetTime) {
      lines.push(`Reset ${new Date(model.resetTime).toLocaleTimeString()}`);
    }
    lines.push('');
  });

  lines.push(
    `Critical: ${quota.criticalModels || 0}/${quota.totalModels || 0} · Updated ${quota.lastUpdated ? new Date(quota.lastUpdated).toLocaleTimeString() : 'unknown'}`
  );
  return lines.join('\n').trim();
}

function showQuotaPrompt(quota) {
  document.getElementById('quota-prompt-layer')?.remove();

  const layer = document.createElement('div');
  layer.id = 'quota-prompt-layer';
  layer.className = 'modal-overlay show';
  layer.innerHTML = `
    <div class="modal-panel">
      <div class="modal-title">Model Quota</div>
      <div class="panel-subtitle modal-copy">${
        quota?.available
          ? `${quota.totalModels || 0} models tracked from the local language server`
          : 'Quota service status'
      }</div>
      <pre class="code-preview">${escapeHtml(formatQuotaSummary(quota))}</pre>
      <div class="screen-actions">
        <button class="panel-btn" data-action="close">Close</button>
        <button class="panel-btn primary" data-action="refresh">Refresh</button>
      </div>
    </div>
  `;

  layer.querySelector('[data-action="close"]')?.addEventListener('click', () => {
    layer.remove();
  });
  layer
    .querySelector('[data-action="refresh"]')
    ?.addEventListener('click', async () => {
      const latest = await loadQuota();
      showQuotaPrompt(latest || state.quota);
    });
  layer.addEventListener('click', (event) => {
    if (event.target === layer) {
      layer.remove();
    }
  });
  document.body.appendChild(layer);
}

async function handleAssistAction(action) {
  if (!action?.type) return;

  if (action.type === 'approve_suggestion' || action.type === 'reject_suggestion') {
    await loadSuggestions();
    const suggestion = state.suggestions[0];
    if (!suggestion) {
      showSlideInNotification('No pending suggestions available.', 'warning');
      return;
    }

    const response = await fetchWithAuth(
      action.type === 'approve_suggestion'
        ? `/api/suggestions/${encodeURIComponent(suggestion.id)}/approve`
        : `/api/suggestions/${encodeURIComponent(suggestion.id)}/reject`,
      { method: 'POST' }
    );
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || 'Suggestion action failed');
    }
    showSlideInNotification(
      action.type === 'approve_suggestion'
        ? 'Latest suggestion approved.'
        : 'Latest suggestion rejected.',
      action.type === 'approve_suggestion' ? 'success' : 'warning'
    );
    await loadSuggestions();
    await loadSessionStats();
    return;
  }

  if (action.type === 'show_suggestions') {
    await showSuggestionsQueue();
    return;
  }

  if (action.type === 'refresh_quota') {
    const quota = await loadQuota();
    showQuotaPrompt(quota || state.quota);
    return;
  }

  if (action.type === 'open_stats') {
    await toggleWorkspace(true);
    await setWorkspacePanel('stats');
    return;
  }

  if (action.type === 'open_screen') {
    await toggleWorkspace(true);
    await setWorkspacePanel('screen');
  }
}

async function handleSuggestionDecision(id, decision, button) {
  if (!id || !decision) return;
  button.disabled = true;
  try {
    const response = await fetchWithAuth(
      decision === 'approve'
        ? `/api/suggestions/${encodeURIComponent(id)}/approve`
        : `/api/suggestions/${encodeURIComponent(id)}/reject`,
      {
        method: 'POST',
      }
    );
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || 'Suggestion update failed');
    }

    document.getElementById('suggestion-prompt-layer')?.remove();
    showSlideInNotification(
      decision === 'approve'
        ? 'Suggestion approved and executed.'
        : 'Suggestion rejected.',
      decision === 'approve' ? 'success' : 'warning'
    );
    await loadSuggestions();
  } catch (error) {
    showSlideInNotification(error.message, 'error');
    button.disabled = false;
  }
}

async function showSuggestionsQueue() {
  await loadSuggestions();
  if (!state.suggestions.length) {
    showSlideInNotification(
      state.suggestMode ? 'No pending suggestions right now.' : 'Suggest Mode is off.',
      'info'
    );
    return;
  }

  openModal(
    'Pending Suggestions',
    state.suggestions.map((suggestion) => ({
      label: formatSuggestionLabel(suggestion),
      value: suggestion.id,
    })),
    (id) => {
      const suggestion = state.suggestions.find((entry) => entry.id === id);
      if (suggestion) {
        showSuggestionPrompt(suggestion);
      }
    }
  );
}

function buildSnapshotStyles(cssText) {
  const theme = getComputedStyle(document.documentElement);
  const text = theme.getPropertyValue('--text-main').trim();
  const border = theme.getPropertyValue('--snapshot-border').trim();
  const codeBg = theme.getPropertyValue('--snapshot-code-bg').trim();
  const surface = theme.getPropertyValue('--snapshot-bg').trim();
  const card = theme.getPropertyValue('--snapshot-card').trim();
  const link = theme.getPropertyValue('--snapshot-link').trim();
  return `
    ${cssText}
    #conversation, #chat, #cascade {
      background: transparent !important;
      color: ${text} !important;
      font-family: var(--font-sans) !important;
      height: auto !important;
      max-width: 100% !important;
      overflow: visible !important;
    }
    #conversation *, #chat *, #cascade * {
      color: inherit !important;
      max-width: 100% !important;
    }
    #conversation a, #chat a, #cascade a {
      color: ${link} !important;
    }
    pre, code, .monaco-editor-background, [class*="terminal"] {
      background: ${codeBg} !important;
      border: 1px solid ${border} !important;
      color: ${text} !important;
      font-family: var(--font-mono) !important;
      border-radius: 12px !important;
    }
    pre {
      white-space: pre-wrap !important;
      padding: 14px !important;
      margin: 12px 0 !important;
      overflow: auto !important;
    }
    :not(pre) > code {
      padding: 2px 6px !important;
      border-radius: 8px !important;
      background: ${card} !important;
      border: 1px solid ${border} !important;
    }
    details {
      background: ${surface} !important;
      border: 1px solid ${border} !important;
      border-radius: 12px !important;
      margin: 10px 0 !important;
      overflow: hidden !important;
    }
    details > summary {
      background: ${card} !important;
      padding: 10px 12px !important;
      cursor: pointer !important;
    }
    blockquote,
    table,
    th,
    td,
    button,
    [role="button"] {
      border-color: ${border} !important;
    }
    blockquote {
      background: ${card} !important;
      border-left: 3px solid ${link} !important;
      padding: 10px 12px !important;
      border-radius: 0 12px 12px 0 !important;
    }
    table {
      width: 100% !important;
      border-collapse: collapse !important;
    }
    th, td {
      padding: 8px !important;
    }
    img[src^="/c:"], img[src^="/C:"], img[src*="AppData"] {
      display: none !important;
    }
    /* Fix Codicon icons — VS Code icon font rendered via CDN */
    .codicon[class*="codicon-"] {
      font-family: 'codicon' !important;
      font-size: 14px !important;
      line-height: 1 !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
    }
    /* Hide broken codicon text fallbacks from snapshot */
    .codicon:not([class*="codicon-"]) {
      font-size: 0 !important;
      width: 16px !important;
      height: 16px !important;
    }
    /* Interactive buttons inside snapshot: subtle accent styling */
    [data-omni-text] {
      border: 1px solid ${border} !important;
      border-radius: 8px !important;
      padding: 6px 12px !important;
      cursor: pointer !important;
      transition: background 0.15s ease, border-color 0.15s ease !important;
    }
    [data-omni-text]:hover {
      border-color: ${link} !important;
      background: ${card} !important;
    }
  `;
}

function addMobileCopyButtons() {
  chatContent.querySelectorAll('pre').forEach((pre) => {
    if (pre.querySelector('.mobile-copy-btn')) return;
    const text = (pre.textContent || '').trim();
    if (!text.includes('\n')) return;

    const button = document.createElement('button');
    button.className = 'mobile-copy-btn';
    button.type = 'button';
    button.innerHTML = '⧉';
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      try {
        await navigator.clipboard.writeText(text);
        button.textContent = '✓';
        setTimeout(() => {
          button.textContent = '⧉';
        }, 1500);
      } catch (_) {
        showSlideInNotification('Clipboard copy failed on this connection.', 'warning');
      }
    });
    pre.appendChild(button);
  });
}

function showEmptyState() {
  chatContent.innerHTML = `
    <div class="empty-state">
      <div class="panel-title">No chat open</div>
      <div class="panel-subtitle">Start a new conversation or pick one from history.</div>
      <button class="panel-btn primary" id="emptyStateNewChatBtn">Start new chat</button>
    </div>
  `;
  chatContent
    .querySelector('#emptyStateNewChatBtn')
    .addEventListener('click', startNewChat);
}

async function loadSnapshot() {
  try {
    const response = await fetchWithAuth('/snapshot');
    if (!response.ok) {
      if (response.status === 503) {
        if (!state.chatIsOpen) showEmptyState();
        return;
      }
      throw new Error(`Snapshot request failed (${response.status})`);
    }

    const payload = await response.json();
    state.chatIsOpen = true;

    const scrollTop = chatContainer.scrollTop;
    const scrollHeight = chatContainer.scrollHeight;
    const clientHeight = chatContainer.clientHeight;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 140;
    const isUserLocked = Date.now() < state.userScrollLockUntil;

    statsText.textContent = payload.stats
      ? `${payload.stats.nodes} nodes · ${Math.round((payload.stats.htmlSize + payload.stats.cssSize) / 1024)} KB`
      : 'Live';

    let styleTag = document.getElementById('cdp-styles');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'cdp-styles';
      document.head.appendChild(styleTag);
    }
    styleTag.textContent = buildSnapshotStyles(payload.css || '');

    morphdom(
      chatContent,
      `<div id="chatContent" class="chat-content snapshot-shell">${payload.html}</div>`
    );
    chatContent.querySelectorAll('details').forEach((details) =>
      details.setAttribute('open', '')
    );
    addMobileCopyButtons();

    if (!isUserLocked && isNearBottom) {
      scrollToBottom(false);
    } else if (isUserLocked && scrollHeight > 0) {
      const ratio = scrollTop / scrollHeight;
      chatContainer.scrollTop = chatContainer.scrollHeight * ratio;
    } else {
      chatContainer.scrollTop = scrollTop;
    }
  } catch (error) {
    console.error(error);
  }
}

async function fetchAppState() {
  try {
    const response = await fetchWithAuth('/app-state');
    const payload = await response.json();
    if (payload.mode && payload.mode !== 'Unknown') {
      state.currentMode = payload.mode;
      modeText.textContent = payload.mode;
      modeBtn.classList.toggle('active', payload.mode === 'Planning');
    }
    if (payload.model && payload.model !== 'Unknown') {
      modelText.textContent = payload.model;
    }
  } catch (_) {}
}

async function loadQuickCommands() {
  try {
    const response = await fetchWithAuth('/api/quick-commands');
    const payload = await response.json();
    state.quickCommands = payload.commands || [];
    renderQuickCommands();
  } catch (error) {
    showSlideInNotification(error.message, 'error');
  }
}

function renderQuickCommands() {
  quickActions.innerHTML = state.quickCommands
    .map(
      (command) => `
        <button class="action-chip" data-quick-command="${command.id}">
          <span>${command.icon || '•'}</span>
          <span>${command.label}</span>
        </button>
      `
    )
    .join('');
  quickActions.querySelectorAll('[data-quick-command]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-quick-command');
      const command = state.quickCommands.find((item) => item.id === id);
      if (!command) return;
      messageInput.value = command.prompt;
      messageInput.dispatchEvent(new Event('input'));
      messageInput.focus();
    });
  });
}

function scrollToBottom(smooth = true) {
  chatContainer.scrollTo({
    top: chatContainer.scrollHeight,
    behavior: smooth ? 'smooth' : 'auto',
  });
}

async function syncScrollToDesktop() {
  const percent =
    chatContainer.scrollTop /
    Math.max(chatContainer.scrollHeight - chatContainer.clientHeight, 1);
  try {
    await fetchWithAuth('/remote-scroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scrollPercent: percent }),
    });
    if (!state.snapshotReloadPending) {
      state.snapshotReloadPending = true;
      setTimeout(() => {
        loadSnapshot();
        state.snapshotReloadPending = false;
      }, 300);
    }
  } catch (_) {}
}

async function sendMessage() {
  const message = messageInput.value.trim();
  if (!message) return;
  messageInput.value = '';
  messageInput.style.height = 'auto';
  sendBtn.disabled = true;

  try {
    if (!state.chatIsOpen) {
      await startNewChat();
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    await fetchWithAuth('/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    setTimeout(loadSnapshot, 300);
    setTimeout(loadSnapshot, 800);
  } catch (error) {
    showSlideInNotification(error.message, 'error');
  } finally {
    sendBtn.disabled = false;
  }
}

async function startNewChat() {
  try {
    const response = await fetchWithAuth('/new-chat', { method: 'POST' });
    const payload = await response.json();
    if (payload.success) {
      state.chatIsOpen = true;
      setTimeout(loadSnapshot, 400);
      setTimeout(checkChatStatus, 1000);
    } else {
      showSlideInNotification(payload.error || 'Failed to create new chat.', 'error');
    }
  } catch (error) {
    showSlideInNotification(error.message, 'error');
  }
}

async function checkChatStatus() {
  try {
    const response = await fetchWithAuth('/chat-status');
    const payload = await response.json();
    state.chatIsOpen = payload.hasChat || payload.editorFound;
    if (!state.chatIsOpen) {
      showEmptyState();
    }
  } catch (_) {}
}

async function showChatHistory() {
  historyLayer.classList.add('show');
  historyList.innerHTML = `
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading conversations...</p>
    </div>
  `;
  try {
    const response = await fetchWithAuth('/chat-history');
    const payload = await response.json();
    const chats = payload.chats || payload.history || [];
    if (!chats.length) {
      historyList.innerHTML = `
        <div class="history-empty">
          <div class="panel-title">No conversations yet</div>
          <button class="panel-btn primary" id="historyNewChatBtn">Start new chat</button>
        </div>
      `;
      historyList
        .querySelector('#historyNewChatBtn')
        .addEventListener('click', async () => {
          hideChatHistory();
          await startNewChat();
        });
      return;
    }

    historyList.innerHTML = chats
      .map(
        (chat) => `
          <button class="history-item ${chat.active ? 'active' : ''}" data-chat-title="${chat.title.replaceAll('"', '&quot;')}">
            <span>${chat.title}</span>
            <span class="stat-micro">${chat.active ? 'ACTIVE' : 'Open'}</span>
          </button>
        `
      )
      .join('');
    historyList.querySelectorAll('[data-chat-title]').forEach((button) => {
      button.addEventListener('click', async () => {
        hideChatHistory();
        await selectChat(button.getAttribute('data-chat-title'));
      });
    });
  } catch (error) {
    historyList.innerHTML = `<div class="history-empty">${error.message}</div>`;
  }
}

function hideChatHistory() {
  historyLayer.classList.remove('show');
}

async function selectChat(title) {
  try {
    const response = await fetchWithAuth('/select-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || 'Could not switch conversation');
    }
    setTimeout(loadSnapshot, 300);
    setTimeout(loadSnapshot, 900);
  } catch (error) {
    showSlideInNotification(error.message, 'error');
  }
}

function openModal(title, options, onSelect) {
  modalTitle.textContent = title;
  modalList.innerHTML = '';
  options.forEach((option) => {
    const button = document.createElement('button');
    button.className = 'modal-option';
    button.type = 'button';
    button.textContent = option.label;
    button.addEventListener('click', () => {
      closeModal();
      Promise.resolve(onSelect(option.value)).catch((error) => {
        showSlideInNotification(error.message, 'error');
      });
    });
    modalList.appendChild(button);
  });
  modalOverlay.classList.add('show');
}

function closeModal() {
  modalOverlay.classList.remove('show');
}

async function showTargetSelector() {
  try {
    const response = await fetchWithAuth('/cdp-targets');
    const payload = await response.json();
    const options = (payload.targets || []).map((target) => ({
      label:
        target.id === payload.activeTarget
          ? `Active · ${target.title}`
          : target.title,
      value: target.id,
    }));
    options.push({ label: 'Launch new window', value: '__launch__' });

    openModal('Select Antigravity Window', options, async (targetId) => {
      if (targetId === '__launch__') {
        await launchNewWindow();
        return;
      }

      const switchResponse = await fetchWithAuth('/select-target', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId }),
      });
      const switchPayload = await switchResponse.json();
      if (!switchPayload.success) {
        throw new Error(switchPayload.error || 'Window switch failed');
      }
      targetText.textContent = switchPayload.target;
      setTimeout(loadSnapshot, 1200);
      setTimeout(fetchAppState, 1500);
    });
  } catch (error) {
    showSlideInNotification(error.message, 'error');
  }
}

async function launchNewWindow() {
  try {
    const response = await fetchWithAuth('/api/launch-window', { method: 'POST' });
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || 'Could not launch window');
    }
    showSlideInNotification(`New Antigravity window launched on port ${payload.port}.`, 'success');
  } catch (error) {
    showSlideInNotification(error.message, 'error');
  }
}

function handleCDPStatus(status) {
  if (status === 'connected') {
    updateStatus(true);
    loadSnapshot();
  } else if (status === 'reconnecting') {
    updateStatus(false);
  }
}

async function loadWorkspacePanel(panel) {
  if (panel === 'files' && !state.panelInitialized.files) {
    state.panelInitialized.files = true;
    await fileBrowser.init();
  }
  if (panel === 'terminal' && !state.panelInitialized.terminal) {
    state.panelInitialized.terminal = true;
    await terminalView.init();
  } else if (panel === 'terminal') {
    await terminalView.refresh();
  }
  if (panel === 'git' && !state.panelInitialized.git) {
    state.panelInitialized.git = true;
    await gitPanel.init();
  } else if (panel === 'git') {
    await gitPanel.refresh();
  }
  if (panel === 'assist' && !state.panelInitialized.assist) {
    state.panelInitialized.assist = true;
    await assistPanel.init();
  } else if (panel === 'assist') {
    assistPanel.renderContextSummary();
    await assistPanel.refresh();
  }
  if (panel === 'stats' && !state.panelInitialized.stats) {
    state.panelInitialized.stats = true;
    await statsPanel.init();
  } else if (panel === 'stats') {
    if (state.sessionStats) {
      statsPanel.handleState(state.sessionStats);
    }
    await statsPanel.refresh();
  }
  if (panel === 'timeline' && !state.panelInitialized.timeline) {
    state.panelInitialized.timeline = true;
    await timelinePanel.init();
  } else if (panel === 'timeline') {
    if (state.timeline) {
      timelinePanel.handleState(state.timeline);
    }
    await timelinePanel.refresh();
  }
  if (panel === 'screen') {
    await loadScreenStatus();
  }
}

async function setWorkspacePanel(panel) {
  state.activeWorkspacePanel = panel;
  document
    .querySelectorAll('.workspace-tab')
    .forEach((button) =>
      button.classList.toggle('active', button.dataset.panel === panel)
    );
  document
    .querySelectorAll('.workspace-panel')
    .forEach((panelNode) =>
      panelNode.classList.toggle('active', panelNode.id === `workspacePanel-${panel}`)
    );
  await loadWorkspacePanel(panel);
}

async function toggleWorkspace(force) {
  state.workspaceOpen = typeof force === 'boolean' ? force : !state.workspaceOpen;
  workspaceLayer.classList.toggle('open', state.workspaceOpen);
  workspaceStatusText.textContent = state.workspaceOpen ? 'Open' : 'Closed';
  if (state.workspaceOpen) {
    await setWorkspacePanel(state.activeWorkspacePanel);
  }
}

function updateScreenStatus(status) {
  state.screenActive = !!status.active;
  screenStatus.textContent = status.active
    ? `Streaming since ${new Date(status.startedAt).toLocaleTimeString()}`
    : 'Screencast idle';
}

async function loadScreenStatus() {
  try {
    const response = await fetchWithAuth('/api/screencast/status');
    const payload = await response.json();
    updateScreenStatus(payload);
  } catch (_) {}
}

async function startScreenStream() {
  try {
    const response = await fetchWithAuth('/api/screencast/start', { method: 'POST' });
    const payload = await response.json();
    updateScreenStatus(payload);
  } catch (error) {
    showSlideInNotification(error.message, 'error');
  }
}

async function stopScreenStream() {
  try {
    const response = await fetchWithAuth('/api/screencast/stop', { method: 'POST' });
    const payload = await response.json();
    updateScreenStatus(payload);
  } catch (error) {
    showSlideInNotification(error.message, 'error');
  }
}

function handleScreenFrame(data) {
  screenFrame.src = `data:${data.format || 'image/jpeg'};base64,${data.data}`;
}

async function uploadImage(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const base64 = String(reader.result).split(',')[1];
      const prompt = messageInput.value.trim();
      const response = await fetchWithAuth('/api/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.name,
          mimeType: file.type,
          data: base64,
          prompt,
          inject: true,
        }),
      });
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.error || 'Upload failed');
      }
      messageInput.value = '';
      messageInput.style.height = 'auto';
      showSlideInNotification('Image uploaded and injected into the active session.', 'success');
      setTimeout(loadSnapshot, 500);
    } catch (error) {
      showSlideInNotification(error.message, 'error');
    } finally {
      imageInput.value = '';
    }
  };
  reader.readAsDataURL(file);
}

function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  state.ws = new WebSocket(`${protocol}//${window.location.host}`);

  state.ws.onopen = () => {
    updateStatus(true);
    loadSnapshot();
    fetchAppState();
    loadQuickCommands();
    loadScreenStatus();
    loadSuggestions();
    loadSessionStats();
    loadQuota();
    loadTimeline();
  };

  state.ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    switch (data.type) {
      case 'error':
        if (data.message === 'Unauthorized') {
          window.location.href = '/login.html';
        }
        break;
      case 'snapshot_update':
        if (!state.userIsScrolling) {
          loadSnapshot();
        }
        break;
      case 'cdp_status':
        handleCDPStatus(data.status);
        break;
      case 'notification':
        if (data.event === 'action_required') {
          showActionRequiredPrompt(data.message);
        } else {
          showSlideInNotification(
            data.message,
            data.event?.includes('error')
              ? 'error'
              : data.event?.includes('success') || data.event?.includes('approved')
                ? 'success'
                : 'warning'
          );
        }
        break;
      case 'terminal_output':
        terminalView.handleOutput(data.entry);
        break;
      case 'terminal_state':
        terminalView.handleState(data.state);
        break;
      case 'screen_status':
        updateScreenStatus(data.status);
        break;
      case 'screen_frame':
        handleScreenFrame(data);
        break;
      case 'quick_commands_updated':
        state.quickCommands = data.commands || state.quickCommands;
        renderQuickCommands();
        break;
      case 'suggestion_state':
        setSuggestionState(data);
        break;
      case 'stats_state':
        setStatsState(data.stats || data);
        break;
      case 'quota_state':
        setQuotaState(data.quota || data);
        break;
      case 'timeline_state':
        setTimelineState(data.timeline || data);
        break;
      case 'suggestion':
        if (data.event === 'new_suggestion' && data.suggestion) {
          showSuggestionPrompt(data.suggestion);
          showSlideInNotification(
            `Supervisor queued: ${formatSuggestionLabel(data.suggestion)}`,
            data.suggestion.action === 'accept' ? 'success' : 'warning'
          );
        } else if (data.event === 'approved') {
          showSlideInNotification('A suggestion was approved.', 'success');
          document.getElementById('suggestion-prompt-layer')?.remove();
        } else if (data.event === 'rejected') {
          showSlideInNotification('A suggestion was rejected.', 'warning');
          document.getElementById('suggestion-prompt-layer')?.remove();
        } else if (data.event === 'expired') {
          showSlideInNotification('A pending suggestion expired.', 'warning');
        }
        break;
      default:
        break;
    }
  };

  state.ws.onclose = () => {
    updateStatus(false);
    setTimeout(connectWebSocket, 2000);
  };
}

sendBtn.addEventListener('click', sendMessage);
refreshBtn.addEventListener('click', () => {
  loadSnapshot();
  fetchAppState();
});
stopBtn.addEventListener('click', async () => {
  await fetchWithAuth('/stop', { method: 'POST' });
});
newChatBtn.addEventListener('click', startNewChat);
historyBtn.addEventListener('click', showChatHistory);
historyBackBtn.addEventListener('click', hideChatHistory);
scrollToBottomBtn.addEventListener('click', () => {
  state.userScrollLockUntil = 0;
  state.userIsScrolling = false;
  scrollToBottom();
});
modeBtn.addEventListener('click', () =>
  openModal(
    'Select Mode',
    ['Fast', 'Planning'].map((value) => ({ label: value, value })),
    async (value) => {
      const response = await fetchWithAuth('/set-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: value }),
      });
      const payload = await response.json();
      if (payload.success) {
        state.currentMode = value;
        modeText.textContent = value;
        modeBtn.classList.toggle('active', value === 'Planning');
      }
    }
  )
);
modelBtn.addEventListener('click', () =>
  openModal(
    'Select Model',
    MODELS.map((value) => ({ label: value, value })),
    async (value) => {
      const response = await fetchWithAuth('/set-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: value }),
      });
      const payload = await response.json();
      if (payload.success) {
        modelText.textContent = value;
      }
    }
  )
);
targetBtn.addEventListener('click', showTargetSelector);
themeBtn.addEventListener('click', () =>
  openModal(
    'Theme',
    THEMES,
    (value) => applyTheme(value)
  )
);
workspaceToggleBtn.addEventListener('click', () => toggleWorkspace());
workspaceCloseBtn.addEventListener('click', () => toggleWorkspace(false));
sessionStatsBtn?.addEventListener('click', async () => {
  await toggleWorkspace(true);
  await setWorkspacePanel('stats');
});
suggestionsBtn?.addEventListener('click', showSuggestionsQueue);
quotaBtn.addEventListener('click', async () => {
  const quota = await loadQuota();
  showQuotaPrompt(quota || state.quota);
});
modalCancelBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (event) => {
  if (event.target === modalOverlay) closeModal();
});
screenStartBtn.addEventListener('click', startScreenStream);
screenStopBtn.addEventListener('click', stopScreenStream);
imageUploadBtn.addEventListener('click', () => imageInput.click());
imageInput.addEventListener('change', () => {
  const [file] = imageInput.files || [];
  if (file) uploadImage(file);
});
enableHttpsBtn.addEventListener('click', enableHttps);
dismissSslBtn.addEventListener('click', dismissSslBanner);
messageInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});
messageInput.addEventListener('input', () => {
  messageInput.style.height = 'auto';
  messageInput.style.height = `${messageInput.scrollHeight}px`;
});
chatContainer.addEventListener('scroll', () => {
  state.userIsScrolling = true;
  state.userScrollLockUntil = Date.now() + USER_SCROLL_LOCK_DURATION;
  clearTimeout(idleTimer);

  const nearBottom =
    chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight <
    140;
  scrollToBottomBtn.classList.toggle('show', !nearBottom);
  if (nearBottom) {
    state.userScrollLockUntil = 0;
  }

  const now = Date.now();
  if (now - state.lastScrollSync > SCROLL_SYNC_DEBOUNCE) {
    state.lastScrollSync = now;
    clearTimeout(scrollSyncTimeout);
    scrollSyncTimeout = setTimeout(syncScrollToDesktop, 90);
  }

  idleTimer = setTimeout(() => {
    state.userIsScrolling = false;
  }, 5000);
});

chatContainer.addEventListener('click', async (event) => {
  if (event.target.closest('.mobile-copy-btn')) return;

  const annotatedTarget = event.target.closest('[data-omni-idx]');
  const target = annotatedTarget || event.target.closest('div, span, p, summary, button, details');
  if (!target) return;

  const text = (target.getAttribute?.('data-omni-text') || target.innerText || '').trim();
  if (!annotatedTarget && (!/Thought|Thinking/i.test(text) || text.length > 500)) return;

  const omniIndexValue = target.getAttribute?.('data-omni-idx');
  const omniIndex = omniIndexValue !== null ? Number.parseInt(omniIndexValue, 10) : null;

  try {
    await fetchWithAuth('/remote-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selector: target.tagName.toLowerCase(),
        index: Number.isFinite(omniIndex) ? omniIndex : 0,
        omniIndex: Number.isFinite(omniIndex) ? omniIndex : undefined,
        textContent: text.split('\n')[0].trim(),
      }),
    });
    setTimeout(loadSnapshot, 450);
    setTimeout(loadSnapshot, 1000);
  } catch (_) {}
});
document.querySelectorAll('.workspace-tab').forEach((button) => {
  button.addEventListener('click', () => setWorkspacePanel(button.dataset.panel));
});

if (window.visualViewport) {
  const adjustViewport = () => {
    document.body.style.height = `${window.visualViewport.height}px`;
  };
  window.visualViewport.addEventListener('resize', adjustViewport);
  window.visualViewport.addEventListener('scroll', adjustViewport);
  adjustViewport();
}

applyTheme(state.currentTheme, false);
updateSuggestionLabel();
updateSessionStatsLabel();
updateQuotaLabel();
registerServiceWorker();
checkSslStatus();
connectWebSocket();
fetchAppState();
loadQuickCommands();
loadSuggestions();
loadSessionStats();
loadQuota();
loadTimeline();
checkChatStatus();
setInterval(fetchAppState, 5000);
setInterval(checkChatStatus, 10000);
