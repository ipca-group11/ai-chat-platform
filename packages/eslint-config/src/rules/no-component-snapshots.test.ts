import { RuleTester } from "eslint";
import { describe, it } from "vitest";
import noComponentSnapshots from "./no-component-snapshots.ts";

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2023, sourceType: "module" },
});

describe("no-component-snapshots", () => {
  ruleTester.run("no-component-snapshots", noComponentSnapshots, {
    valid: [
      { code: "expect(screen.getByRole('button')).toBeVisible();" },
      { code: "expect(result).toEqual({ a: 1 });" },
      { code: "toMatchSnapshot();" },
      { code: "expect(a)[matcherName]();" },
    ],
    invalid: [
      {
        code: "expect(container).toMatchSnapshot();",
        errors: [{ messageId: "noSnapshot", data: { matcher: "toMatchSnapshot" } }],
      },
      {
        code: "expect(container.innerHTML).toMatchInlineSnapshot();",
        errors: [{ messageId: "noSnapshot", data: { matcher: "toMatchInlineSnapshot" } }],
      },
      {
        code: "await expect(html).toMatchFileSnapshot('./out.html');",
        errors: [{ messageId: "noSnapshot", data: { matcher: "toMatchFileSnapshot" } }],
      },
      {
        code: "expect(() => render()).toThrowErrorMatchingSnapshot();",
        errors: [{ messageId: "noSnapshot", data: { matcher: "toThrowErrorMatchingSnapshot" } }],
      },
      {
        code: "expect(a)['toMatchSnapshot']();",
        errors: [{ messageId: "noSnapshot", data: { matcher: "toMatchSnapshot" } }],
      },
    ],
  });
});
