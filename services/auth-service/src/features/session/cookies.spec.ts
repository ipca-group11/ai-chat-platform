import type { Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { auth } from "../../shared/contracts/index.js";
import { clearAuthCookies, setAuthCookies } from "./cookies.js";

function mockRes() {
  return {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  } as unknown as Response & { cookie: ReturnType<typeof vi.fn>; clearCookie: ReturnType<typeof vi.fn> };
}

describe("cookie helpers", () => {
  it("AC-37: setAuthCookies sets both cookies as httpOnly/Secure/SameSite=Lax with correct names", () => {
    const res = mockRes();

    setAuthCookies(res, { accessToken: "access-val", refreshToken: "refresh-val" });

    expect(res.cookie).toHaveBeenCalledWith(
      auth.ACCESS_TOKEN_COOKIE,
      "access-val",
      expect.objectContaining({ httpOnly: true, secure: true, sameSite: "lax", path: "/" }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      auth.REFRESH_TOKEN_COOKIE,
      "refresh-val",
      expect.objectContaining({ httpOnly: true, secure: true, sameSite: "lax", path: "/auth" }),
    );
  });

  it("clearAuthCookies clears both cookies with matching paths", () => {
    const res = mockRes();

    clearAuthCookies(res);

    expect(res.clearCookie).toHaveBeenCalledWith(
      auth.ACCESS_TOKEN_COOKIE,
      expect.objectContaining({ path: "/" }),
    );
    expect(res.clearCookie).toHaveBeenCalledWith(
      auth.REFRESH_TOKEN_COOKIE,
      expect.objectContaining({ path: "/auth" }),
    );
  });
});
