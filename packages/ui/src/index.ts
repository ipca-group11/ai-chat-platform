// Public API barrel for @app/ui.
//
// Consumers should only ever import from this file, from the per-component entries
// (`@app/ui/dialog`, `@app/ui/select`, `@app/ui/dropdown-menu`, `@app/ui/tooltip`,
// `@app/ui/tabs`, `@app/ui/toast`, `@app/ui/avatar`) or `@app/ui/styles.css` for the
// design tokens stylesheet, never reach into `src/components/**` directly, so this
// package's internal file layout can change freely.
//
// The barrel holds the light components every page needs. The components built on the
// larger Base UI primitives have their own entry (AICHAT-239): `@app/ui` is a Module
// Federation shared singleton, and a shared module is loaded whole (no tree shaking), so
// keeping them here made every page download all of them (about 80 kB gzip, mostly unused).
//
// Keep each export line focused on one component's module to minimize merge conflicts
// between tasks/PRs that add new components in parallel.

// Side-effect import so the build extracts these tokens into `dist/styles.css`
// (see the `exports["./styles.css"]` field in package.json). Consumers import the
// stylesheet separately, e.g. `import '@app/ui/styles.css'`.
import './styles/globals.css';

export { cn } from './lib/utils';

export { Button, buttonVariants, type ButtonProps } from './components/button/button';
export { Input, type InputProps } from './components/input/input';
export { Textarea, type TextareaProps } from './components/textarea/textarea';
export { Label, type LabelProps } from './components/label/label';
export { FormField, type FormFieldProps } from './components/form-field/form-field';
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './components/card/card';
export { Alert, AlertTitle, AlertDescription, alertVariants, type AlertProps } from './components/alert/alert';
export { Badge, badgeVariants, type BadgeProps } from './components/badge/badge';
export { Skeleton } from './components/skeleton/skeleton';
export {
  H1,
  H2,
  H3,
  H4,
  P,
  Lead,
  Large,
  Small,
  Muted,
  Blockquote,
  InlineCode,
  List,
} from './components/typography/typography';
