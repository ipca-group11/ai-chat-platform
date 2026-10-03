import { Button } from "@app/ui";
import { useLogout } from "../hooks/useLogout";

/**
 * Logout action (PLAN.md F3, AC-38 frontend half). Revokes the session server-side,
 * clears cached TanStack Query state and redirects to `/login` (see `useLogout`).
 */
export function LogoutButton() {
  const { mutate, isPending } = useLogout();

  return (
    <Button loading={isPending} onClick={() => mutate()} type="button" variant="outline">
      {isPending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
