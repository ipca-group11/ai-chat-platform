import { createRoute, useRouterState, type AnyRoute, type RouteComponent } from "@tanstack/react-router";
import { LoginForm } from "./features/login";
import { RegisterForm } from "./features/register";

// Route entry exposed via Module Federation as `./routes` (PLAN.md F1).
//
// The shell (owned by `platform`) owns the root route and the router instance (React,
// react-dom, @tanstack/react-router and @tanstack/react-query are shared singletons per
// STACK.md / AC-24, so this remote never creates its own router at runtime — it only
// describes routes to attach to the host's tree). The shell calls `createAuthRoutes`
// with its own root route and mounts the resulting `/login` and `/register` routes.
export function createAuthRoutes(rootRoute: AnyRoute) {
  const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/login",
    component: LoginForm as RouteComponent,
  });

  const registerRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/register",
    component: RegisterForm as RouteComponent,
  });

  return [loginRoute, registerRoute] as const;
}

/**
 * Default export mounted by the shell's remote loader (`React.lazy(() => import("mfeAuth/routes"))`):
 * renders the screen for the current path, so /login and /register both work.
 */
export default function AuthRoutes() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return pathname.startsWith("/register") ? <RegisterForm /> : <LoginForm />;
}
