#!/usr/bin/env node
// Runs a shell command and stores its output as evidence:
//   <out>/<name>.log  plain text output (ANSI codes stripped)
//   <out>/<name>.png  terminal-style screenshot rendered with headless Chrome
//
// Usage:
//   node scripts/evidence/term-shot.mjs --out docs/AICHAT-27/evidence --name 01-semgrep-baseline -- <command...>
//
// Options:
//   --out <dir>      output folder (created if missing)
//   --name <name>    file name without extension
//   --title <text>   window title (default: "<name> · ai-chat-platform"; one line, cut with … if too long)
//   --width <px>     image width (default 1200)
//   --tail <n>       keep only the last n lines in the image (the .log keeps everything)
//
// Re-render an existing .log without running the command again (keeps the command, output and exit code):
//   node scripts/evidence/term-shot.mjs --from-log docs/AICHAT-34/evidence/01-before-shell.log
//
// The script exits with the command's exit code, so it can wrap checks that are expected to fail.

import { spawnSync, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, rmSync, readFileSync, statSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { tmpdir } from "node:os";

const argv = process.argv.slice(2);
const stripAnsi = (s) => s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "").replace(/\x1b\][^\x07]*\x07/g, "");
const opts = {};
let command, raw, status, outDir, name, takenAt;

if (argv[0] === "--from-log") {
  // .log layout: "$ <command>" / output... / "[exit <n>]"
  const logFile = resolve(argv[1] ?? "");
  for (let i = 2; i < argv.length; i += 2) opts[argv[i].replace(/^--/, "")] = argv[i + 1];
  const text = readFileSync(logFile, "utf8").replace(/\n+$/, "");
  const lines = text.split("\n");
  command = lines[0].replace(/^\$ /, "");
  const exitLine = lines.at(-1).match(/^\[exit (\S+)\]$/);
  status = exitLine ? Number(exitLine[1]) : 0;
  raw = lines.slice(1, exitLine ? -1 : undefined).join("\n");
  outDir = dirname(logFile);
  name = basename(logFile, ".log");
  takenAt = statSync(logFile).mtime;
} else {
  const sep = argv.indexOf("--");
  if (sep === -1 || sep === argv.length - 1) {
    console.error("usage: term-shot.mjs --out <dir> --name <name> [--title t] [--width px] [--tail n] -- <command...>");
    console.error("       term-shot.mjs --from-log <file.log> [--title t] [--width px] [--tail n]");
    process.exit(2);
  }
  for (let i = 0; i < sep; i += 2) opts[argv[i].replace(/^--/, "")] = argv[i + 1];
  command = argv.slice(sep + 1).join(" ");
  outDir = resolve(opts.out ?? "evidence");
  name = opts.name ?? `shot-${Date.now()}`;
  const res = spawnSync("bash", ["-lc", command], {
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "1", CLICOLOR_FORCE: "1" },
    maxBuffer: 64 * 1024 * 1024,
  });
  raw = `${res.stdout ?? ""}${res.stderr ?? ""}`;
  status = res.status;
  takenAt = new Date();
  process.stdout.write(raw);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, `${name}.log`), `$ ${command}\n${stripAnsi(raw)}\n[exit ${status}]\n`);
}
const width = Number(opts.width ?? 1200);
const title = opts.title ?? `${name} · ai-chat-platform`;

// ANSI SGR -> HTML spans (16 colours, bold, dim)
const PALETTE = ["#1e1e1e", "#f14c4c", "#23d18b", "#f5f543", "#3b8eea", "#d670d6", "#29b8db", "#e5e5e5"];
const BRIGHT = ["#666666", "#f14c4c", "#23d18b", "#f5f543", "#3b8eea", "#d670d6", "#29b8db", "#ffffff"];
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function ansiToHtml(text) {
  let html = "";
  let style = {};
  const open = () => {
    const css = [];
    if (style.fg) css.push(`color:${style.fg}`);
    if (style.bold) css.push("font-weight:700");
    if (style.dim) css.push("opacity:.7");
    return css.length ? `<span style="${css.join(";")}">` : "<span>";
  };
  html += open();
  for (const part of text.split(/(\x1b\[[0-9;]*m)/)) {
    const m = part.match(/^\x1b\[([0-9;]*)m$/);
    if (!m) {
      html += esc(part.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, ""));
      continue;
    }
    for (const code of (m[1] || "0").split(";").map(Number)) {
      if (code === 0) style = {};
      else if (code === 1) style.bold = true;
      else if (code === 2) style.dim = true;
      else if (code === 22) style.bold = style.dim = false;
      else if (code >= 30 && code <= 37) style.fg = PALETTE[code - 30];
      else if (code >= 90 && code <= 97) style.fg = BRIGHT[code - 90];
      else if (code === 39) style.fg = undefined;
    }
    html += `</span>${open()}`;
  }
  return `${html}</span>`;
}

let shown = raw.replace(/\r\n/g, "\n").replace(/\n+$/, "");
const lines = shown.split("\n");
if (opts.tail && lines.length > Number(opts.tail)) shown = ["…", ...lines.slice(-Number(opts.tail))].join("\n");
const exitColor = status === 0 ? "#23d18b" : "#f14c4c";
const page = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#2b2b2b;font:13px/1.45 Menlo,Monaco,"SF Mono",Consolas,monospace}
.win{margin:16px;border-radius:8px;overflow:hidden;box-shadow:0 6px 24px #0008;background:#1e1e1e;color:#e5e5e5}
.bar{background:#3a3a3a;padding:8px 12px;display:flex;gap:8px;align-items:center;color:#bbb;font-size:12px}
.title{flex:1;min-width:0;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-right:52px}
.dot{width:12px;height:12px;border-radius:50%}
pre{margin:0;padding:12px 16px;white-space:pre-wrap;word-break:break-word}
.p{color:#23d18b}.x{color:${exitColor}}
</style><div class="win"><div class="bar"><span class="dot" style="background:#ff5f56"></span><span class="dot" style="background:#ffbd2e"></span><span class="dot" style="background:#27c93f"></span><span class="title">${esc(title)}</span></div>
<pre><span class="p">$</span> ${esc(command)}
${ansiToHtml(shown)}
<span class="x">[exit ${status}] · ${takenAt.toISOString().replace("T", " ").slice(0, 19)} UTC</span></pre></div>`;

const htmlFile = join(tmpdir(), `term-shot-${process.pid}.html`);
writeFileSync(htmlFile, page);
const chrome = [
  process.env.CHROME_BIN,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].find((p) => p && existsSync(p));
// count wrapped rows too: ~7.8px per character at 13px Menlo, 64px of padding and margins
const cols = Math.floor((width - 64) / 7.8);
const rows = [`$ ${command}`, ...stripAnsi(shown).split("\n"), ""].reduce((n, l) => n + Math.max(1, Math.ceil(l.length / cols)), 0);
const height = Math.min(8000, 90 + rows * 19);
if (chrome) {
  execFileSync(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    `--window-size=${width},${height}`,
    `--screenshot=${join(outDir, `${name}.png`)}`,
    `file://${htmlFile}`,
  ], { stdio: "ignore" });
  console.error(`\nevidence: ${join(outDir, name)}.{log,png}`);
} else {
  console.error(`\nevidence: ${join(outDir, name)}.log (no Chrome found, PNG skipped; set CHROME_BIN)`);
}
rmSync(htmlFile, { force: true });
process.exit(status ?? 1);
