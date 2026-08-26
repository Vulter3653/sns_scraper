#!/usr/bin/env bash

set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ "$(uname -s)" != "Linux" || "$(uname -m)" != "x86_64" ]]; then
  echo "Unsupported platform: this fallback installer supports Linux x86_64 only." >&2
  exit 1
fi

readarray -t browser_info < <(node --input-type=module <<'NODE'
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const metadataPath = path.join(
  path.dirname(fileURLToPath(import.meta.resolve('playwright-core'))),
  'browsers.json',
);
const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
const chromium = metadata.browsers.find(({ name }) => name === 'chromium');

if (!chromium?.browserVersion || !chromium?.revision) {
  throw new Error('Could not determine Chromium metadata from the installed Playwright package.');
}

console.log(chromium.browserVersion);
console.log(chromium.revision);
NODE
)

browser_version="${browser_info[0]}"
browser_revision="${browser_info[1]}"
install_root="${project_root}/.cache/chrome-for-testing/${browser_version}"
executable="${install_root}/chrome-linux64/chrome"
download_url="https://storage.googleapis.com/chrome-for-testing-public/${browser_version}/linux64/chrome-linux64.zip"

if [[ -x "${executable}" ]]; then
  echo "Chrome for Testing ${browser_version} is already installed for Playwright Chromium revision ${browser_revision}."
  "${executable}" --version
  exit 0
fi

for command in curl unzip; do
  if ! command -v "${command}" >/dev/null 2>&1; then
    echo "Required command is not installed: ${command}" >&2
    exit 1
  fi
done

temporary_directory="$(mktemp -d)"
trap 'rm -rf "${temporary_directory}"' EXIT

echo "Installing Chrome for Testing ${browser_version} for Playwright Chromium revision ${browser_revision}."
echo "Downloading ${download_url}"
curl --fail --location --retry 2 --output "${temporary_directory}/chrome.zip" "${download_url}"
unzip -q "${temporary_directory}/chrome.zip" -d "${temporary_directory}/unpacked"

if [[ ! -x "${temporary_directory}/unpacked/chrome-linux64/chrome" ]]; then
  echo "Downloaded archive does not contain the expected Chrome executable." >&2
  exit 1
fi

mkdir -p "${install_root}"
rm -rf "${install_root}/chrome-linux64"
mv "${temporary_directory}/unpacked/chrome-linux64" "${install_root}/chrome-linux64"

if ldd "${executable}" 2>/dev/null | grep -q 'not found'; then
  echo "Installing the system libraries required by Playwright Chromium."
  npx playwright install-deps chromium
fi

if [[ ! -x "${executable}" ]]; then
  echo "Chrome executable was not installed successfully." >&2
  exit 1
fi

installed_version="$(${executable} --version)"
if [[ "${installed_version}" != *"${browser_version}"* ]]; then
  echo "Installed browser version does not match Playwright metadata: ${installed_version}" >&2
  exit 1
fi

echo "Installed ${installed_version}"
echo "Browser executable: ${executable}"
