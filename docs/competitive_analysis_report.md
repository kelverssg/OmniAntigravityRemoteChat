# 🔬 Análise Competitiva Completa — Antigravity Mobile Ecosystem

**Data:** 29 de Março de 2026 (análise original) — **Atualizado:** Abril 2026 (pós v1.3.0)  
**Projeto Base:** [OmniAntigravity Remote Chat](https://github.com/diegosouzapw/OmniAntigravityRemoteChat) v1.3.0  
**Repositórios Analisados:**
1. [AntiBridge-Antigravity-remote](https://github.com/chillinh/AntiBridge-Antigravity-remote) v3.7.1
2. [antigravity-ide-mobile](https://github.com/mrkungfudn/antigravity-ide-mobile) v2.0
3. [AntigravityMobile](https://github.com/tody-agent/AntigravityMobile) (fork de AvenalJ)

---

## 📊 Resumo Executivo

| Dimensão | Nosso Projeto | AntiBridge | IDE Mobile | AntigravityMobile |
|----------|:---:|:---:|:---:|:---:|
| **Stars** | — | 43 ⭐ | — | — |
| **Stack** | Node/ESM/Vanilla JS | Node/JS | Preact/Vite/TS/Tailwind | Node/ESM/Vanilla JS |
| **Último commit** | Ativo (≤15d) | Jan 2026 | Mar 11, 2026 | Mar 23, 2026 |
| **PRs/Issues** | — | 0 / 0 | 0 / 0 | 0 / 0 |
| **Arquitetura** | Modular (18 módulos, 60+ endpoints) | Frontend/Backend separados | Preact SPA + API | Modular (8+ serviços separados) |
| **Compatibilidade** | ✅ Mais compatível | ⚠️ Windows-centric | ❌ Stack diferente | ✅ Muito compatível |

> [!IMPORTANT]
> Nenhum dos 3 repositórios possui PRs ou issues abertos. A atividade está concentrada nos commits diretos ao `main`. O **AntigravityMobile** (tody-agent) é o mais ativo e relevante para nosso projeto pela compatibilidade de stack e riqueza de funcionalidades.

---

## 🏆 Matriz de Funcionalidades — Gap Analysis

### Legenda: ✅ Implementado | 🟡 Parcial | ❌ Ausente

| # | Funcionalidade | Nosso Projeto | AntiBridge | IDE Mobile | AntigravityMobile | Prioridade |
|---|---|:---:|:---:|:---:|:---:|:---:|
| 1 | **Chat Streaming via CDP** | ✅ Polling | ✅ | ✅ | ✅ Polling + CSS proxy | — |
| 2 | **Envio de mensagem (inject)** | ✅ | ✅ | ✅ | ✅ | — |
| 3 | **Troca de modelo AI** | ✅ | ✅ | ✅ | ✅ | — |
| 4 | **Troca Fast/Planning mode** | ✅ | ❌ | ❌ | ❌ | — |
| 5 | **File Browser** | ✅ | ❌ | ✅ | ✅ + syntax highlighting | — |
| 6 | **Multi-window CDP** | ✅ | ❌ | ✅ | ✅ + preferred workspace | — |
| 7 | **Auto-accept commands** | ✅ (supervisor-based) | ✅ (extensão separada) | ✅ | ✅ (inline no chat-stream) | — |
| 8 | **Telegram Notifications** | ✅ **Completo** (bot interativo, commands, keyboards) | ❌ | ❌ | ✅ **Completo** (bot interativo) | ✅ Implementado v1.2.0 |
| 9 | **Model Quota Monitor** | ✅ (language server + API + alertas) | ❌ | ✅ (v2.0 redesigned) | ✅ (language server + API) | ✅ Implementado v1.2.0 |
| 10 | **Error Detection (dialog)** | ✅ (multi-context scanning) | ❌ | ❌ | ✅ (multi-context scanning) | ✅ Implementado v1.2.0 |
| 11 | **AI Supervisor** | ✅ OmniRoute-based (heurísticas + AI) | ❌ | ❌ | ✅ **Full** (autonomous) | ✅ Implementado v1.2.0 |
| 12 | **Suggest Mode** (human-in-loop) | ✅ (SuggestQueue + REST + WS + Telegram) | ❌ | ❌ | ✅ | ✅ Implementado v1.2.0 |
| 13 | **Task Queue** | ❌ | ❌ | ❌ | ✅ | 🟡 Baixa |
| 14 | **Screenshot Timeline** | ✅ (auto-capture + persistent) | ❌ | ❌ | ✅ (auto-capture) | ✅ Implementado v1.2.0 |
| 15 | **Cloudflare Quick Tunnel** | ✅ | ❌ | ❌ | ✅ (com QR code) | — |
| 16 | **Pinggy Tunnel** | ✅ (SSH-based, v1.3.0) | ❌ | ❌ | ❌ | ✅ Exclusivo |
| 17 | **PWA Manifest** | ✅ | ✅ | ❌ | ✅ | — |
| 18 | **Service Worker** | ✅ | ❌ | ❌ | ✅ | — |
| 19 | **Modular CSS** (vars + themes) | ✅ (8 CSS files + 5 themes) | ❌ | ✅ (Tailwind) | ✅ (7 CSS files + 5 themes) | ✅ Implementado v1.2.0 |
| 20 | **Lite/Minimal Mode** | ✅ minimal.html | ❌ | ❌ | ✅ minimal.html | — |
| 21 | **Admin Panel separado** | ✅ admin.html | ❌ | ✅ Desktop dashboard | ✅ admin.html (localhost) | — |
| 22 | **PIN Authentication** | ✅ Cookie-based | ❌ | ❌ | ✅ (PIN + IP rate limit) | — |
| 23 | **Terminal Remote** | ✅ | ❌ | ✅ | ❌ | — |
| 24 | **Git Operations** | ✅ | ❌ | ✅ | ❌ | — |
| 25 | **Assist Chat (user ↔ supervisor)** | ✅ (tab dedicado + markdown + ações) | ❌ | ❌ | ✅ (tab dedicado) | ✅ Implementado v1.2.0 |
| 26 | **Screencast (live screen)** | ✅ | ❌ | ✅ | ❌ | — |
| 27 | **Quick Commands** | ✅ (prompts salvos + admin UI) | ❌ | ❌ | ✅ (prompts salvos) | ✅ Implementado v1.2.0 |
| 28 | **Session Event Logs** | ✅ (server logs + stats) | ❌ | ❌ | ✅ | — |
| 29 | **i18n Multi-language** | ✅ (29 langs README) | ❌ | 🟡 (vi, en) | ❌ | — |
| 30 | **Docker Support** | ✅ | ❌ | ❌ | ❌ | — |
| 31 | **Content Security Policy** | ✅ (header + meta, zero inline JS) | ❌ | ❌ | ❌ | ✅ Exclusivo v1.3.0 |
| 32 | **Vitest Unit Tests** | ✅ (9 test files, V8 coverage) | ❌ | ❌ | ✅ (18 tests) | ✅ Implementado v1.2.0 |
| 33 | **Session Stats + Analytics** | ✅ (in-memory + painel + Telegram) | ❌ | ❌ | ✅ | ✅ Implementado v1.2.0 |

---

## 🎯 Análise Detalhada dos Gaps Críticos

### 1. 🤖 Telegram Bot Completo (de AntigravityMobile)

> [!IMPORTANT]
> Nosso projeto tem apenas um webhook básico (`sendTelegramNotification`). O AntigravityMobile tem um **bot interativo completo** com polling.

**O que ele tem que não temos:**
- **Commands interativos**: `/start`, `/help`, `/status`, `/quota`, `/screenshot`
- **Inline keyboard buttons**: Quando o agente precisa de input, envia botões clicáveis no Telegram
- **Rate limiting**: 15 comandos por minuto por usuário com cooldown
- **Message threading**: Agrupa notificações relacionadas em reply chains
- **Bot menu persistente**: `setMyCommands()` para menu de comandos no Telegram
- **Tipos de notificação**: `complete`, `error`, `input_needed`, `progress`, `warning` com toggles individuais
- **Screenshot via Telegram**: Captura e envia screenshot do IDE pelo bot
- **Quota via Telegram**: Mostra barras visuais de progresso para cada modelo

**Referência de código**: [telegram-bot.mjs](https://github.com/tody-agent/AntigravityMobile/blob/main/src/telegram-bot.mjs) (465 linhas)

**Recomendação**: Substituir nosso `utils/telegram.js` simples por um módulo completo usando `node-telegram-bot-api` com lazy-loading.

---

### 2. 📊 Model Quota Monitor (de AntigravityMobile + IDE Mobile)

> [!IMPORTANT]
> Funcionalidade totalmente ausente no nosso projeto. Ambos os concorrentes que a implementam usam a mesma abordagem via Language Server API.

**Como funciona:**
```
Language Server Process → CSRF Token + Port → HTTPS API → GetUserStatus → Quota Data
```

**Mapping de modelos atualizado (quota-service.mjs):**
```javascript
const MODEL_NAMES = {
    'MODEL_PLACEHOLDER_M12': 'Claude Opus 4.6',
    'MODEL_CLAUDE_4_5_SONNET': 'Claude Sonnet 4.6',
    'MODEL_CLAUDE_4_5_SONNET_THINKING': 'Claude Sonnet 4.6 Thinking',
    'MODEL_PLACEHOLDER_M18': 'Gemini 3 Flash',
    'MODEL_PLACEHOLDER_M7': 'Gemini 3.1 Pro High',
    'MODEL_PLACEHOLDER_M8': 'Gemini 3.1 Pro Low',
    'MODEL_PLACEHOLDER_M9': 'Gemini 3.1 Pro Image',
    'MODEL_OPENAI_GPT_OSS_120B_MEDIUM': 'GPT-OSS 120B'
};
```

> [!WARNING]
> A implementação atual do quota-service usa **PowerShell** para escanear processos (Windows-only). Para implementação cross-platform, precisaríamos adaptar com `ps-list` ou leitura via `/proc` no Linux.

**Endpoint da API**: `/exa.language_server_pb.LanguageServerService/GetUserStatus`

**Referência**: [quota-service.mjs](https://github.com/tody-agent/AntigravityMobile/blob/main/src/quota-service.mjs) (403 linhas)

---

### 3. 🚨 Error Detection — Dialog Scanner (de AntigravityMobile)

**O que faz:** Monitora diálogos modais fora do `#cascade` em TODOS os contextos CDP. Detecta:
- `Agent terminated due to error`
- `Model quota reached` / `quota exhausted`
- `Rate limit` / `too many requests`
- `High traffic`
- `Internal server error`

**Padrão de scanning (chat-stream.mjs:670-727):**
```javascript
// Script de detecção executado via CDP em cada ciclo de polling
const DIALOG_SCRIPT = `(function() {
    const dialogs = document.querySelectorAll('[role="dialog"], .dialog-shadow, 
        .monaco-dialog-box, [class*="dialog"], [class*="notification"]');
    for (const d of dialogs) {
        const text = (d.innerText || '').toLowerCase();
        if (text.includes('terminated due to error')) return { error: '...', type: 'terminated' };
        if (text.includes('model quota reached')) return { error: '...', type: 'quota' };
        // ... mais padrões
    }
    return null;
})()`;
```

**Recomendação**: Adicionar `checkErrorDialogs()` ao nosso loop de polling de snapshot.

---

### 4. 🧠 AI Supervisor Avançado (de AntigravityMobile)

**Comparação com nosso supervisor:**

| Aspecto | Nosso (`supervisor.js`) | AntigravityMobile (`supervisor-service.mjs`) |
|---------|---|---|
| **Provider** | OmniRoute (OpenAI compat) | Ollama (local) |
| **Scope** | Apenas auto-approve de commands | Autonomia completa (inject, click, notify, config) |
| **Ações** | APPROVE/DENY binário | 5 ações: inject, click, notify, config, none |
| **Rate Limit** | Não | Sim (10/min com window sliding) |
| **Suggest Mode** | Não | Sim (queue para aprovação humana) |
| **Task Queue** | Não | Sim (instruções enfileiradas) |
| **Error Recovery** | Não | Sim (tentativa automática de recuperação) |
| **Assist Chat** | Não | Sim (conversa direta com o supervisor via UI) |
| **Streaming** | Não | Sim (`chatWithUserStream` via Ollama) |
| **File Reading** | Não | Sim (`[READ:path]` e `[LIST:path]` inline) |
| **Session Stats** | Não | Sim (messages, actions, errors, fixes) |
| **Código** | 264 linhas | 1219+ linhas |

**Recomendação**: Nosso supervisor é focado e conservador (filosofia OmniRoute). Podemos adotar seletivamente:
- **Suggest Mode**: Permitir ao supervisor sugerir ações para aprovação
- **Error Recovery**: Tentar recuperação automática de erros conhecidos
- **Session Stats**: Analytics básicas de sessão
- **Assist Chat tab**: Interface conversacional com o supervisor

---

### 5. ✅ Auto-Accept Inline (de AntigravityMobile)

**Abordagem diferente da nossa:**

Nosso projeto usa o supervisor para decidir. O AntigravityMobile faz inline no `chat-stream.mjs`:

```javascript
// Padrões aceitos (seguro)
const acceptPatterns = /^(run|accept|allow once|allow this conversation|yes|continue|
                         approve|confirm|ok|allow|proceed)$/i;

// Padrões rejeitados (perigoso - muda permissões permanentes)
const rejectPatterns = /^(always run|always allow|ask every time)$/i;
```

**Diferencial**: Eles nunca clicam em "Always Run/Allow" (proteção contra permissões permanentes), e usam delays incrementais para buttons simultâneos (evita race conditions):
```javascript
const delay = 500 + (acceptBtns.indexOf(acceptBtn) * 800);
```

---

### 6. 🎨 CSS Modular com Temas (de AntigravityMobile)

**Estrutura de CSS deles:**
```
public/css/
├── variables.css    # CSS custom properties & theme variables
├── layout.css       # Page layout, topbar, panels
├── components.css   # Buttons, cards, forms, modals
├── themes.css       # Theme overrides (dark, light, pastel, rainbow, slate)
├── chat.css         # Chat message styling
├── files.css        # File browser styling
├── settings.css     # Settings panel styling
└── assist.css       # Supervisor assist tab styling
```

**5 Temas disponíveis**: dark (default), light, pastel, rainbow, slate

**Nosso CSS**: Monolítico. A modularização seguindo a mesma estrutura melhoraria manutenção e permitiria temas customizáveis.

---

### 7. 💬 Quick Commands (de AntigravityMobile)

**O que é**: Prompts salvos pelo usuário que podem ser injetados no agente com um clique. Configurável via admin panel.

**Exemplo de dados:**
```javascript
const cmds = config.quickCommands || [];
// [{ icon: '▶', label: 'Run Tests', prompt: 'Run all tests and show results' }, ...]
```

> [!TIP]
> Nosso projeto já tem a infraestrutura (`loadQuickCommands`, `saveQuickCommands` em workspace.js). Falta apenas a UI no mobile e admin para gerenciar.

---

## 📈 Commits Recentes (Últimos 15 Dias)

### tody-agent/AntigravityMobile (Mar 23, 2026)
| Commit | Detalhes |
|--------|----------|
| `c6f7594` | fix: correct GitHub org to tody-agent |
| `e9d97e5` | chore: bootstrap CodyMaster integration — `.project-identity.json`, `.gitleaks.toml`, AGENTS.md, vitest + 18 unit tests, `.cm-design-profile.json` |

> [!NOTE]
> Os commits recentes mostram integração com **CodyMaster** (sistema de CI/design) e adoção de **testes unitários com Vitest** (18 testes para config e tunnel). Padrão que podemos adotar.

### mrkungfudn/antigravity-ide-mobile (Mar 11, 2026)
| Commit | Detalhes |
|--------|----------|
| `90e591d` | refactor: redesign model quota section — improved visual hierarchy, responsive grid, animated refresh, glow effects |
| `1b018df` | refactor: replace mobile toast with admin-style slide-in notifications — SVG icons, monospace font, admin color tokens |
| `cfb51a7` | 🚀 Antigravity Mobile v2.0 — initial commit |

> [!NOTE]
> O IDE Mobile v2.0 é um rewrite completo com Preact/Vite/TypeScript/Tailwind. Embora a stack seja diferente, os **padrões de UX** (slide-in notifications, quota cards com glow, responsive grid) são referências visuais excelentes.

### chillinh/AntiBridge (Jan 22, 2026)
- Apenas 3 commits totais (initial release + README updates). **Inativo há 2 meses**.

---

## 🗺️ Roadmap de Implementação Recomendado

### Tier 1 — Quick Wins (1-2 dias cada) 🟢

| # | Feature | Fonte | Esforço | Impacto |
|---|---------|-------|---------|---------|
| 1 | **Error Detection (dialog scanner)** | AntigravityMobile | ⭐ Baixo | 🔴 Alto |
| 2 | **MODEL_NAMES mapping atualizado** | AntigravityMobile | ⭐ Baixo | 🟠 Médio |
| 3 | **Auto-accept reject patterns** (never "Always") | AntigravityMobile | ⭐ Baixo | 🟠 Médio |
| 4 | **Quick Commands UI** (já temos backend) | AntigravityMobile | ⭐⭐ Médio | 🟠 Médio |

### Tier 2 — Medium Effort (3-5 dias cada) 🟡

| # | Feature | Fonte | Esforço | Impacto |
|---|---------|-------|---------|---------|
| 5 | **Telegram Bot completo** (substituir webhook) | AntigravityMobile | ⭐⭐⭐ Alto | 🔴 Alto |
| 6 | **CSS Modular** (8 arquivos + 5 temas) | AntigravityMobile | ⭐⭐ Médio | 🟠 Médio |
| 7 | **Supervisor Suggest Mode** | AntigravityMobile | ⭐⭐ Médio | 🟠 Médio |
| 8 | **Session Stats + Analytics** | AntigravityMobile | ⭐⭐ Médio | 🟡 Baixo |

### Tier 3 — Strategic (1+ semana) 🔴

| # | Feature | Fonte | Esforço | Impacto |
|---|---------|-------|---------|---------|
| 9 | **Model Quota Service** (cross-platform) | AntigravityMobile | ⭐⭐⭐⭐ Muito Alto | 🔴 Alto |
| 10 | **Assist Chat Tab** (supervisor conversation) | AntigravityMobile | ⭐⭐⭐ Alto | 🟠 Médio |
| 11 | **Unit Tests com Vitest** | AntigravityMobile | ⭐⭐ Médio | 🟠 Médio |
| 12 | **Screenshot Timeline** | AntigravityMobile | ⭐⭐ Médio | 🟡 Baixo |

---

## 🔍 Padrões de Código para Adotar

### 1. Lazy-Loading de Dependências Opcionais
```javascript
// Pattern do AntigravityMobile — evita crash se dependência não instalada
let TelegramBot;
async function loadDependency() {
    if (TelegramBot) return true;
    try {
        const mod = await import('node-telegram-bot-api');
        TelegramBot = mod.default;
        return true;
    } catch (e) {
        console.error('⚠️ node-telegram-bot-api not installed');
        return false;
    }
}
```

### 2. Persistent JSON Config Store
```javascript
// config.mjs — getConfig/updateConfig com dotpath notation
// Salva em data/config.json com merge inteligente
export function updateConfig(path, value) {
    const keys = path.split('.');
    let obj = config;
    for (let i = 0; i < keys.length - 1; i++) {
        obj[keys[i]] = obj[keys[i]] || {};
        obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
    saveConfig();
}
```

### 3. Hash-based Change Detection
```javascript
// chat-stream.mjs — evita reprocessar conteúdo idêntico
const simpleHash = chatHtml.length + '_' + chatHtml.slice(-200);
if (simpleHash === lastProcessedHash) return;
```

### 4. Rate Limiting com Sliding Window
```javascript
const ACTION_WINDOW_MS = 60000;
actionCountWindow = actionCountWindow.filter(t => Date.now() - t < ACTION_WINDOW_MS);
if (actionCountWindow.length >= maxPerMinute) return false;
```

---

## 📝 Conclusão

### O que temos de vantagem competitiva exclusiva (v1.3.0):
1. ✅ **Git Operations** (commit, push, diff) — nenhum concorrente tem completo
2. ✅ **Remote Terminal** — funcionalidade exclusiva  
3. ✅ **Screencast live** — streaming real-time do IDE
4. ✅ **Docker support** — deploy containerizado
5. ✅ **29 language i18n** — documentação multilingual
6. ✅ **Fast/Planning mode switching** — controle de modo do agente
7. ✅ **Content Security Policy** — CSP estrita com zero inline JS (exclusivo)
8. ✅ **Pinggy tunnel** — SSH-based tunneling sem binários (exclusivo)
9. ✅ **Multi-tunnel** — Cloudflare + Pinggy + ngrok com fallback automático

### Gaps fechados desde a análise original (v1.1.1 → v1.3.0):

| Gap original | Status atual | Versão implementada |
|---|---|---|
| 🔴 Model Quota Monitor | ✅ Implementado (language server + API + alertas) | v1.2.0 |
| 🔴 Telegram Bot interativo | ✅ Implementado (commands, keyboards, rate-limiting) | v1.2.0 |
| 🔴 Error Detection | ✅ Implementado (multi-context dialog scanning) | v1.2.0 |
| 🟠 CSS Modular + Temas | ✅ Implementado (8 CSS files + 5 themes) | v1.2.0 |
| 🟠 Supervisor Suggest Mode | ✅ Implementado (SuggestQueue + REST + WS + Telegram) | v1.2.0 |
| 🟠 Session Stats | ✅ Implementado (in-memory + painel + Telegram /stats) | v1.2.0 |
| 🟠 Assist Chat tab | ✅ Implementado (supervisor chat + markdown + ações) | v1.2.0 |
| 🟠 Quick Commands UI | ✅ Implementado (persistência + admin panel) | v1.2.0 |
| 🟡 Screenshot Timeline | ✅ Implementado (persistent + auto-capture + cleanup) | v1.2.0 |
| 🟡 Vitest Unit Tests | ✅ Implementado (9 test files, V8 coverage) | v1.2.0 |

### Único gap remanescente:
| Gap | Prioridade | Nota |
|---|---|---|
| Task Queue (instruções enfileiradas para o agente) | 🟡 Baixa | Feature avançada presente apenas no AntigravityMobile. Não é bloqueante. |

### Repositório de referência principal:
> **tody-agent/AntigravityMobile** — Stack 100% compatível (Node.js ESM + Vanilla JS), funcionalidades equivalentes, e código modular. Continua sendo o benchmark para nosso projeto, mas a distância competitiva foi significativamente reduzida em v1.2.0-v1.3.0.
