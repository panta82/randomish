# Randomish

**Generate random passwords, hex keys, PINs and other randomish strings, right in the browser.**

Live at https://rand.pantas.net/

- Any number of "collections", each with its own rules: character classes, custom characters and ranges (eg. `a-f!@#`), excluded characters, look-alike filtering, "at least one of each class", fixed or global length. Presets fill in common setups like hex and PINs.
- Click a value to copy it. It gets replaced with a fresh one and added to the history.
- Every value comes from `crypto.getRandomValues`, with rejection sampling so there is no modulo bias. Column headers show the entropy in bits, rounded down.
- No server. Collections, settings and the history of copied values are kept in your browser's `localStorage` until you clear them. A collection can opt out of history.

## Development

Built with [Solid](https://www.solidjs.com/) + [Vite](https://vite.dev/) + TypeScript.

```bash
npm install
npm run dev     # dev server
npm test        # unit tests for the generator
npm run build   # production build into dist/
```

## Deployment

Every push to `master` builds and deploys to GitHub Pages through `.github/workflows/pages.yml`. The custom domain is configured in the repository's Pages settings.
