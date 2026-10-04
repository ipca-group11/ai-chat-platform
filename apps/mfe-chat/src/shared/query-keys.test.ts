import { describe, expect, it } from "vitest";
import { queryKeys } from "./query-keys";

describe("queryKeys", () => {
  it("builds hierarchical keys so invalidating a chat reaches its messages and members", () => {
    expect(queryKeys.chats()).toEqual(["chats"]);
    expect(queryKeys.chat("c1")).toEqual(["chats", "c1"]);
    expect(queryKeys.messages("c1")).toEqual(["chats", "c1", "messages"]);
    expect(queryKeys.members("c1")).toEqual(["chats", "c1", "members"]);
    expect(queryKeys.messages("c1").slice(0, 2)).toEqual(queryKeys.chat("c1"));
    expect(queryKeys.members("c1").slice(0, 2)).toEqual(queryKeys.chat("c1"));
  });

  it("keeps the keys of different chats apart", () => {
    expect(queryKeys.messages("c1")).not.toEqual(queryKeys.messages("c2"));
    expect(queryKeys.members("c1")).not.toEqual(queryKeys.members("c2"));
  });
});
