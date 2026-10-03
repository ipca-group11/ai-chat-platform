// Bundles the server (and the TypeScript sources of @app/shared-types) into one file, so
// the Docker image only needs Node and dist/main.cjs.
import { build } from "esbuild";

await build({
  entryPoints: ["src/main.ts"],
  outfile: "dist/main.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node24",
  sourcemap: true,
  logLevel: "info",
});
