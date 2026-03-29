import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = resolve(__dirname, "..");
const extensionRoot = resolve(packageRoot, "extension");
const distModule = pathToFileURL(resolve(packageRoot, "dist/devtools/src/index.js")).href;

const devtools = await import(distModule);
const shell = devtools.createAICDevtoolsExtensionShell();

await rm(extensionRoot, { force: true, recursive: true });
await mkdir(extensionRoot, { recursive: true });

await Promise.all(
  Object.entries(shell.files).map(async ([relativePath, contents]) => {
    const filePath = resolve(extensionRoot, relativePath);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, contents, "utf8");
  })
);

const writtenFiles = await readdir(extensionRoot);
if (writtenFiles.length === 0) {
  throw new Error("Extension asset sync produced no files.");
}
