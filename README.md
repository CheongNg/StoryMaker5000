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

Open the local URL on your computer:

```text
http://localhost:3000
```

## Test from your phone

1. Keep your phone and computer on the same Wi-Fi network.
2. Start the app with `npm.cmd run dev`.
3. Find your computer's IPv4 address:

```powershell
ipconfig
```

4. On your phone, open:

```text
http://YOUR_IPV4_ADDRESS:3000
```

Example:

```text
http://192.168.1.25:3000
```

If the phone cannot connect, check Windows Firewall and make sure the network is private/trusted.

## Mock mode

By default, the app uses mock mode. That means:

- Story generation returns a deterministic sample scene.
- Image generation returns an SVG placeholder.
- The full UI workflow can still be tested.
- Gateway checks will show mock or warning status where live providers are not configured.

## Live providers

Copy the example environment file:

```powershell
Copy-Item .env.example .env.local
```

Story generation options:

```text
STORY_PROVIDER=mock
STORY_PROVIDER=openai
STORY_PROVIDER=gemini
```

Image generation options:

```text
IMAGE_PROVIDER=mock
IMAGE_PROVIDER=openai
IMAGE_PROVIDER=cloudflare
```

Required keys depend on the provider:

```text
OPENAI_API_KEY=
GEMINI_API_KEY=
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
```

Keep real keys in `.env.local` only.

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
