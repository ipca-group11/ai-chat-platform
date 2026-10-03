import { createFileRoute } from '@tanstack/react-router';
import { RequireAuth } from '../features/auth-guard';
import { createRemoteRoute } from '../features/remote-loader';

const RemoteChatRoutes = createRemoteRoute('chat', () => import('mfeChat/routes'));

function ChatRoute() {
  return (
    <RequireAuth>
      <RemoteChatRoutes />
    </RequireAuth>
  );
}

export const Route = createFileRoute('/chats/$chatId')({
  component: ChatRoute,
});
