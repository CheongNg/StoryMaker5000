# StoryMaker5000

A mobile-friendly web app for building characters, continuing long stories, and generating scene images.

## Start locally

1. Install dependencies:

```powershell
npm.cmd install
```

2. Copy `.env.example` to `.env.local` and add API keys when you are ready.

3. Run the app:

```powershell
npm.cmd run dev
```

4. Open the local URL on your computer. To test on your phone, make sure your phone is on the same Wi-Fi and open the network URL shown by Next.js.

The app works in mock mode without API keys, so you can try the workflow before connecting Gemini or Cloudflare.

## API keys

- Gemini: story generation through Google AI Studio.
- Cloudflare Workers AI: scene image generation.

Keep keys only in `.env.local`. Never put real keys in source files.
