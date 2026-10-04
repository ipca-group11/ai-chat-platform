import { type QueryClient as QueryClientType } from "@tanstack/react-query";
export interface MountOptions {
    /** Authenticated user id, resolved by the shell's auth guard. */
    userId: string;
    /** The shell's shared TanStack Query client singleton (STACK.md §3). */
    queryClient?: QueryClientType;
}
/**
 * Standalone (non-composed) mount entry point for this remote, used when the
 * shell mounts `mfe-chat` at a container element rather than composing its
 * route tree directly into the shell's own router (e.g. during local/dev
 * preview of this remote in isolation). Wires the shared query client and a
 * self-contained router covering `/chats` and `/chats/:chatId`.
 */
export declare function mount(container: HTMLElement, options: MountOptions): void;
export declare function unmount(): void;
