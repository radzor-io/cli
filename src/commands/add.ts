import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { execSync } from "node:child_process";
import { readConfig, configExists, writeConfig } from "../utils/config.js";
import { fetchManifest, fetchComponentFiles } from "../utils/registry.js";
import { addToRegistry } from "../utils/project-registry.js";
import { info, warn, error, step, heading } from "../utils/logger.js";

export async function addCommand(
  components: string[],
  opts: { dir?: string; deps?: boolean }
): Promise<void> {
  const installDeps = opts.deps !== false;
  const manifests: Array<Record<string, any>> = [];

  for (const component of components) {
    const manifest = await addSingleComponent(component, opts.dir, installDeps);
    if (manifest) manifests.push(manifest);
  }

  // Post-install checks
  await checkTsConfig(opts.dir);
  checkRuntimeMix(manifests);
  await checkModuleFormat();
}

async function addSingleComponent(
  component: string,
  dirOverride: string | undefined,
  installDeps: boolean
): Promise<Record<string, any> | null> {

  // Auto-init if no config
  if (!configExists()) {
    await writeConfig({
      $schema: "https://radzor.io/schema/config",
      componentDir: dirOverride ?? "components/radzor",
      registry: "https://radzor.io",
    });
    step("Auto-created radzor.json");
  }

  const config = await readConfig();
  const targetDir = dirOverride ?? config.componentDir;
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

  // 5. Update project registry
  await addToRegistry(manifest, targetDir, component);

  // 6. Install dependencies
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

  // 7. Summary
  console.log("");
  info(`Done! Component added to ${targetDir}/${component}/`);
  step(`Import with: import { ${getMainExport(manifest.name)} } from "./${targetDir}/${component}/src/index.js"`);

  // 8. Show required env vars from constraints
  const constraints = manifest.llm?.constraints ?? "";
  const envVarPattern = /[A-Z][A-Z0-9_]{2,}_(?:KEY|SECRET|TOKEN|URL|ID|PASSWORD|CREDENTIALS)/g;
  const envVars = constraints.match(envVarPattern);
  if (envVars && envVars.length > 0) {
    step("Required environment variables:");
    for (const v of [...new Set(envVars)]) {
      step(`  ${v}=...`);
    }
  }

  // 9. Suggest connected components
  const connections = manifest.composability?.connectsTo ?? [];
  if (connections.length > 0) {
    const targets = connections
      .flatMap((c: Record<string, unknown>) => (c.compatibleWith as string[]) ?? [])
      .map((ref: string) => ref.match(/@radzor\/([^.]+)/)?.[1])
      .filter((s: string | undefined): s is string => !!s);
    const unique = [...new Set(targets)];
    if (unique.length > 0) {
      step(`Connects to: ${unique.map((s) => `@radzor/${s}`).join(", ")}`);
    }
  }

  return manifest;
}

function detectPackageManager(): "npm" | "yarn" | "pnpm" {
  if (existsSync(join(process.cwd(), "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(process.cwd(), "yarn.lock"))) return "yarn";
  return "npm";
}

const ACRONYMS = new Set(["llm", "api", "csv", "http", "ocr", "pdf", "qr", "sms", "tts", "stt", "ws"]);

function getMainExport(name: string): string {
  // @radzor/audio-capture → AudioCapture
  // @radzor/llm-completion → LLMCompletion
  const short = name.replace(/^@radzor\//, "");
  return short
    .split("-")
    .map((w) => ACRONYMS.has(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

async function checkTsConfig(dirOverride?: string): Promise<void> {
  const tsconfigPath = join(process.cwd(), "tsconfig.json");
  if (!existsSync(tsconfigPath)) return;

  try {
    // Strip single-line comments for JSON.parse
    const raw = await readFile(tsconfigPath, "utf8");
    const stripped = raw.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    const tsconfig = JSON.parse(stripped);
    const opts = tsconfig.compilerOptions ?? {};
    const componentDir = dirOverride ?? "components/radzor";

    // Check rootDir conflict
    if (opts.rootDir && opts.rootDir !== ".") {
      const isUnder = componentDir.startsWith(opts.rootDir);
      if (!isUnder) {
        console.log("");
        warn("tsconfig.json has rootDir set to \"" + opts.rootDir + "\" but components are in \"" + componentDir + "/\".");
        step("This will cause TS6059 errors. Fix options:");
        step("  1. Set \"rootDir\": \".\" in tsconfig.json");
        step("  2. Add \"" + componentDir + "\" to the \"include\" array and adjust rootDir");
        step("  3. Use a path alias: \"paths\": { \"@radzor/*\": [\"" + componentDir + "/*/src/index.ts\"] }");
      }
    }

    // Check if components dir is excluded
    const exclude: string[] = tsconfig.exclude ?? [];
    const isExcluded = exclude.some(
      (p: string) => componentDir.startsWith(p) || p === componentDir
    );
    if (isExcluded) {
      console.log("");
      warn("\"" + componentDir + "/\" is in tsconfig.json \"exclude\". Components won't compile.");
      step("Remove it from \"exclude\" or use path aliases to import compiled outputs.");
    }
  } catch {
    // tsconfig parse failed — not our problem
  }
}

function checkRuntimeMix(manifests: Array<Record<string, any>>): void {
  const runtimes = new Set(manifests.map((m) => m.runtime ?? "server"));
  if (runtimes.has("browser") && runtimes.has("server")) {
    const browserComps = manifests.filter((m) => m.runtime === "browser").map((m) => m.name);
    const serverComps = manifests.filter((m) => (m.runtime ?? "server") === "server").map((m) => m.name);
    console.log("");
    warn("You're mixing browser and server components:");
    step(`  Browser: ${browserComps.join(", ")}`);
    step(`  Server:  ${serverComps.join(", ")}`);
    step("These cannot run in the same process. You'll need an HTTP or WebSocket bridge.");
    step("See the integration.md of your browser component for bridge patterns.");
  }
}

async function checkModuleFormat(): Promise<void> {
  const pkgPath = join(process.cwd(), "package.json");
  if (!existsSync(pkgPath)) return;

  try {
    const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
    const isESM = pkg.type === "module";

    // Check tsconfig module setting if it exists
    const tsconfigPath = join(process.cwd(), "tsconfig.json");
    if (!existsSync(tsconfigPath)) return;

    const raw = await readFile(tsconfigPath, "utf8");
    const stripped = raw.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    const tsconfig = JSON.parse(stripped);
    const moduleOpt = (tsconfig.compilerOptions?.module ?? "").toLowerCase();

    if (isESM && moduleOpt && (moduleOpt === "commonjs" || moduleOpt === "commonjs2")) {
      console.log("");
      warn("package.json has \"type\": \"module\" (ESM) but tsconfig.json uses \"module\": \"" + tsconfig.compilerOptions.module + "\" (CJS).");
      step("This will cause 'exports is not defined' at runtime. Fix options:");
      step("  1. Set \"module\": \"nodenext\" in tsconfig.json compilerOptions");
      step("  2. Or remove \"type\": \"module\" from package.json");
    }

    if (!isESM && moduleOpt && (moduleOpt.includes("nodenext") || moduleOpt.includes("esnext") || moduleOpt === "es2022")) {
      console.log("");
      warn("tsconfig.json uses ESM module format (\"" + tsconfig.compilerOptions.module + "\") but package.json has no \"type\": \"module\".");
      step("Node.js will treat .js files as CJS. Fix options:");
      step("  1. Add \"type\": \"module\" to package.json");
      step("  2. Or set \"module\": \"commonjs\" in tsconfig.json");
    }
  } catch {
    // parse failed — skip
  }
}
