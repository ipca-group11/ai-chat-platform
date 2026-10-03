import { createRouter } from '@tanstack/react-router';
import { routeTree } from '../routeTree.gen';

/**
 * The shell's single TanStack Router instance, built from the generated
 * route tree (`routeTree.gen.ts`, produced by the `tanstackRouter` Vite
 * plugin from the file-based routes under `src/routes/`; see
 * `vite.config.ts`).
 */
export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
