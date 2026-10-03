import { RuleTester } from "eslint";
import { afterAll, describe, it } from "vitest";
import featureFolderBoundaries from "./feature-folder-boundaries.ts";

// Bridge ESLint's RuleTester (Mocha-shaped) onto Vitest's globals so `pnpm test` covers
// this rule the same way it covers every other unit under this pod.
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2023,
    sourceType: "module",
  },
});

describe("feature-folder-boundaries (AC-11: feature folders only import from shared/ and other features' index.ts, never feature internals)", () => {
  // AC-11: feature folders only import from shared/ and other features' index.ts.
  ruleTester.run("feature-folder-boundaries", featureFolderBoundaries, {
    valid: [
      {
        code: "import { useComposer } from './hooks/useComposer';",
        filename: "/repo/apps/mfe-chat/src/features/composer/Composer.tsx",
      },
      {
        code: "import { chatSchema } from '../chat-list';",
        filename: "/repo/apps/mfe-chat/src/features/composer/Composer.tsx",
      },
      {
        code: "import { chatSchema } from '../chat-list/index';",
        filename: "/repo/apps/mfe-chat/src/features/composer/Composer.tsx",
      },
      {
        code: "import { formatDate } from '../../shared/format-date';",
        filename: "/repo/apps/mfe-chat/src/features/composer/Composer.tsx",
      },
      {
        code: "import { z } from 'zod';",
        filename: "/repo/apps/mfe-chat/src/features/composer/Composer.tsx",
      },
      {
        code: "import { ChatDto } from '@shared-types/chat';",
        filename: "/repo/apps/mfe-chat/src/features/composer/Composer.tsx",
      },
      // AC-11: files outside src/features/** (e.g. src/shared/**) are out of scope —
      // the rule attaches no visitors and never reports.
      {
        code: "import { deep } from '../chat-list/hooks/useChatList';",
        filename: "/repo/apps/mfe-chat/src/shared/format-date.ts",
      },
      // AC-11: a re-export with no `source` (not a `export ... from`) is ignored.
      {
        code: "export const helper = () => {};",
        filename: "/repo/apps/mfe-chat/src/features/composer/Composer.tsx",
      },
      // AC-11: re-exporting another feature's public API (index) is allowed.
      {
        code: "export { chatSchema } from '../chat-list';",
        filename: "/repo/apps/mfe-chat/src/features/composer/Composer.tsx",
      },
      // AC-11: re-exporting everything from another feature's public API is allowed.
      {
        code: "export * from '../chat-list';",
        filename: "/repo/apps/mfe-chat/src/features/composer/Composer.tsx",
      },
      // AC-11: dynamically importing another feature's public API is allowed.
      {
        code: "const load = () => import('../chat-list');",
        filename: "/repo/apps/mfe-chat/src/features/composer/Composer.tsx",
      },
      // AC-11: a dynamic import with a non-literal specifier is ignored (can't be
      // statically resolved).
      {
        code: "const load = (path) => import(path);",
        filename: "/repo/apps/mfe-chat/src/features/composer/Composer.tsx",
      },
    ],
    invalid: [
      {
        code: "import { useChatList } from '../chat-list/hooks/useChatList';",
        filename: "/repo/apps/mfe-chat/src/features/composer/Composer.tsx",
        errors: [{ messageId: "noDeepImport" }],
      },
      {
        code: "import { ChatListItem } from '../chat-list/components/ChatListItem';",
        filename: "/repo/apps/mfe-chat/src/features/composer/Composer.tsx",
        errors: [{ messageId: "noDeepImport" }],
      },
      // AC-11: deep re-exporting another feature's internals is rejected.
      {
        code: "export { useChatList } from '../chat-list/hooks/useChatList';",
        filename: "/repo/apps/mfe-chat/src/features/composer/Composer.tsx",
        errors: [{ messageId: "noDeepImport" }],
      },
      // AC-11: deep `export *` from another feature's internals is rejected.
      {
        code: "export * from '../chat-list/hooks/useChatList';",
        filename: "/repo/apps/mfe-chat/src/features/composer/Composer.tsx",
        errors: [{ messageId: "noDeepImport" }],
      },
      // AC-11: deep dynamic import of another feature's internals is rejected.
      {
        code: "const load = () => import('../chat-list/hooks/useChatList');",
        filename: "/repo/apps/mfe-chat/src/features/composer/Composer.tsx",
        errors: [{ messageId: "noDeepImport" }],
      },
    ],
  });
});

afterAll(() => {
  const globals = RuleTester as unknown as Record<string, unknown>;
  delete globals.describe;
  delete globals.it;
  delete globals.itOnly;
});
