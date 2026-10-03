import { type AnyRoute } from "@tanstack/react-router";
/**
 * Registers this remote's routes onto the shell's root route (FE-1).
 * `apps/shell` (platform pod) owns the root route/router instance and the
 * shared TanStack Query client; it imports `createChatRoutes` and attaches
 * the returned routes under its own tree so `/chats` and `/chats/:chatId`
 * become part of the single app-wide router (consumed as the shell's own
 * AC-22/AC-23, per docs/pods/chat/PLAN.md FE-1).
 */
export declare function createChatRoutes(parentRoute: AnyRoute): readonly [import("@tanstack/react-router").Route<unknown, AnyRoute, "/chats", "/chats" | `/${any}/chats`, string, "/chats" | `/${any}/chats`, undefined, import("@tanstack/router-core").ResolveParams<"/chats">, import("@tanstack/router-core").AnyContext, import("@tanstack/router-core").AnyContext, import("@tanstack/router-core").AnyContext, {}, undefined, unknown, unknown, unknown, unknown, undefined>, import("@tanstack/react-router").Route<unknown, AnyRoute, "/chats/$chatId", "/chats/$chatId" | `/${any}/chats/$chatId`, string, "/chats/$chatId" | `/${any}/chats/$chatId`, undefined, import("@tanstack/router-core").ResolveParams<"/chats/$chatId">, import("@tanstack/router-core").AnyContext, import("@tanstack/router-core").AnyContext, import("@tanstack/router-core").AnyContext, {}, undefined, unknown, unknown, unknown, unknown, undefined>];
/**
 * Default export mounted by the shell's remote loader (`React.lazy(() => import("mfeChat/routes"))`)
 * on /chats and /chats/$chatId: renders the list or the chat for the current path. The
 * shell mounts it behind its auth guard without a user context, so the gate resolves
 * the signed-in user from the session.
 */
export default function ChatRoutes(): import("react").JSX.Element;
