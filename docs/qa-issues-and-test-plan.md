# StoryMaker5000 QA Issue Log and Test System

Last updated: 2026-06-17

## Issue Log

| ID | Issue | Symptom | Root Cause | Current Status | Regression Check |
| --- | --- | --- | --- | --- | --- |
| QA-001 | Story gateway could not generate a scene | Submit prompt returned a generic gateway failure. | OpenAI model configuration pointed at an unavailable model. | Fixed by using the configured supported model. | Live story smoke test must return HTTP 200 and valid scene JSON. |
| QA-002 | Browser message: `The string did not match the expected pattern` | Prompt submit failed after a short progress state. | Provider failure was being surfaced too generically through the UI. | Improved error extraction from gateway checks. | Force provider failure and confirm the UI shows the provider detail. |
| QA-003 | Safari restricted port error | Safari refused to open a redirected URL. | Redirect path could include an unsafe absolute URL or local-port context. | Fixed by using relative redirects. | Login through public tunnel must redirect to `/`, never to a local port. |
| QA-004 | Next runtime `Invalid URL` behind tunnel | Next middleware threw during public access through Cloudflare. | Middleware URL parsing was brittle behind the tunnel adapter. | Fixed by removing middleware auth and enforcing auth in API routes. | Public tunnel access should not show a Next runtime overlay. |
| QA-005 | OTP expiry or consumption confusion | Code stops working after first use or after time passes. | OTP is intentionally one-time and short-lived. | Expected behavior; live info file records the latest code. | OTP login should work once; second use should fail with `Wrong or expired access code`. |
| QA-006 | `Online access secret must be at least 32 characters` | Access page accepted input but login failed with configuration error. | `.env.local` had a 24-character `ACCESS_PASSWORD`. | Fixed by replacing it with a 43-character secret. | Config check must assert `ACCESS_PASSWORD.length >= 32`. |
| QA-007 | Access code works but page does not move on | User remained on the access page after entering a valid code. | Native form redirect was not reliable enough through mobile Safari/tunnel. | Fixed by adding client-side JSON login and explicit `window.location.assign`. | Public login must set cookie and navigate to `/`. |
| QA-008 | Public tunnel 502 | Cloudflare URL returned 502. | Tunnel was alive but the local Next server had exited. | Operational issue; server must run in a persistent window. | Public URL smoke test must run after confirming port 3456 is listening. |
| QA-009 | Local PowerShell/curl TLS errors against Cloudflare | Public URL check failed locally even when tunnel was healthy. | Windows TLS/certificate stack did not validate the Cloudflare quick tunnel consistently. | Use Node with `NODE_OPTIONS=--use-system-ca` for automated public checks. | Public smoke test runner should use Node fetch with system CA. |
| QA-010 | Reset story was too easy to press | Reset was in the primary composer action row. | Destructive action was too prominent. | Fixed by moving reset to Additional Options and adding a stronger confirmation. | UI check should confirm reset is not in the composer and shows confirmation. |
| QA-011 | Living memory continuity | Story context could become scattered across scene notes and checkpoints. | Memory was flat notes only. | Fixed with structured living memory categories. | Story response must include `livingMemory`, and the drawer must show updated memory. |

## QA System Design

### 1. Preflight Checks

Run before any phone/public test:

```powershell
npm.cmd run typecheck
npm.cmd run build
```

Config checks:

- `.env.local` contains `ACCESS_PASSWORD`.
- `ACCESS_PASSWORD` length is at least 32.
- `OPENAI_MODEL` is set to the intended supported model.
- `STORY_PROVIDER` and `IMAGE_PROVIDER` are either configured or intentionally set to mock mode.

### 2. Local Access Smoke Test

Goal: prove the local app is healthy before opening a tunnel.

Checks:

- `GET http://localhost:3456/access` returns 200.
- Wrong OTP returns 401 with `Wrong or expired access code`, not a configuration error.
- Valid OTP returns success and sets `storymaker5000_access`.
- `GET /api/health` without cookie returns 401 when online access is enabled.
- `GET /api/health` with cookie returns 200.

### 3. Public Tunnel Smoke Test

Goal: prove the phone URL is usable.

Use Node fetch with system CA:

```powershell
$env:NODE_OPTIONS="--use-system-ca"
node scripts/diagnostics/public-smoke.mjs
```

Target checks:

- Public `/access` returns 200.
- Public JSON login with a temporary OTP returns `{ ok: true }`.
- Auth cookie is set.
- Public `/` with cookie returns the StoryMaker app, not the access form.
- Public `/api/health` with cookie returns 200.
- Public `/api/story/generate` with cookie returns a valid JSON response in mock or live mode.

### 4. Story Gateway Regression Tests

For each provider mode:

- Empty prompt returns a local validation error.
- Valid prompt returns `title`, `scene`, `summary`, `memoryNotes`, `characterUpdates`, `timelineUpdates`, `livingMemory`, and `imagePrompt`.
- Provider rejection exposes gateway detail in the UI.
- Living memory is compact, deduplicated, and capped to expected item counts.

### 5. Mobile UI Checks

Run on phone through the public URL:

- Access page accepts OTP and navigates to the app.
- Composer shows `Generate Story`, `Generate Image`, and `Save Checkpoint` beside or under the prompt depending on screen width.
- `Reset Story` appears only under Additional Options.
- Reset shows a warning before clearing the draft.
- Living Memory appears in the setup drawer.
- Generate Story updates chat and memory.
- Generate Image either starts image generation or gives a clear status message.

### 6. Operational Checks

Before sharing a phone URL:

- Port 3456 is listening.
- Cloudflare tunnel process is running.
- `online-live-info.json` contains the current public URL and OTP.
- Public URL returns 200.
- OTP has not been consumed by the QA test sent to the user.

### 7. Suggested Automation Backlog

Create these scripts when the flow stabilizes:

- `scripts/diagnostics/check-config.mjs`: verify env lengths, provider names, model names, and required files.
- `scripts/diagnostics/local-access-smoke.mjs`: create temporary OTP, test local login/cookie/health.
- `scripts/diagnostics/public-smoke.mjs`: test public tunnel login/root/health using Node fetch with system CA.
- `scripts/diagnostics/story-smoke.mjs`: test mock/live story generation response shape including living memory.
- `scripts/server/start-online-health.ps1`: start server and tunnel, wait for URL, write `online-live-info.json`, and run public smoke before printing the user link.
