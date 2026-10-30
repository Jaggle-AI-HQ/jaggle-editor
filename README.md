# jaggle-editor

Jaggle's shared rich-text editor, published privately as [`@jaggle-ai-hq/editor`](packages/editor/README.md), for Jaggle AI (jaggle-app-fe) and Jaggle Office.

- `packages/editor`: the package. Its README covers installing it, styles, adapters and the contracts between apps.
- `apps/playground`: a Vite app that uses the package the way an app would, with in-memory adapters.

```bash
npm install
npm run check        # build, lint, typecheck, test
npm run playground   # http://localhost:5190
```

Node 24 (`.nvmrc`). Releases go out through the **Publish Package** workflow.
