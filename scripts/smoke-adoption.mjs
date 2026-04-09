import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);

function runCommand(command, args, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }

      rejectPromise(
        new Error(
          `Command failed (${code}): ${command} ${args.join(" ")}\n${stderr || stdout}`.trim()
        )
      );
    });
  });
}

async function main() {
  const tempDir = await mkdtemp(`${tmpdir()}/aic-smoke-`);
  const bootstrapPrompt = resolve(tempDir, "bootstrap-prompt.json");

  try {
    await runCommand("pnpm", ["aic", "--help"]);
    await runCommand("pnpm", ["--dir", "examples/nextjs-checkout-demo", "run", "aic:generate"]);
    await runCommand("pnpm", ["--dir", "examples/nextjs-checkout-demo", "run", "aic:doctor"]);
    await runCommand("pnpm", ["--dir", "examples/nextjs-checkout-demo", "run", "aic:inspect"]);
    await runCommand("pnpm", ["--dir", "examples/react-basic", "run", "aic:doctor"]);
    await runCommand("node", [
      "packages/cli/dist/cli/src/index.js",
      "bootstrap",
      "https://demo.example",
      "--app-name",
      "DemoBootstrap",
      "--captures-file",
      "examples/bootstrap-openai/captures/customers.json",
      "--prompt-file",
      bootstrapPrompt,
      "--print-prompt"
    ]);
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

void main();
