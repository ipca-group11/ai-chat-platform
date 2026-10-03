import type { QueryClient } from "@tanstack/react-query";
/** AC-60: opens (or reuses) an independent stream subscription for one chat. */
export declare function ensureChatStream(chatId: string, queryClient: QueryClient): void;
export declare function isChatStreaming(chatId: string): boolean;
export declare function closeChatStream(chatId: string): void;
/** Test-only: clears every open stream between test cases. */
export declare function __resetStreamRegistryForTests(): void;
