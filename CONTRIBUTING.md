# CONTRIBUTING — OmniAntigravity Remote Chat

First off, thank you for considering contributing to OmniAntigravity Remote Chat! It's people like you that make the AI development ecosystem so exciting.

## How to Contribute

### 1. Reporting Bugs

- **Check existing issues** to see if the bug has already been reported.
- **Provide context**: What OS are you using? Which port is Antigravity running on? HTTP or HTTPS?
- **Logs**: Include the output of `server.js` (the console logs) when the error occurred.

### 2. Suggesting Features

- Open a "Feature Request" on GitHub.
- Describe the use case (e.g., "I wish I could scroll the desktop from my phone").

### 3. Development Workflow

1.  **Fork** the repository.
2.  Create a **new branch** (`git checkout -b feature/amazing-feature`).
3.  **Implement** your changes.
    - If you are changing the UI, please test on a real mobile device screen.
    - If you are changing the server, ensure CDP discovery logic is still backward compatible.
    - If you are modifying SSL/HTTPS, test both with and without certificates.
    - If you are adding a new module, follow the existing ESM + JSDoc typing conventions.
4.  **Validate** your changes (see the checklist below).
5.  **Submit a PR** with a clear description of what changed and why.

## Local Setup

1.  Clone your fork: `git clone https://github.com/YOUR_USERNAME/OmniAntigravityRemoteChat.git`
2.  Install dependencies: `npm install`
3.  **(Optional)** Generate SSL certificates: `npm run setup:ssl`
4.  Start Antigravity with: `antigravity . --remote-debugging-port=7800`
5.  Run the server: `npm start`
6.  Access from phone: Use the URL shown in terminal (http or https)

## Pre-submission Checklist

- [ ] Code follows existing style (ESM imports, JSDoc typing, clean JS).
- [ ] No hardcoded personal IPs or credentials.
- [ ] SSL certificates are NOT committed (check `.gitignore`).
- [ ] Snapshot capture still works with the latest Antigravity version.
- [ ] UI is responsive on small (iPhone SE) and large (iPad) screens.
- [ ] Both HTTP and HTTPS modes work correctly.
- [ ] Shell scripts have LF line endings (not CRLF).
- [ ] All documentation updated if new features were added.
- [ ] Content Security Policy is not violated (no inline scripts).
- [ ] Unit tests pass: `npm run test:unit`.
- [ ] Smoke tests pass: `npm test`.

## File Structure Notes

| Directory/File      | Purpose                                                          |
| :------------------ | :--------------------------------------------------------------- |
| `src/server.js`     | Main server — add new API endpoints here                         |
| `src/config.js`     | Constants, env vars, feature flags — single source of truth      |
| `src/state.js`      | Shared mutable state — use setter functions for mutations        |
| `src/supervisor.js`  | AI supervisor + suggestion queue                                |
| `src/quota-service.js` | Model quota polling via language server                       |
| `src/session-stats.js` | In-memory session analytics                                  |
| `src/screenshot-timeline.js` | Persistent screenshot capture                          |
| `src/cdp/connection.js` | CDP discovery and WebSocket connection                       |
| `src/utils/`        | Network, process, hash, telegram, workspace utilities            |
| `public/`           | Mobile UI (index.html, admin.html, login.html, minimal.html)    |
| `public/css/`       | Modular CSS: variables, themes (5), layout, components           |
| `public/js/`        | Client logic (app.js, admin.js, login.js, minimal.js)            |
| `public/js/components/` | Workspace panels (assist, files, git, stats, terminal, timeline) |
| `scripts/`          | SSL, tunnel managers, context menu installers, shell launchers   |
| `test/unit/`        | Vitest unit tests (9 test files)                                 |
| `test/test.js`      | Integration/smoke tests                                          |
| `data/`             | Runtime data — gitignored, never commit                          |
| `certs/`            | SSL certificates — gitignored, never commit                      |
| `.env.example`      | Template for environment variables                               |

## Running Tests

```bash
# Smoke/integration tests
npm test

# Unit tests
npm run test:unit

# Unit tests with file watching
npm run test:unit:watch

# Unit tests with V8 coverage
npm run test:coverage

# All tests
npm run test:all
```

## Testing HTTPS

```bash
# Generate certificates
npm run setup:ssl

# Restart server — should show "🔒 HTTPS enabled"
npm start

# Test health endpoint
curl -k https://localhost:4747/health
```

## Code Style

- **ESM only** — never use `require()` (this is a `"type": "module"` project)
- **JSDoc typing** — use `@ts-check` and JSDoc `@typedef`/`@param`/`@returns` annotations
- **No inline JS** — CSP enforcement requires all scripts in external `.js` files
- **Single responsibility** — new features should get their own module when they become product capabilities

## Author

**Diego Souza** (@diegosouzapw) — Maintainer

Original concept by **Krishna Kanth B** (@krishnakanthb13)
