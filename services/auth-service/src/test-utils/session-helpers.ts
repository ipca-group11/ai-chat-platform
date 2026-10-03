import type { Express } from "express";
import request from "supertest";

export const PASSWORD = "password1";

/** Registers `email` through the API. */
export async function registerVia(app: Express, email: string, password: string = PASSWORD): Promise<{ id: string; email: string }> {
  const res = await request(app).post("/auth/register").send({ email, password });
  if (res.status !== 201) throw new Error(`could not register: ${res.status}`);
  return res.body as { id: string; email: string };
}

/** Logs `email` in through the API and returns the `Set-Cookie` values. */
export async function loginVia(app: Express, email: string, password: string = PASSWORD): Promise<string[]> {
  const res = await request(app).post("/auth/login").send({ email, password });
  if (res.status !== 200) throw new Error(`could not log in: ${res.status}`);
  return res.headers["set-cookie"] as unknown as string[];
}

/** The `name=value` part of one cookie from a `Set-Cookie` list. */
export function cookieNamed(setCookie: string[], name: string): string {
  const found = setCookie.find((c) => c.startsWith(`${name}=`));
  if (!found) throw new Error(`no ${name} cookie`);
  return found.split(";")[0] as string;
}
