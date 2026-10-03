// Ambient module declaration so TypeScript accepts side-effect CSS imports
// (e.g. `import './styles/globals.css'` in src/index.ts) without needing real types.
declare module '*.css';
