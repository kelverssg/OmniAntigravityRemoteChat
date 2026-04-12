# Design Philosophy — OmniAntigravity Remote Chat

## Problem Statement

Antigravity sessions are not blocked by typing speed. They are blocked by waiting:
thinking cycles, long generations, command approvals, review gates, quota checks,
and the constant need to glance back at the IDE before the next step can continue.

That creates a practical problem. The developer is tied to the desk even when the
current work is mostly observation, confirmation, or a single follow-up action.

## The Solution: A Mobile Command Center

OmniAntigravity Remote Chat is not just a mirrored viewport. It is a mobile command
center for AI coding sessions. It brings the live chat, workspace context, reviews,
stats, quotas, screenshots, and tunnel-aware access into a phone-friendly interface
without taking control away from the desktop IDE.

The core design goal is simple: let the user step away from the desk without losing
awareness, control, or safety.

## Design Principles

### 1. Robustness Over Precision

The Antigravity DOM is dynamic and hostile to brittle selectors. This project favors
heuristics and layered fallbacks over assumptions that the DOM will remain stable.

- Container discovery scans multiple chat roots instead of relying on one hardcoded ID.
- Element targeting uses visible text and scoped matching before raw selector dependence.
- Leaf-node isolation prefers the innermost matching node so clicks land on the actual
  target instead of an outer wrapper.
- Occurrence index tracking disambiguates repeated labels such as multiple "Thought for 2s"
  or "Run" elements visible at the same time.

The system would rather be slightly heuristic and keep working than be elegant and fail
on the next upstream UI change.

### 2. Zero-Impact Mirroring

Mirroring must not disturb the desktop session. The phone is an observer and controller,
not a source of interference.

- Snapshots are captured from a cloned DOM subtree.
- Scroll position is tracked and synchronized intentionally instead of by force.
- Focus remains with the desktop editor unless a remote action explicitly changes it.
- Input and review controls are stripped from mirrored snapshots when they would make the
  mobile view noisy or misleading.

The desktop user should never feel that the mobile client is fighting the IDE.

### 3. Visual Parity Without Visual Dependence

The mobile UI should feel connected to Antigravity without becoming hostage to its CSS.
The project mirrors content, not the full styling implementation of the desktop app.

- Snapshot HTML is wrapped in a local presentation layer optimized for mobile reading.
- Theme identity is controlled by first-party CSS variables instead of upstream theme internals.
- Multiple local themes are supported because usability changes with context: daylight,
  low light, long reading sessions, and quick status checks all benefit from different looks.

The product aims for recognizability and comfort, not pixel-for-pixel dependence.

### 4. Security First, Then Convenience

Remote access is useful only if it is hard to misuse.

- Authentication is cookie-based and intentionally lightweight for personal workflows.
- Local network access can bypass login for convenience, but remote access still requires
  deliberate protection.
- Content Security Policy blocks inline script execution so mirrored HTML cannot escalate
  into script execution in the mobile browser.
- The app avoids inline JavaScript and keeps browser logic in external files to make CSP
  enforceable in practice.
- Frame and object embedding are blocked by default as defense-in-depth.

Convenience is added only after the blast radius is understood.

### 5. Mobile-First Workspace, Not Desktop Shrinkage

A phone is not a small laptop. The interaction model has to respect touch, interruptions,
and short attention windows.

- History, settings, and selection flows use modal layers instead of desktop sidebars.
- Workspace tools are grouped into focused panels instead of forcing full desktop density.
- Quick actions reduce typing for common follow-up prompts.
- Large tap targets and simple status labels are preferred over dense control surfaces.

The mobile client is designed for short, decisive interactions.

### 6. Modular Growth

The feature set is broad, so the codebase cannot scale as one giant server file plus one
giant client script forever. Features are split into modules when they become product
capabilities in their own right.

- CDP connection logic lives separately from route handlers.
- Supervisor, quota polling, session stats, screenshot timeline, workspace tools, and
  utility helpers each have isolated modules.
