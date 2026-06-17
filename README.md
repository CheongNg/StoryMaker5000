# StoryMaker5000

A personal-use story creator that runs as a local web app and works from a phone browser on the same Wi-Fi network.

## Current stage

This first build includes:

- Mobile-friendly story workspace
- Character editor
- Browser-local draft persistence
- Story generation gateway with validation
- Scene image gateway with validation
- Mock story and image generation when API keys are not configured
- Gateway check panels showing what is working, mocked, or misconfigured

The app intentionally excludes billing, account systems, compliance workflows, shared cloud storage, and production deployment.

## Run locally

Install dependencies:

```powershell
npm.cmd install
```

Start the app:

```powershell
npm.cmd run dev
```

The dev/start scripts set `NODE_OPTIONS=--use-system-ca` so Node can use the Windows certificate store when calling OpenAI over HTTPS.

Open the local URL on your computer:

```text
http://localhost:3000
```

## GitHub sync habit

Use this protocol whenever switching between desktop Codex, phone Codex, or GitHub.

Before starting work:

```powershell
git fetch origin
git status
git pull --rebase origin main
```

After making changes:

```powershell
git status
git add .
git commit -m "Describe your changes"
git push origin main
```

Final check:

```powershell
git status
```

You are in sync when Git says your branch is up to date with `origin/main` and there are no uncommitted changes.

## Frontend validation habit

Use this protocol every time a change is finished, before committing and pushing.

Start the app:

```powershell
npm.cmd run dev
```

Check on desktop:

```text
http://localhost:3000
```

Check on phone:

```text
http://YOUR_IPV4_ADDRESS:3456
```

Validate the main workflow:

- App loads without console or visible errors
- Layout works on desktop width
- Layout works on phone width
- Story setup can be edited
- Character setup can be edited
- Story generation still returns a result
- Image generation still returns a result or a clear gateway status
- Existing drafts still load from browser storage

Only commit and push after the desktop and phone checks both pass.

## Test from your phone

1. Keep your phone and computer on the same Wi-Fi network.
2. Restart any old StoryMaker5000 servers and start the phone server:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/server/restart-servers.ps1
```

You can also double-click:

```text
restart-servers.bat
```

3. Find your computer's IPv4 address:

```powershell
ipconfig
```

4. On your phone, open:

```text
http://YOUR_IPV4_ADDRESS:3456
```

Example:

```text
http://192.168.1.25:3000
```

If the phone cannot connect, check Windows Firewall and make sure the network is private/trusted.

## Restart server protocol

Use this whenever Codex or a terminal session needs to restart the app and give you a phone link.

1. Stop existing StoryMaker5000 listeners on ports `3000` and `3456`.
2. Start the server with Windows certificate trust enabled.
3. Print the computer link and every detected phone link.
4. Keep the server window open while testing.

The scripted command is:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/server/restart-servers.ps1
```

Default links:

```text
Computer: http://localhost:3456
Phone:    http://YOUR_IPV4_ADDRESS:3456
```

## Online phone access

For access outside your Wi-Fi, use a temporary Cloudflare tunnel. This exposes the same frontend through a public HTTPS link protected by a generated one-time access code. Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/server/start-online.ps1
```

You can also double-click:

```text
run-online.bat
```

The script starts the local app on `http://localhost:3456`, generates an 8-digit one-time access code, checks that the access page is responding, then uses `cloudflared` if it is installed. If not, it uses a cached `cloudflared.exe` or `npx --yes cloudflared`. Cloudflare prints a public `https://*.trycloudflare.com` link that works from your phone outside Wi-Fi.

Security notes:

- The public URL is not secret. Anyone with the link will see the access page.
- The app and API routes require the one-time code before they can be used.
- The code expires after 20 minutes and is consumed after the first successful login.
- Failed code attempts are temporarily throttled by the local server.
- Do not share the public URL or code. Close the script window when you are done to stop the tunnel.
- If startup fails, check `online-server.err.log` and `online-server.out.log`.

## Mock mode

By default, the app uses mock mode. That means:

- Story generation returns a deterministic sample scene.
- Image generation returns an SVG placeholder.
- The full UI workflow can still be tested.
- Gateway checks will show mock or warning status where live providers are not configured.

