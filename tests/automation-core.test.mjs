import assert from "node:assert/strict";
import test from "node:test";

import { importWorkspaceModule } from "./helpers.mjs";

const automationCore = await importWorkspaceModule(
  "packages/automation-core/dist/automation-core/src/index.js"
);

test("scanSourceForAICAnnotations resolves same-file alias, object-member, helper, and label expressions", () => {
  const result = automationCore.scanSourceForAICAnnotations(
    `const metadata = {
  archive: {
    id: "customer.archive",
    risk: "high"
  },
  labels: {
    preview: "Preview customer"
  }
};
const archiveAlias = metadata.archive.id;
function getArchiveAction() {
  return "click";
}
const getArchiveDescription = () => "Archive customer";
const getPreviewLabel = () => metadata.labels.preview;

export function App() {
  return (
    <main>
      <button
        agentId={archiveAlias}
        agentAction={getArchiveAction()}
        agentDescription={getArchiveDescription()}
        agentRisk={metadata.archive.risk}
      >
        Archive customer
      </button>
      <button data-testid="preview">{getPreviewLabel()}</button>
    </main>
  );
}
`,
    "src/App.tsx"
  );

  assert.equal(result.diagnostics.length, 0);
  assert.deepEqual(result.matches, [
    {
      action: "click",
      agentDescription: "Archive customer",
      agentId: "customer.archive",
      column: 7,
      file: "src/App.tsx",
      line: 20,
      role: "button",
      risk: "high",
      source_key: "src/App.tsx:20:7:button",
      tagName: "button"
    }
  ]);
  assert.equal(result.source_inventory.length, 2);
  assert.equal(result.source_inventory[0].label, "Archive customer");
  assert.equal(result.source_inventory[1].label, "Preview customer");
  assert.equal(result.source_inventory[1].selectors?.testId, "preview");
});

test("scanSourceForAICAnnotations emits explicit deferred diagnostic codes for imports, unsupported members, helper args, and cycles", () => {
  const result = automationCore.scanSourceForAICAnnotations(
    `import { importedId } from "./external";

const computed = {
  ["badId"]: "customer.computed"
};

const helperWithArgs = (suffix) => \`customer.\${suffix}\`;
const loopA = loopB;
const loopB = loopA;

export function App() {
  return (
    <main>
      <button agentId={importedId}>Imported</button>
      <button agentId={computed.badId}>Computed</button>
      <button agentId={helperWithArgs("dynamic")}>Helper</button>
      <button agentId={loopA}>Cycle</button>
    </main>
  );
}
`,
    "src/App.tsx"
  );

  assert.equal(result.matches.length, 0);
  assert.equal(result.source_inventory.length, 4);
  assert.deepEqual(
    result.diagnostics.map((diagnostic) => diagnostic.code),
    [
      "unsupported_import_reference",
      "unsupported_member_expression",
      "unsupported_call_expression",
      "cyclic_static_reference"
    ]
  );
  assert.ok(result.diagnostics.every((diagnostic) => diagnostic.attribute === "agentId"));
});
