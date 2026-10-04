Inter and JetBrains Mono, served from our own origin (AICHAT-230): `globals.css` declares the
`@font-face` rules and the app bundles these files, so no page loads Google Fonts (which cannot
use SRI and would add two external hosts to the CSP).

- `inter-latin-wght-normal.woff2`: Inter variable (weights 100-900), Latin subset, from `@fontsource-variable/inter` 5.3.0
- `jetbrains-mono-latin-{400,600}-normal.woff2`: JetBrains Mono, Latin subset, from `@fontsource/jetbrains-mono` 5.3.0

Both families are licensed under the SIL Open Font License 1.1, see `OFL.txt`.
