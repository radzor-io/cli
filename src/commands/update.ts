import { existsSync } from "node:fs";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { addCommand } from "./add.js";
import { readConfig } from "../utils/config.js";
import { fetchComponentFiles } from "../utils/registry.js";
import { error, heading, info, warn, step } from "../utils/logger.js";

export async function updateCommand(component: string, opts: { dir?: string, deps?: boolean }) {
  const config = await readConfig().catch(() => ({ componentDir: opts.dir ?? "components/radzor" }));
  const targetDir = opts.dir ?? config.componentDir;
  const componentDir = join(process.cwd(), targetDir, component);

  if (!existsSync(componentDir)) {
    error(`Component "${component}" is not currently installed in ${targetDir}.`);
    console.log(`To install it for the first time, run: radzor add ${component}`);
    process.exit(1);
  }

  heading(`Updating ${component}`);

  // Check for local changes first
  step("Checking for local modifications...");
  let hasLocalChanges = false;
  try {
    const remoteFiles = await fetchComponentFiles(component);
    for (const remoteFile of remoteFiles) {
      const localPath = join(componentDir, remoteFile.path);
      if (existsSync(localPath)) {
        const localContent = await readFile(localPath, "utf-8");
        if (localContent !== remoteFile.content) {
          hasLocalChanges = true;
          break;
        }
      }
    }
  } catch (err) {
    warn(`Could not verify local changes: ${(err as Error).message}`);
  }

  if (hasLocalChanges) {
    warn(`You have local modifications in "${component}".`);
    warn(`Updating will OVERWRITE your local changes.`);
    // Since we can't easily prompt interactively in commander without inquiring library,
    // we'll just log it. Maybe require a --force flag? 
    // Let's just proceed for now as `radzor update` is explicit, but the warning is good.
    step("Proceeding with update in 3 seconds... (Press Ctrl+C to abort)");
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  
  // Actually update is just add but we've verified it exists
  await addCommand([component], { dir: opts.dir, deps: opts.deps });

  info(`Component "${component}" has been updated to the latest version.`);
}
