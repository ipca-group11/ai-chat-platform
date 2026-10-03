import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "../../../shared/navigation";
import { logoutUser } from "../api/login";

/**
 * Logs the user out (AC-38 frontend half): revokes the session server-side, clears every
 * cached TanStack Query result so no previously-fetched data for the old session can leak
 * to whoever uses the app next, then redirects to `/login`.
 */
export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: logoutUser,
    onSettled: () => {
      queryClient.clear();
      navigate({ to: "/login" });
    },
  });
}
