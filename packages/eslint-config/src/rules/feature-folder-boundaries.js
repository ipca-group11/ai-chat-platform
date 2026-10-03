import path from "node:path";

/**
 * Enforces the feature-folder convention from SPEC.md §3.3 / ARCHITECTURE.md §3:
 * `src/features/<feature>/{components,hooks,api,model,index.ts}` + `src/shared/`.
 *
 * A module inside `src/features/<a>/**` may only import:
 *   - other files within `src/features/<a>/**` (its own feature),
 *   - anything under `src/shared/**`,
 *   - the **public API** (`index.ts`/`index.tsx`, i.e. the bare feature directory
 *     specifier, not a deep path) of another feature `src/features/<b>/**`,
 *   - anything outside `src/features/**` and `src/shared/**` entirely (npm packages,
 *     `packages/*`, etc.) — those are out of scope for this rule.
 *
 * Deep-importing another feature's internals (`features/b/hooks/useThing`) is rejected.
 */

/** @type {import('eslint').Rule.RuleModule} */
const featureFolderBoundaries = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Feature folders may only import shared/ or another feature's index (public API), never another feature's internals.",
    },
    schema: [],
    messages: {
      noDeepImport:
        "Do not deep-import into feature '{{targetFeature}}' internals ('{{importPath}}'). Import from its public API ('features/{{targetFeature}}') instead.",
    },
  },
  create(context) {
    const filename = context.filename ?? context.getFilename();
    const normalized = filename.split(path.sep).join("/");
    const currentFeatureMatch = normalized.match(/\/src\/features\/([^/]+)\//);

    if (!currentFeatureMatch) {
      return {};
    }

    const currentFeature = currentFeatureMatch[1];

    function checkImport(node, importPath) {
      if (!importPath.startsWith(".")) {
        // Bare specifier (npm package, workspace package via tsconfig paths) — out of scope.
        return;
      }

      const dir = path.posix.dirname(normalized);
      const resolved = path.posix.normalize(path.posix.join(dir, importPath));
      const targetMatch = resolved.match(/\/src\/features\/([^/]+)(\/.*)?$/);

      if (!targetMatch) {
        return;
      }

      const targetFeature = targetMatch[1];
      const rest = targetMatch[2] ?? "";

      if (targetFeature === currentFeature) {
        return;
      }

      const isIndexOnly =
        rest === "" ||
        rest === "/" ||
        /^\/index(\.tsx?|\.jsx?)?$/.test(rest);

      if (!isIndexOnly) {
        context.report({
          node,
          messageId: "noDeepImport",
          data: { targetFeature, importPath },
        });
      }
    }

    return {
      ImportDeclaration(node) {
        checkImport(node, node.source.value);
      },
      ExportNamedDeclaration(node) {
        if (node.source) {
          checkImport(node, node.source.value);
        }
      },
      ExportAllDeclaration(node) {
        if (node.source) {
          checkImport(node, node.source.value);
        }
      },
      ImportExpression(node) {
        if (node.source.type === "Literal" && typeof node.source.value === "string") {
          checkImport(node, node.source.value);
        }
      },
    };
  },
};

export default featureFolderBoundaries;
