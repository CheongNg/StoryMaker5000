# Story Library

Use this folder as a repository of example stories, illustrations, and reference pictures for StoryMaker5000.

## Recommended structure

Create one folder per story:

```text
story-library/
  priority-pdfs/
    high-quality-example.pdf
  stories/
    my-example-story/
      story.md
      metadata.json
      images/
        cover.jpg
        scene-01.jpg
        scene-02.jpg
      references/
        costume-reference.png
        room-reference.jpg
```

Use `priority-pdfs/` for high-quality complete stories that should guide StoryMaker5000 most strongly. Use `stories/` for supplemental examples, illustrations, pictures, and references.

The one-folder-per-story structure keeps each supplemental story portable. If you move, share, import, or delete one story later, its writing and images stay together.

## Priority template PDFs

Put complete, high-quality PDF stories in `priority-pdfs/`.

These should be used as the strongest learning examples for:

- Story structure
- Pacing
- Page turns
- Character voice
- Illustration flow
- Tone and quality bar

Suggested file names:

```text
priority-pdfs/
  bedtime-adventure-example.pdf
  gentle-friendship-story.pdf
  funny-animal-quest.pdf
```

When adding a PDF, also add a short note in `priority-pdfs/index.md` explaining why it is a priority example.

## What to upload

For each story, include:

- `story.md` for the story text, scene notes, and learning notes
- `metadata.json` for structured details the app can use later
- `images/` for final illustrations used with the story
- `references/` for inspiration images, sketches, screenshots, or style references

For high-quality complete examples, upload the PDF to `priority-pdfs/` instead.

## Image naming habit

Use simple file names:

```text
cover.jpg
scene-01.jpg
scene-02.jpg
character-ava.png
setting-library-room.jpg
style-reference-watercolor.jpg
```

Avoid spaces in file names. Use lowercase words separated by hyphens.

## Suggested image sizes

- Covers: `1200x1600` or similar portrait ratio
- Scene illustrations: `1024x1024`, `1344x768`, or `1536x864`
- Character references: any clear image where the character is easy to see

Use `.jpg` for photos or full illustrations. Use `.png` for transparent cutouts, sketches, diagrams, or UI screenshots.

## Learning notes

When adding a story, include a short section in `story.md` describing what the story teaches the app:

- Genre
- Tone
- Target age or reading level
- Pacing style
- Character voice
- Visual style
- What makes the example useful

These notes will help future prompt tuning and model evaluation.
