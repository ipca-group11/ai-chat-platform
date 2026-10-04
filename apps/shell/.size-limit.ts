// Bundle size budget of shell (AICHAT-22), gzip. Run: pnpm exec nx run shell:size (builds first).
// Limit = measured baseline + 10%, rounded up to the next KB; baseline and rule in docs/AICHAT-22/WORKLOG.md (US1).
// Raising a limit needs a reason in the pull request.
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
  // 8 KB (the analysis upper bound): since AICHAT-237 it also publishes the federation runtime for the remotes,
  // which no longer download their own copy (about 19 kB gzip each).
  { name: 'shell remoteEntry.js', path: 'dist/remoteEntry.js', limit: '8 KB', gzip: true },
  {
    name: 'shell own chunks',
    path: [`${assets}/*.js`, ...glue.map((g) => `!${g}`), ...sharedCopies.map((g) => `!${g}`)],
    limit: '57 KB',
    gzip: true,
  },
  { name: 'shell federation glue', path: glue, limit: '130 KB', gzip: true },
  { name: 'shell shared-library copies', path: sharedCopies, limit: '134 KB', gzip: true },
  { name: 'shell all emitted JS', path: [`${assets}/*.js`, 'dist/remoteEntry.js'], limit: '327 KB', gzip: true },
];
