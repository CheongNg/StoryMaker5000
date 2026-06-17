# Story Presets

Edit these JSON files to change the app's selectable story presets.

Each preset can define:

- `id`: stable preset key
- `label`: name shown in the app
- `description`: short picker description
- `story`: scenario fields
- `starterCharacters`: default cast
- `starterPrompt`: first prompt

`default-story.json` is loaded when the app starts with no saved browser draft, and when Reset Story restores the default setup.
