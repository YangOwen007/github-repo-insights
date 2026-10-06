import { spawnSync } from "node:child_process";

// Report the full audit, allowing only the documented development-tool advisory.
// pnpm supplies its own entry path, avoiding Windows command-shell argument handling.
const entry = process.env.npm_execpath;
if (!entry) { console.error("Run this check through pnpm audit:security."); process.exit(1); }
const result = spawnSync(process.execPath, [entry, "audit", "--json"], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
let audit;
try { audit = JSON.parse(result.stdout); } catch {
  console.error("Dependency audit could not run. Check registry/network availability.");
  process.exit(1);
}
if (!audit.metadata?.vulnerabilities) {
  console.error("Unexpected audit response; no security result available.");
  process.exit(1);
}
let blocked = false;
for (const advisory of Object.values(audit.advisories ?? {})) {
  if (!["moderate", "high", "critical"].includes(advisory.severity)) continue;
  const exception = advisory.github_advisory_id === "GHSA-vfj7-8cjw-p6xm" && advisory.module_name === "braces" && advisory.findings.length > 0 && advisory.findings.every(item => item.version === "3.0.3" && item.paths.length > 0 && item.paths.every(path => path === ".>eslint-config-next>@next/eslint-plugin-next>fast-glob>micromatch>braces"));
  if (exception) console.warn("KNOWN EXCEPTION: development-only braces@3.0.3, GHSA-vfj7-8cjw-p6xm. Installable patch unavailable at review; see README.");
  else { console.error(`${advisory.severity}: ${advisory.module_name} (${advisory.github_advisory_id})`); blocked = true; }
}
console.log(JSON.stringify(audit.metadata.vulnerabilities));
process.exitCode = blocked ? 1 : 0;
