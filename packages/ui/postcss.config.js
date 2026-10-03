export default {
  plugins: {
    // typeset.css uses native CSS nesting; flatten it for Tailwind v3.
    'tailwindcss/nesting': {},
    tailwindcss: {},
    autoprefixer: {},
  },
};
