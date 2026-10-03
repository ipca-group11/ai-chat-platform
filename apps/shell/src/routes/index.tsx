import { createFileRoute, redirect } from '@tanstack/react-router';

/** `/` always redirects to `/chats` (auth-guarded further down the tree). */
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/chats' });
  },
});
