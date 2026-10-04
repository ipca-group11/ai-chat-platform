Fonts used only by the visual regression tests (AICHAT-19). The app still loads Inter and
JetBrains Mono from Google Fonts; the tests answer those requests with these local files so
screenshots do not depend on the network.

- `inter-latin-wght-normal.woff2`: Inter variable (weights 100-900), Latin subset, from `@fontsource-variable/inter` 5.3.0
- `jetbrains-mono-latin-{400,600}-normal.woff2`: JetBrains Mono, Latin subset, from `@fontsource/jetbrains-mono` 5.3.0

Both families are licensed under the SIL Open Font License 1.1, see `OFL.txt`.
