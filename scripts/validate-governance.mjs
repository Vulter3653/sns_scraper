import { execFileSync } from "node:child_process";
import fs from "node:fs";

const baseRef = process.argv[2] ?? process.env.BASE_REF ?? "origin/main";
const branchName =
  process.env.GITHUB_HEAD_REF ??
  process.env.BRANCH_NAME ??
  runGit(["rev-parse", "--abbrev-ref", "HEAD"]).trim();

const changedFiles = runGit(["diff", "--name-only", `${baseRef}...HEAD`])
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);

const failures = [];

if (changedFiles.length === 0) {
  console.log(JSON.stringify({ ok: true, baseRef, branchName, changedFiles: [] }, null, 2));
  process.exit(0);
}

if (!changedFiles.includes("CHANGELOG.md")) {
  failures.push("Every meaningful PR to main must update CHANGELOG.md.");
}

const progressRequiredPatterns = [
  /^AGENTS\.md$/,
  /^docs\/agent-writing-rules\.md$/,
  /^docs\/project-blueprint\.md$/,
  /^\.github\//,
  /^collectors\//,
  /^lib\//,
  /^scripts\//,
  /^src\//,
  /^index\.html$/,
  /^package\.json$/,
  /^VERSION$/
];

const requiresProgress = changedFiles.some((file) => progressRequiredPatterns.some((pattern) => pattern.test(file)));
if (requiresProgress && !changedFiles.includes("docs/progress.md")) {
  failures.push(
    "Policy, runtime, workflow, UI, package, or version changes must update docs/progress.md."
  );
}

if (changedFiles.includes("CHANGELOG.md")) {
  const addedLines = getAddedLines("CHANGELOG.md");
  const attributionPattern =
    /^- (Added|Changed|Fixed|Removed|Security|Infra|Docs|Validation|State): .+ \([a-z0-9_/-]+\)\.?$/;
  if (!addedLines.some((line) => attributionPattern.test(line))) {
    failures.push(
      "CHANGELOG.md must add at least one attributed record using '- Label: Description. (agent-id)'."
    );
  }
}

const versionFile = fs.readFileSync("VERSION", "utf8").trim();
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
if (versionFile !== packageJson.version) {
  failures.push(`VERSION (${versionFile}) must match package.json version (${packageJson.version}).`);
}

const forbiddenTrackedFiles = changedFiles.filter((file) => {
  if (file === ".env.example") return false;
  return file === ".env" || /^\.env\./.test(file);
});
if (forbiddenTrackedFiles.length > 0) {
  failures.push(
    `Secret-bearing environment files must not be tracked: ${forbiddenTrackedFiles.join(", ")}`
  );
}

if (failures.length > 0) {
  console.error(["Governance validation failed:", ...failures.map((failure) => `\n${failure}`)].join("\n"));
  console.error("\nChanged files:");
  for (const file of changedFiles) console.error(`  - ${file}`);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      baseRef,
      branchName,
      changedFiles,
      requiresProgress,
      version: versionFile
    },
    null,
    2
  )
);

function runGit(args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

function getAddedLines(path) {
  return runGit(["diff", "--unified=0", `${baseRef}...HEAD`, "--", path])
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1));
}
