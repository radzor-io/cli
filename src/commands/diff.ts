import { existsSync } from "node:fs";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import * as diff from "diff";
import { readConfig } from "../utils/config.js";
import { fetchComponentFiles } from "../utils/registry.js";
import { error, heading, info, step, warn } from "../utils/logger.js";

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";

export async function diffCommand(component: string, opts: { dir?: string }) {
  const config = await readConfig().catch(() => ({ componentDir: opts.dir ?? "components/radzor" }));
  const targetDir = opts.dir ?? config.componentDir;
  const componentDir = join(process.cwd(), targetDir, component);

  if (!existsSync(componentDir)) {
    error(`Component "${component}" is not installed in ${targetDir}.`);
    process.exit(1);
  }

  heading(`Diffing ${component}`);
  step("Fetching latest source files from registry...");

  let remoteFiles;
  try {
    remoteFiles = await fetchComponentFiles(component);
  } catch (err) {
    error(`Failed to download latest files: ${(err as Error).message}`);
    process.exit(1);
  }

  let hasChanges = false;

  for (const remoteFile of remoteFiles) {
    const localPath = join(componentDir, remoteFile.path);
    if (!existsSync(localPath)) {
      console.log(`\n📄 ${remoteFile.path}`);
      console.log(`${GREEN}+++ File is missing locally (added in remote)${RESET}`);
      hasChanges = true;
      continue;
    }

    const localContent = await readFile(localPath, "utf-8");
    const remoteContent = remoteFile.content;

    // Fast check
    if (localContent === remoteContent) {
      continue;
    }

    // If diff, print patch
    const patch = diff.createTwoFilesPatch(
      remoteFile.path + " (registry)",
      remoteFile.path + " (local)",
      remoteContent,
      localContent
    );

    console.log(`\n📄 ${remoteFile.path}`);
    hasChanges = true;

    // Colorize the diff output
    const lines = patch.split("\n");
    for (const line of lines.slice(4)) { // skip diff header
      if (line.startsWith("+")) {
        console.log(`${GREEN}${line}${RESET}`);
      } else if (line.startsWith("-")) {
        console.log(`${RED}${line}${RESET}`);
      } else {
        console.log(line);
      }
    }
  }

  if (!hasChanges) {
    console.log("");
    info("Component is fully up to date! No differences found.");
  } else {
    console.log("");
    warn("There are differences between your local component and the registry.");
    step(`Run \`radzor update ${component}\` to overwrite your local files with the latest version.`);
  }
}
