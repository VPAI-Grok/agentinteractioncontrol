import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const repoRoot = resolve(__dirname, "..");

export async function importWorkspaceModule(relativePath) {
  return import(pathToFileURL(resolve(repoRoot, relativePath)).href);
}

export function resolveFromRepo(...segments) {
  return resolve(repoRoot, ...segments);
}

async function findWritableTempBase() {
  const candidates = [process.env.AIC_TEST_TMPDIR, tmpdir(), "/dev/shm"].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await access(candidate, fsConstants.W_OK);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error(
    `Unable to locate a writable temporary directory. Checked: ${candidates.join(", ")}`
  );
}

export async function createTempDir(prefix = "aic-test-") {
  const baseDir = await findWritableTempBase();
  return mkdtemp(resolve(baseDir, prefix));
}

export async function writeTextFile(filePath, contents) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, contents, "utf8");
}

export async function writeJsonFile(filePath, value) {
  await writeTextFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export async function readJsonFile(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function runNode(args, options = {}) {
  const { cwd = repoRoot, env = {} } = options;

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, args, {
      cwd,
      env: {
        ...process.env,
        ...env
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      resolvePromise({
        code: code ?? 1,
        stderr,
        stdout
      });
    });
  });
}

export async function runCli(args, options = {}) {
  return runNode([resolveFromRepo("packages/cli/dist/cli/src/index.js"), ...args], options);
}
