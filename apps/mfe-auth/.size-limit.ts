// Bundle size budget of mfe-auth (AICHAT-22), gzip. Run: pnpm exec nx run mfe-auth:size (builds first).
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
const sharedCopies = [`${assets}/*prebuild*.js`, `${assets}/*loadShare*.js`];

export default [
  { name: 'mfe-auth remoteEntry.js', path: 'dist/remoteEntry.js', limit: '7 KB', gzip: true },
  {
    name: 'mfe-auth route chunks',
    path: [`${assets}/*.js`, ...glue.map((g) => `!${g}`), ...sharedCopies.map((g) => `!${g}`)],
    limit: '28 KB',
    gzip: true,
  },
  { name: 'mfe-auth federation glue', path: glue, limit: '107 KB', gzip: true },
  { name: 'mfe-auth shared-library copies', path: sharedCopies, limit: '137 KB', gzip: true },
  { name: 'mfe-auth all emitted JS', path: [`${assets}/*.js`, 'dist/remoteEntry.js'], limit: '277 KB', gzip: true },
];
