import assert from "node:assert/strict";
import test from "node:test";
import { access, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";

import { resolveFromRepo } from "./helpers.mjs";

const requiredFiles = [
  "LICENSE",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "CODE_OF_CONDUCT.md",
  "CHANGELOG.md",
  "docs/release-checklist.md",
  "docs/supported-today.md",
  ".github/ISSUE_TEMPLATE/bug_report.md",
  ".github/ISSUE_TEMPLATE/feature_request.md",
  ".github/pull_request_template.md"
];

test("public launch files exist and README points to the public entrypoints", async () => {
  await Promise.all(
    requiredFiles.map(async (relativePath) => {
      await access(resolveFromRepo(relativePath), fsConstants.R_OK);
    })
  );

  const readme = await readFile(resolveFromRepo("README.md"), "utf8");
  assert.match(readme, /Start Here/);
  assert.match(readme, /Repo Status/);
  assert.match(readme, /supported-today\.md/);
  assert.match(readme, /reference-consumer\.test\.mjs/);
});
