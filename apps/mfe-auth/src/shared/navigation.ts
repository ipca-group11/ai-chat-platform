import { useNavigate as useRouterNavigate } from "@tanstack/react-router";

// Thin re-export so feature code depends on this module (easy to `vi.mock` in tests)
// rather than directly on `@tanstack/react-router`. When mounted inside the shell, this
// resolves to the shared, host-provided router instance (React/Router are shared
// singletons per STACK.md/AC-24); `mfe-auth` never owns route history itself.
export const useNavigate = useRouterNavigate;
