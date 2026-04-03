import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { execSync } from "node:child_process";
import { readConfig, configExists, writeConfig } from "../utils/config.js";
import { fetchManifest, fetchComponentFiles } from "../utils/registry.js";
import { info, warn, error, step, heading } from "../utils/logger.js";

export async function addCommand(
  component: string,
  opts: { dir?: string; deps?: boolean }
): Promise<void> {
  const installDeps = opts.deps !== false;

  // Auto-init if no config
  if (!configExists()) {
    await writeConfig({
      $schema: "https://radzor.io/schema/config",
      componentDir: opts.dir ?? "components/radzor",
      registry: "https://radzor.io",
    });
    step("Auto-created radzor.json");
  }

  const config = await readConfig();
  const targetDir = opts.dir ?? config.componentDir;
  const componentDir = join(process.cwd(), targetDir, component);

  heading(`Adding ${component}`);

  // 1. Fetch manifest
  step("Fetching manifest...");
  let manifest;
  try {
    manifest = await fetchManifest(component);
  } catch {
    error(`Component "${component}" not found in the registry.`);
    step("Run `radzor list` to see available components.");
    process.exit(1);
  }

  info(`${manifest.name}@${manifest.version} — ${manifest.description}`);

  // 2. Fetch source files
  step("Downloading source files...");
  let files;
  try {
    files = await fetchComponentFiles(component);
  } catch (err) {
    error(`Failed to download component files: ${(err as Error).message}`);
    process.exit(1);
  }

  if (files.length === 0) {
    error("No source files found for this component.");
    process.exit(1);
  }

  // 3. Write files to target directory
  if (existsSync(componentDir)) {
    warn(`${targetDir}/${component}/ already exists. Files will be overwritten.`);
  }

  for (const file of files) {
    const filePath = join(componentDir, file.path);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, file.content);
    step(`  ${targetDir}/${component}/${file.path}`);
  }

  // 4. Write manifest
  const manifestPath = join(componentDir, "radzor.manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  step(`  ${targetDir}/${component}/radzor.manifest.json`);

  info(`Wrote ${files.length + 1} files to ${targetDir}/${component}/`);

  // 5. Install dependencies
  const packages = manifest.dependencies?.packages;
  if (installDeps && packages && Object.keys(packages).length > 0) {
    const deps = Object.entries(packages)
      .map(([name, version]) => `${name}@${version}`)
      .join(" ");

    step(`Installing dependencies: ${deps}`);

    try {
      const packageManager = detectPackageManager();
      const installCmd =
        packageManager === "yarn"
          ? `yarn add ${deps}`
          : packageManager === "pnpm"
            ? `pnpm add ${deps}`
            : `npm install ${deps}`;

      execSync(installCmd, { stdio: "inherit" });
      info("Dependencies installed");
    } catch {
      warn("Failed to install dependencies. Install them manually:");
      step(`  npm install ${deps}`);
    }
  }

  // 6. Summary
  console.log("");
  info(`Done! Component added to ${targetDir}/${component}/`);
  step(`Import with: import { ${getMainExport(manifest.name)} } from "./${targetDir}/${component}/src/index.js"`);
}

function detectPackageManager(): "npm" | "yarn" | "pnpm" {
  if (existsSync(join(process.cwd(), "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(process.cwd(), "yarn.lock"))) return "yarn";
  return "npm";
}

function getMainExport(name: string): string {
  // @radzor/audio-capture → AudioCapture
  const short = name.replace(/^@radzor\//, "");
  return short
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}
