# StoryMaker5000 Pathway

## Code modification protocol

- Do not edit `app/api/instructions.ts` during optimization, refactoring, token-budget work, provider changes, or general code cleanup.
- Treat `app/api/instructions.ts` as user-owned instruction content.
- Only change `app/api/instructions.ts` when the user explicitly asks to edit that file or asks to change the backend story/picture instruction text itself.

## Stage 1: Local personal MVP

Build a single-user browser app that can be tested from desktop and phone.

Completed:

- Next.js app scaffold
- Mobile responsive layout
- Local draft storage
- Character setup
- Story setup
- Scene generation route
- Scene image generation route
- Mock mode for both AI gateways
- Gateway validation and status reporting

## Stage 2: Real model connection

Add keys in `.env.local` and test:

- `STORY_PROVIDER=openai` or `STORY_PROVIDER=gemini`
- `IMAGE_PROVIDER=openai` or `IMAGE_PROVIDER=cloudflare`

Then tune prompts, output shape, and image style.

## Stage 3: Shared storage

Replace browser-only local storage with SQLite or Postgres so phone and desktop share the same stories.

Suggested tables:

- stories
- characters
- scenes
- scene_images
- memories

## Stage 4: Rich story controls

Add:

- Story mode selector
- Multi-character speaking order
- Regenerate scene
- Rewrite selected text
- Continue from selected scene
- Manual memory editor
- Export story as Markdown

## Stage 5: Production concerns

Only after the personal tool is useful:

- Authentication
- Cloud storage
- Billing
- Moderation workflows
- Backups
- Admin tools
