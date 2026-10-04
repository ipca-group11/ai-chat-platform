// Bundle size budget of mfe-chat (AICHAT-22), gzip. Run: pnpm exec nx run mfe-chat:size (builds first).
// Limit = measured baseline + 10%, rounded up to the next KB; baseline and rule in docs/AICHAT-22/WORKLOG.md (US1).
// Raising a limit needs a reason in the pull request.
// AICHAT-237: glue and total tightened after the remote stopped bundling the federation runtime.
const assets = 'dist/assets';

// Module Federation runtime and loader glue: requested at runtime, but not application code.
const glue = [
  'dist-*',
  'utils-*',
  'hostInit-*',
  'pendingShares-*',
  'rolldown-runtime-*',
  'vite-preload-helper-*',
  'react-*',
  'react-dom-*',
  'with-selector-*',
  'helpers-*',
  'mf-entry-bootstrap-*',
  'ssrEntryLoader-*',
  'ssrVmStrategy-*',
  '_virtual_mf-localSharedImportMap_*',
].map((name) => `${assets}/${name}.js`);

// Copies of the shared libraries (react, react-dom, router, query, ui). In a remote these are
// fallbacks that the browser does not download when the shell provides the library.
// The per-component entries of @app/ui (AICHAT-239) and the Base UI code they share are shared
// modules too, downloaded only when a page renders that component.
const designSystemEntries = ['avatar', 'dialog', 'dropdown-menu', 'select', 'tabs', 'toast', 'tooltip', 'useOpenInteractionType'];
const sharedCopies = [
  `${assets}/*prebuild*.js`,
  `${assets}/*loadShare*.js`,
  ...designSystemEntries.map((name) => `${assets}/${name}-*.js`),
];

// AICHAT-239: @app/ui is split into a light barrel and per-component entries; the shared design system
// moved from the `dist-*` chunk (glue) to the shared-copies group, so glue went down, shared copies up
// and the total down. Limits re-measured (+10%).
export default [
  { name: 'mfe-chat remoteEntry.js', path: 'dist/remoteEntry.js', limit: '7 KB', gzip: true },
  {
    name: 'mfe-chat route chunks',
    path: [`${assets}/*.js`, ...glue.map((g) => `!${g}`), ...sharedCopies.map((g) => `!${g}`)],
    limit: '70 KB',
    gzip: true,
  },
  { name: 'mfe-chat federation glue', path: glue, limit: '20 KB', gzip: true },
  { name: 'mfe-chat shared-library copies', path: sharedCopies, limit: '206 KB', gzip: true },
  { name: 'mfe-chat all emitted JS', path: [`${assets}/*.js`, 'dist/remoteEntry.js'], limit: '306 KB', gzip: true },
];
