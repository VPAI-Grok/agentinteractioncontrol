import { resolve } from "node:path";

import { updateGoldenProjectFixtures, verifyGoldenProjectFixtures } from "./golden-artifacts.mjs";

function printUsage() {
  console.error(`Usage:
  node tests/goldens.mjs verify [--actual-dir <dir>]
  node tests/goldens.mjs update`);
}

function readOptionValue(args, optionName) {
  const prefixed = `${optionName}=`;
  const inlineMatch = args.find((arg) => arg.startsWith(prefixed));

  if (inlineMatch) {
    return inlineMatch.slice(prefixed.length);
  }

  const optionIndex = args.indexOf(optionName);
  return optionIndex >= 0 ? args[optionIndex + 1] : undefined;
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (command === "update") {
    await updateGoldenProjectFixtures();
    console.log("Updated golden project fixtures.");
    return;
  }

  if (command === "verify") {
    const actualDir = readOptionValue(args, "--actual-dir");
    const result = await verifyGoldenProjectFixtures({
      actualDir: actualDir ? resolve(process.cwd(), actualDir) : undefined
    });

    if (!result.ok) {
      result.results
        .filter((fixture) => fixture.mismatches.length > 0)
        .forEach((fixture) => {
          console.error(`${fixture.name} golden drift detected:`);
          fixture.mismatches.forEach((mismatch) => {
            console.error(`- ${mismatch.reason}: ${mismatch.path}`);
          });
        });
      process.exitCode = 1;
      return;
    }

    console.log("Golden project fixtures are up to date.");
    return;
  }

  printUsage();
  process.exitCode = 1;
}

void main();
