# Randomish

**Generate random passwords, UUIDs and other randomish strings, right in the browser.**

Live at https://rand.pantas.net/

- Any number of "collections", each with its own rules: character classes, custom symbols, extra/excluded characters, look-alike filtering, "at least one of each class", fixed or global length. Also hex, UUID v4 and number ranges.
- Click a value to copy it. It gets replaced with a fresh one and added to the history.
- Every value is generated with `crypto.getRandomValues`, using rejection sampling (no modulo bias). Column headers show the exact entropy in bits.
- No server. Collections, settings and history live in your browser's `localStorage`. Collections can opt out of history.

The original 2019 ClojureScript version lives on at [panta82/randomish-old](https://github.com/panta82/randomish-old).

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
