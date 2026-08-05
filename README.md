# Trading Dashboard

A personal, free, GitHub-hosted trading dashboard: log trades (with optional AI screenshot extraction), run an end-of-day rule-adherence review, and see a monthly calendar of your R.

## How it works

- **Hosting**: static site built with Vite + React, deployed to GitHub Pages for free via GitHub Actions on every push to `main`.
- **Data storage**: your trade log, daily reviews, and strategy rules/notes are stored as JSON files right in this repo (`data/`), plus screenshots in `screenshots/`. The app reads and writes them through the GitHub API using a Personal Access Token you provide — no external database.
- **Screenshot extraction**: optionally calls the Anthropic API directly from your browser to prefill a trade's fields from a screenshot. Fully optional — you can always log trades manually.

## One-time setup

1. Open the deployed site (or run locally with `npm run dev`).
2. Go to **Settings**:
   - Enter your GitHub username and this repo's name.
   - Create a fine-grained Personal Access Token at [github.com/settings/tokens](https://github.com/settings/tokens?type=beta), scoped to just this repo, with **Contents: Read and write** permission. Paste it in.
   - (Optional) Add an Anthropic API key from [console.anthropic.com](https://console.anthropic.com/settings/keys) to enable screenshot auto-extraction.
3. Click **Save settings**, then **Test connection**.

These values are stored only in your browser's local storage — they are never committed to the repo and persist across restarts on that browser/device. You'll need to re-enter them once on any new device.

## Local development

```bash
npm install
npm run dev
```

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the app and publishes it to GitHub Pages. Enable Pages once in the repo's Settings → Pages → Source: **GitHub Actions**.