## Live provider

Copy the example environment file:

```powershell
Copy-Item .env.example .env.local
```

This stage uses OpenAI for story generation. Image generation can use either OpenAI or Grok.

## Backend instruction layer

Core story and picture guardrails live in:

```text
app/api/instructions.ts
```

These backend instructions are applied automatically to every story and image request. Story and picture guardrails should be edited in this backend file instead of repeated in the frontend.

## Story presets

The editable starting story preset lives in:

```text
story-library/presets/default-story.json
```

Edit that JSON file to change the default scenario, starter character list, and first prompt used for a fresh draft or after `Reset Story`.

Additional selectable presets live in the same folder. The setup drawer includes a `Story Preset` picker that can switch the active draft between the available preset JSON files.

## Code modification protocol

Do not edit `app/api/instructions.ts` during optimization, refactoring, token-budget work, provider changes, or general code cleanup. Treat it as user-owned instruction content. Only change it when the user explicitly asks to edit `app/api/instructions.ts` or asks to change the backend story/picture instruction text itself.

## Token and generation budget

The app keeps live provider calls lean by default:

- Story generation sends only compact scenario fields, the 3 most recent scenes, and 24 memory notes.
- Story output targets 350-650 words and keeps memory/update arrays short.
- Story-generated image prompts are capped to a compact visual prompt.
- Image generation accepts up to 3 reference images.
- Browser-uploaded character references are resized before storage and generation.
- Long image prompts are compacted by the backend before calling the provider.

Tune these limits in `app/api/story/generate/route.ts`, `app/api/image/generate/route.ts`, and `app/page.tsx`.

Story generation:

```text
STORY_PROVIDER=mock
STORY_PROVIDER=openai
```

Image generation:

```text
IMAGE_PROVIDER=mock
IMAGE_PROVIDER=openai
IMAGE_PROVIDER=grok
```

Required key:

```text
OPENAI_API_KEY=
XAI_API_KEY=
```

Recommended OpenAI models:

```text
OPENAI_MODEL=gpt-5.4-mini
OPENAI_IMAGE_MODEL=gpt-image-2
```

Recommended Grok image model:

```text
XAI_IMAGE_MODEL=grok-imagine-image-quality
XAI_IMAGE_ASPECT_RATIO=16:9
XAI_IMAGE_RESOLUTION=1k
```

Use `gpt-5.4-mini` for regular local story testing because it is a stronger cost/latency fit. Switch `OPENAI_MODEL` to `gpt-5.5` when you want the highest-quality story reasoning and are comfortable with higher cost. Keep real keys in `.env.local` only.

## Backend API check

For OpenAI stories with Grok images, create or edit `.env.local`:

```text
STORY_PROVIDER=openai
IMAGE_PROVIDER=grok
OPENAI_API_KEY=your_key_here
XAI_API_KEY=your_xai_key_here
OPENAI_MODEL=gpt-5.4-mini
XAI_IMAGE_MODEL=grok-imagine-image-quality
XAI_IMAGE_ASPECT_RATIO=16:9
XAI_IMAGE_RESOLUTION=1k
```

Restart the dev server after changing `.env.local`:

```powershell
npm.cmd run dev
```

Then run the backend smoke check in a second terminal:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/diagnostics/check-api.ps1
```

The health route should show the story and image gateways as configured. The smoke check will call both API routes and report whether each gateway is using `live` or `mock` mode.

## Validation gates

The app performs checks at these points:

- Browser storage check on load
- Local prompt and character checks before scene generation
- JSON parsing checks on each API route
- Request shape and length checks on each API route
- Provider configuration checks
- External provider HTTP status checks
- Response shape checks before the UI saves generated content

The visible gateway panels are meant to make failures easy to diagnose during personal testing.

## Folder map

- `app/`: Next.js pages, UI, and API routes.
- `lib/`: shared server helpers.
- `public/`: static browser assets and character reference pictures.
- `scripts/server/`: local, phone, and online server launchers.
- `scripts/diagnostics/`: smoke checks and troubleshooting scripts.
- `docs/`: QA notes and testing plans.
- `story-library/`: story planning material, references, and templates.
