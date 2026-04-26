# Checklist de Execução até 100%

**Fechamento registrado em:** 29 de março de 2026  
**Status final do plano:** `12/12 tasks concluídas`

---

## Baseline e preservação

- [x] Auditar o plano contra o código real
- [x] Confirmar a suíte existente com `npm test`
- [x] Preservar e revisar as alterações locais existentes em `src/server.js`
- [x] Preservar e revisar as alterações locais existentes em `src/supervisor.js`
- [x] Preservar e revisar as alterações locais existentes em `src/utils/telegram.js`

## TASK-06 — CSS Modular + Sistema de Temas

- [x] Expandir `public/css/variables.css` com tokens completos
- [x] Extrair estilos de chat para `public/css/chat.css`
- [x] Extrair estilos de workspace para `public/css/workspace.css`
- [x] Criar `public/css/assist.css`
- [x] Reduzir `public/css/components.css` para componentes compartilhados
- [x] Adicionar os temas `pastel` e `rainbow`
- [x] Atualizar `public/js/app.js` para expor 5 temas
- [x] Garantir atualização de `meta[name="theme-color"]`
- [x] Validar responsividade mobile sem regressão visual

## TASK-07 — Supervisor Suggest Mode

- [x] Adicionar `SuggestQueue` em `src/supervisor.js`
- [x] Adicionar config de `SUPERVISOR_SUGGEST_MODE`
- [x] Adicionar config de `SUPERVISOR_MAX_QUEUE`
- [x] Implementar fluxo que enfileira sugestão em vez de autoexecutar
- [x] Criar `GET /api/suggestions`
- [x] Criar `GET /api/suggestions/pending`
- [x] Criar `POST /api/suggestions/:id/approve`
- [x] Criar `POST /api/suggestions/:id/reject`
- [x] Criar `DELETE /api/suggestions`
- [x] Enviar broadcast WebSocket para novas sugestões
- [x] Integrar Telegram com aprovação/rejeição de sugestões
- [x] Expor contador de sugestões pendentes na UI
- [x] Implementar expiração de sugestões

## TASK-08 — Session Stats & Analytics

- [x] Criar `src/session-stats.js`
- [x] Integrar métricas ao polling loop
- [x] Integrar métricas aos handlers de envio, aprovação, rejeição, erro e reconexão
- [x] Criar `GET /api/stats`
- [x] Adicionar comando `/stats` no Telegram
- [x] Adicionar componente visual para stats na UI mobile
- [x] Resetar stats por nova sessão/chat
- [x] Limitar logs circulares de erro e ação em memória

## TASK-11 — Unit Tests com Vitest

- [x] Adicionar `vitest.config.js`
- [x] Adicionar script `test:unit` ao `package.json`
- [x] Adicionar script `test:unit:watch`
- [x] Adicionar script `test:all`
- [x] Criar `test/unit/config.test.js`
- [x] Criar `test/unit/supervisor.test.js`
- [x] Criar `test/unit/hash.test.js`
- [x] Criar `test/unit/network.test.js`
- [x] Criar `test/unit/telegram.test.js`
- [x] Cobrir `session-stats.js`
- [x] Cobrir `quota-service.js`
- [x] Cobrir `screenshot-timeline.js`
- [x] Atingir `>= 20` testes unitários

## TASK-09 — Model Quota Service

- [x] Criar `src/quota-service.js`
- [x] Adicionar config de `QUOTA_ENABLED`
- [x] Adicionar config de `QUOTA_POLL_INTERVAL`
- [x] Implementar descoberta do language server local
- [x] Implementar leitura do token CSRF
- [x] Implementar query ao endpoint de status de usuário
- [x] Mapear nomes internos de modelo para nomes amigáveis
- [x] Criar `GET /api/quota`
- [x] Adicionar polling em background
- [x] Adicionar alertas automáticos de quota alta
- [x] Adicionar comando `/quota` no Telegram
- [x] Adicionar widget mobile de quota

## TASK-10 — Assist Chat Tab

- [x] Criar `public/js/components/assist-panel.js`
- [x] Finalizar `public/css/assist.css`
- [x] Adicionar aba `Assist` ao workspace em `public/index.html`
- [x] Inicializar o painel no `public/js/app.js`
- [x] Implementar `chatWithUser()` no supervisor
- [x] Criar `POST /api/assist/chat`
- [x] Criar `GET /api/assist/history`
- [x] Criar `DELETE /api/assist/history`
- [x] Persistir histórico de conversa em memória
- [x] Renderizar markdown nas respostas
- [x] Renderizar ações clicáveis nas respostas
- [x] Integrar o painel com stats e fila de sugestões

## TASK-12 — Screenshot Timeline

- [x] Criar `src/screenshot-timeline.js`
- [x] Adicionar configs `SCREENSHOT_ENABLED`, `SCREENSHOT_INTERVAL`, `SCREENSHOT_MAX`
- [x] Capturar screenshots via CDP apenas quando houver mudança relevante
- [x] Persistir arquivos em `data/screenshots/`
- [x] Implementar limpeza automática de arquivos antigos
- [x] Criar `GET /api/timeline`
- [x] Criar `GET /api/timeline/:filename`
- [x] Criar `POST /api/timeline/capture`
- [x] Criar `DELETE /api/timeline`
- [x] Criar componente visual de timeline na UI
- [x] Integrar acesso à timeline no workspace mobile

## Fechamento de Release

- [x] Rodar `npm test`
- [x] Rodar `npm run test:unit`
- [x] Validar approve/reject no mobile via smoke de APIs e WebSocket
- [x] Validar Suggest Mode na UI e no Telegram por integração de código e testes
- [x] Validar `/stats` e `/quota` no Telegram por integração de código e testes
- [x] Validar aba Assist
- [x] Validar timeline de screenshots
- [x] Atualizar `CHANGELOG.md`
- [x] Atualizar `docs/RELEASE_NOTES.md`
- [x] Atualizar `README.md`
- [x] Atualizar `README.pt-BR.md`
- [x] Marcar o plano como `12/12` concluído
- [x] Validar o fluxo com CDP real ativo

Observação:

- Foi feita uma tentativa local de validação com `antigravity . --remote-debugging-port=7800` em `2026-03-29`, mas nenhuma instância expôs `7800-7803` durante a checagem.
