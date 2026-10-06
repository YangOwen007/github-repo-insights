import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// This conservative detector reports locations, never matched values. It is not a substitute for rotation or a dedicated scanner.
const patterns = [
  /(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})/,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /(?:sk-[A-Za-z0-9_-]{32,})/,
  /(?:postgres(?:ql)?|mongodb(?:\+srv)?):\/\/[^\s:/]+:[^\s@]+@/,
  /(?:GITHUB_TOKEN|NEXT_PUBLIC_\w*(?:TOKEN|SECRET|PASSWORD))\s*=\s*["']?[A-Za-z0-9_-]{20,}/,
];
const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const findings = [];
let checked = 0;
function inspect(label, contents) {
  checked++;
  // These two historical README examples are literal placeholders, not credentials.
  const text = contents.replaceAll("GITHUB_TOKEN=your_personal_access_token", "GITHUB_TOKEN=");
  if (patterns.some(pattern => pattern.test(text))) findings.push(label);
}

// Scan tracked working files and every reachable historical blob without rewriting history.
for (const file of git("ls-files", "-z").split("\0").filter(Boolean)) {
  try { inspect(file, readFileSync(file, "utf8")); } catch { /* Deleted files have no working content. */ }
}
for (const line of git("rev-list", "--objects", "--all").trim().split("\n")) {
  const [oid] = line.split(" ");
  if (git("cat-file", "-t", oid).trim() === "blob") inspect(`history:${oid}`, git("cat-file", "blob", oid));
}

// Include untracked source/config/docs and generated JS/maps/logs, but not dependencies or binary assets.
function walk(directory) {
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    if ([".git", "node_modules", ".pnpm-store", ".verification", ".agents", ".codex"].includes(item.name)) continue;
    const path = join(directory, item.name);
    if (item.isDirectory()) walk(path);
    else if ((/\.(?:[cm]?[jt]sx?|json|map|md|ya?ml|log|css|toml)$/.test(item.name) || item.name.startsWith(".env")) && statSync(path).size < 64 * 1024 * 1024) inspect(path, readFileSync(path, "utf8"));
  }
}
walk(".");
if (findings.length) {
  console.error(`Potential secrets in ${findings.length} locations (values redacted):\n${[...new Set(findings)].join("\n")}`);
  process.exitCode = 1;
} else console.log(`No supported secret patterns found in ${checked} files/history blobs. Detector coverage is limited; review nonstandard credentials separately.`);