- Frontend workspace panels are componentized by concern.

Growth should happen by adding focused modules, not by turning existing files into
undifferentiated storage for unrelated behaviors.

### 7. Observability Is a Product Feature

The user should not need SSH, tail, or guesswork to understand what the remote session
is doing.

- Session stats expose actions, errors, and lifecycle signals.
- Quota polling surfaces model limits before the session unexpectedly stalls.
- Screenshot timeline provides a visual audit trail of recent IDE states.
- Admin metrics summarize CDP, WebSocket, workspace, and tunnel health.
- Server logs are exposed in the admin UI because diagnostics are part of remote control.

Operational visibility is not treated as an afterthought.

### 8. AI-Augmented Control Should Stay Reviewable

The project adds intelligence around Antigravity, but that intelligence must remain
inspectable and interruptible.

- The supervisor can suggest or automate safe actions, but those flows are explicit.
- Suggestions are queued, reviewable, and broadcast to the client instead of silently
  disappearing into background automation.
- Assist chat augments the session without replacing the source of truth in the IDE.

Automation is useful only when the user can understand what happened and why.

### 9. Graceful Degradation Beats Hard Failure

Optional systems will fail sometimes: CDP can disconnect, tunnel binaries can be absent,
Telegram may be unconfigured, and quota endpoints may be unavailable.

- The product keeps core chat mirroring available even when optional features are offline.
- Tunnels are provider-based so one external service failure does not remove all remote access.
- UI states prefer "offline", "reconnecting", or "unavailable" messaging over blank screens.
- Optional integrations fail closed and avoid crashing the server.

The server should remain useful when peripherals are impaired.

### 10. Human Latency Matters

The product exists to reduce wait-cost, not just to prove that remote control is possible.
That changes small implementation choices.

- The system favors fast reads over elaborate navigation.
- QR onboarding and tunnel shortcuts reduce setup friction.
- Thought expansion and approval controls are optimized for low-latency intervention.
- The interface makes it easier to check, decide, and move on.

Time spent waiting for AI is part of the UX, so reducing interruption cost is a primary goal.

## Human-Centric Features

- The "walk away from the desk" use case is a first-order design input, not a side effect.
- The product is designed for moments when the user only has one hand, a few seconds,
  or unreliable network conditions.
- Workspace context is available because remote control without surrounding context is
  often worse than no remote control at all.

## Technical Trade-offs

| Decision | Why this trade-off exists |
| :-- | :-- |
| CDP mirroring over browser automation-only approaches | Direct IDE introspection gives better session awareness and lower-latency control. |
| Heuristic DOM targeting over strict selectors | Upstream UI churn is more likely than perfect selector stability. |
| External-first CSP and no inline JS | Snapshot HTML is untrusted enough that browser-enforced script blocking is worth the discipline cost. |
| Cookie auth over heavier identity flows | This is primarily a personal operator tool; friction must stay low. |
| Optional tunnel providers instead of one mandatory provider | Remote access is more reliable when one provider outage does not block the workflow. |
| Local design system over exact IDE CSS mirroring | Stable mobile UX is more maintainable than fragile upstream style coupling. |
| Modular feature services | Quotas, stats, screenshots, and supervisor logic evolve on different timelines and should remain separable. |

## ADR-Style Notes

### Why CDP Ports 7800-7803

The project scans a small, explicit range rather than attempting broad local discovery.
That keeps startup predictable and aligns with the expected Antigravity debugging setup.

### Why Port 4747

The chosen app port avoids the most common local collisions from frontend dev servers
and local tooling while remaining easy to remember.

### Why Tunnels Are Optional

Remote access should work on a local network with zero tunnel dependency. Public tunnel
support exists to expand reach, not to become a mandatory runtime requirement.

### Why the Root Document Exists

This file is the architectural source of truth for high-level design intent. Detailed
implementation notes can live under `docs/`, but principle-level decisions belong at the
project root where contributors will see them early.
