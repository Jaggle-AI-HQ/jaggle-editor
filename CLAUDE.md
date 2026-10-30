# jaggle-editor

npm workspaces: `packages/editor` (`@jaggle-ai-hq/editor`, tsup, ESM only) and `apps/playground` (Vite 8, Tailwind 4).

- **Run `npm run check` before finishing.** It builds, lints, typechecks and tests. The dist tests read `packages/editor/dist`, so build first.
- **Backend access goes through an adapter.** Add new backend needs to `src/adapters/types.ts` (with a "without it" behaviour); never import an app's services. Every editor query key starts with `EDITOR_QUERY_KEY`.
- **The shared contracts don't change without a plan for both apps.** These are the room name, the Y.Doc keys, `jaggle-file://attachment/<id>` references and `CommentBody` (listed in the package README).
- **Styling.** Use Tailwind classes and the standard shadcn variables only. Editor-specific CSS goes in `src/styles.css`. Don't import CSS from TypeScript.
- **Keep code lazy.** `index.ts` must not statically reach the document surface, the comment composer, Yjs, emoji data, KaTeX or mammoth (`tests/dist-boundaries.test.ts`).
- **Lint.** `eslint-plugin-react-hooks` is pinned to 7.0.1, the version jaggle-app-fe lints this code with.
- **Porting from jaggle-app-fe.** The code came from `src/components/lexical/core` at the commit in `packages/editor/CHANGELOG.md`. When porting later changes, map `@/services/*` calls onto adapters.
