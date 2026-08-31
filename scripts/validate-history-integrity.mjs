import { execFileSync } from "node:child_process";

const baseRef = process.argv[2] ?? process.env.BASE_REF ?? "origin/main";
const protectedFiles = ["CHANGELOG.md", "docs/progress.md", "docs/debug-log.md"];

const failures = [];
const results = [];

for (const file of protectedFiles) {
  const headText = readFileAt("HEAD", file);
  const baseText = readFileAt(baseRef, file);

  if (headText == null) {
    failures.push(`${file} must not be deleted.`);
    continue;
  }

  if (baseText == null) {
    results.push({ file, status: "new", lineDelta: lineCount(headText) });
    continue;
  }

  const baseLines = lineCount(baseText);
  const headLines = lineCount(headText);
  const lineDelta = headLines - baseLines;
  const allowedDrop = file === "CHANGELOG.md" ? 5 : 0;

  if (lineDelta < -allowedDrop) {
    failures.push(
      `${file} lost ${Math.abs(lineDelta)} lines compared with ${baseRef}; allowed drop is ${allowedDrop}. Preserve history and prepend new records.`
    );
  }

  const removedHeadings = missingItems(extractHeadings(baseText), extractHeadings(headText));
  if (removedHeadings.length > 0) {
    failures.push(
      [`${file} removed historical headings:`, ...removedHeadings.map((heading) => `  - ${heading}`)].join("\n")
    );
  }

  const removedAttributions = missingItems(extractAttributionLines(baseText), extractAttributionLines(headText));
  if (removedAttributions.length > 0) {
    failures.push(
      [
        `${file} removed historical attribution lines:`,
        ...removedAttributions.slice(0, 20).map((line) => `  - ${line}`),
        removedAttributions.length > 20 ? `  ... ${removedAttributions.length - 20} more` : null
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  const emptySections = findEmptySections(headText);
  if (emptySections.length > 0) {
    failures.push([`${file} contains empty sections:`, ...emptySections.map((section) => `  - ${section}`)].join("\n"));
  }

  results.push({
    file,
    baseLines,
    headLines,
    lineDelta,
    headings: extractHeadings(headText).length,
    attributionLines: extractAttributionLines(headText).length
  });
}

if (failures.length > 0) {
  console.error(["History integrity validation failed:", ...failures.map((failure) => `\n${failure}`)].join("\n"));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, baseRef, protectedFiles: results }, null, 2));

function readFileAt(ref, file) {
  try {
    return execFileSync("git", ["show", `${ref}:${file}`], { encoding: "utf8" });
  } catch {
    return null;
  }
}

function lineCount(text) {
  if (text.length === 0) return 0;
  return text.endsWith("\n") ? text.split("\n").length - 1 : text.split("\n").length;
}

function extractHeadings(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => /^##\s+/.test(line));
}

function extractAttributionLines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => /^- .+\([a-z0-9_/-]+\)\.?$/.test(line));
}

function missingItems(baseItems, headItems) {
  const counts = new Map();
  for (const item of headItems) counts.set(item, (counts.get(item) ?? 0) + 1);
  const missing = [];
  for (const item of baseItems) {
    const count = counts.get(item) ?? 0;
    if (count > 0) {
      counts.set(item, count - 1);
    } else {
      missing.push(item);
    }
  }
  return missing;
}

function findEmptySections(text) {
  const lines = text.split(/\r?\n/);
  const empty = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!/^##\s+/.test(lines[i])) continue;
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === "") j += 1;
    if (j >= lines.length || /^##\s+/.test(lines[j])) empty.push(`${i + 1}: ${lines[i]}`);
  }
  return empty;
}
