import type { Config } from "postcss-load-config";

const config: Config = {
  plugins: {
    // typeset.css uses native CSS nesting; flatten it for Tailwind v3.
    "tailwindcss/nesting": {},
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
