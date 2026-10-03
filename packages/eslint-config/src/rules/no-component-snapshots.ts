import type { Rule } from "eslint";

/**
 * Snapshots are only for DTOs and wire output (docs/AICHAT-20). A snapshot of a rendered
 * component tree breaks on every markup change and tells the reviewer nothing, so test
 * files for components (`*.test.tsx`, `*.spec.tsx`) must assert on roles, text and
 * behaviour instead. The base config switches this rule on for those files only.
 */
const SNAPSHOT_MATCHERS = new Set([
  "toMatchSnapshot",
  "toMatchInlineSnapshot",
  "toMatchFileSnapshot",
  "toThrowErrorMatchingSnapshot",
  "toThrowErrorMatchingInlineSnapshot",
]);

const noComponentSnapshots: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description: "Forbid snapshot matchers in component test files (.tsx); snapshot DTOs and wire output only.",
    },
    schema: [],
    messages: {
      noSnapshot:
        "'{{matcher}}' is not allowed in component tests. Assert on roles, text and behaviour; snapshots are only for DTOs and wire output (in .ts tests).",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== "MemberExpression") return;
        const property = callee.property;
        const matcher =
          property.type === "Identifier" && !callee.computed
            ? property.name
            : property.type === "Literal" && typeof property.value === "string"
              ? property.value
              : undefined;
        if (matcher && SNAPSHOT_MATCHERS.has(matcher)) {
          context.report({ node: property, messageId: "noSnapshot", data: { matcher } });
        }
      },
    };
  },
};

export default noComponentSnapshots;
