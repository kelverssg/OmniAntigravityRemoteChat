const metaGrid = document.getElementById('adminMetaGrid');
const tunnelStatus = document.getElementById('adminTunnelStatus');
const logsNode = document.getElementById('adminLogs');
const quickCommandsEditor = document.getElementById('quickCommandsEditor');
const refreshBtn = document.getElementById('adminRefreshBtn');
const tunnelStartBtn = document.getElementById('tunnelStartBtn');
const tunnelStopBtn = document.getElementById('tunnelStopBtn');
const tunnelProviderSelect = document.getElementById('tunnelProviderSelect');
const addCommandBtn = document.getElementById('adminAddCommandBtn');
const saveCommandsBtn = document.getElementById('adminSaveCommandsBtn');

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
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

function createCommandRow(command = { icon: '•', label: '', prompt: '' }) {
  const row = document.createElement('div');
  row.className = 'quick-command-row';
  row.innerHTML = `
    <div class="quick-command-fields" style="flex:1">
      <input placeholder="Icon" value="${escapeHtml(command.icon || '•')}" data-field="icon" />
      <input placeholder="Label" value="${escapeHtml(command.label || '')}" data-field="label" />
      <textarea rows="3" placeholder="Prompt" data-field="prompt">${escapeHtml(command.prompt || '')}</textarea>
    </div>
    <button class="panel-btn danger" type="button">Remove</button>
  `;
  row.querySelector('button').addEventListener('click', () => row.remove());
  quickCommandsEditor.appendChild(row);
}

function collectCommands() {
  return Array.from(quickCommandsEditor.querySelectorAll('.quick-command-row')).map((row) => ({
    icon: row.querySelector('[data-field="icon"]').value.trim() || '•',
    label: row.querySelector('[data-field="label"]').value.trim(),
    prompt: row.querySelector('[data-field="prompt"]').value.trim(),
  }));
}

async function loadCommands() {
  const response = await fetchWithAuth('/api/quick-commands');
  const payload = await response.json();
  quickCommandsEditor.innerHTML = '';
  (payload.commands || []).forEach(createCommandRow);
}

async function saveCommands() {
  const commands = collectCommands();
  await fetchWithAuth('/api/admin/quick-commands', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commands }),
  });
  await loadCommands();
}

async function loadMetrics() {
  const [metricsResponse, logsResponse] = await Promise.all([
    fetchWithAuth('/api/admin/metrics'),
    fetchWithAuth('/api/admin/logs?limit=80'),
  ]);
  const metrics = await metricsResponse.json();
  const logsPayload = await logsResponse.json();
  const supervisorState = metrics.supervisor?.enabled ? 'Enabled' : 'Disabled';
  const supervisorDetails = [
    supervisorState,
    metrics.supervisor?.provider,
    metrics.supervisor?.model,
  ].filter(Boolean).join(' · ');

  metaGrid.innerHTML = `
    <div class="meta-card"><strong>Version</strong><div>${escapeHtml(metrics.version)}</div></div>
    <div class="meta-card"><strong>Uptime</strong><div>${Math.round(metrics.uptime)}s</div></div>
    <div class="meta-card"><strong>WebSocket Clients</strong><div>${metrics.wsClients}</div></div>
    <div class="meta-card"><strong>CDP</strong><div>${metrics.cdpConnected ? 'Connected' : 'Disconnected'}</div></div>
    <div class="meta-card"><strong>Workspace</strong><div>${escapeHtml(metrics.workspaceRoot)}</div></div>
    <div class="meta-card"><strong>Supervisor</strong><div>${escapeHtml(supervisorDetails)}</div></div>
  `;

  if (metrics.tunnel?.provider) {
    tunnelProviderSelect.value = metrics.tunnel.provider;
  }

  tunnelStatus.textContent = metrics.tunnel?.url
    ? `Provider: ${metrics.tunnel.provider || 'unknown'}\nURL: ${metrics.tunnel.url}\n\nStarted at: ${metrics.tunnel.startedAt || 'n/a'}`
    : metrics.tunnel?.error || 'No active tunnel.';

  logsNode.textContent = (logsPayload.logs || [])
    .map((line) => `[${line.timestamp}] ${line.level.toUpperCase()} ${line.message}`)
    .join('\n');
}

async function startTunnel() {
  const provider = tunnelProviderSelect.value || 'cloudflare';
  await fetchWithAuth('/api/admin/tunnel/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider }),
  });
  await loadMetrics();
}

async function stopTunnel() {
  await fetchWithAuth('/api/admin/tunnel/stop', { method: 'POST' });
  await loadMetrics();
}

refreshBtn.addEventListener('click', loadMetrics);
tunnelStartBtn.addEventListener('click', startTunnel);
tunnelStopBtn.addEventListener('click', stopTunnel);
addCommandBtn.addEventListener('click', () => createCommandRow());
saveCommandsBtn.addEventListener('click', saveCommands);

loadCommands();
loadMetrics();
setInterval(loadMetrics, 6000);
