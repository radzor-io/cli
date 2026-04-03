import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { info, warn, error, step, heading } from "../utils/logger.js";

const SCHEMA_URL =
  "https://raw.githubusercontent.com/radzor-io/spec/main/radzor-manifest.schema.json";

const VALID_CATEGORIES = [
  "audio", "auth", "payment", "chat", "data", "ui", "ai",
  "storage", "email", "analytics", "media", "networking", "security", "other",
];

interface Manifest {
  radzor?: string;
  name?: string;
  version?: string;
  description?: string;
  languages?: string[];
  category?: string;
  tags?: string[];
  inputs?: Array<{ name?: string; type?: string; description?: string }>;
  outputs?: Array<{ name?: string; type?: string; description?: string }>;
  events?: Array<{ name?: string; description?: string }>;
  actions?: Array<{ name?: string; description?: string }>;
  dependencies?: { packages?: Record<string, string> };
  composability?: { connectsTo?: Array<{ output?: string; compatibleWith?: string[] }> };
  llm?: { integrationPrompt?: string; usageExamples?: string; constraints?: string };
}

export async function validateCommand(path?: string): Promise<void> {
  let manifestPath = path ?? join(process.cwd(), "radzor.manifest.json");

  // If path is a directory, look for manifest inside it
  if (existsSync(manifestPath) && (await import("node:fs")).statSync(manifestPath).isDirectory()) {
    manifestPath = join(manifestPath, "radzor.manifest.json");
  }

  heading("Validating manifest");

  if (!existsSync(manifestPath)) {
    error(`File not found: ${manifestPath}`);
    process.exit(1);
  }

  let raw: string;
  let manifest: Manifest;

  try {
    raw = await readFile(manifestPath, "utf-8");
    manifest = JSON.parse(raw);
  } catch (err) {
    error(`Invalid JSON: ${(err as Error).message}`);
    process.exit(1);
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  // --- Required fields ---
  const required = ["radzor", "name", "version", "description", "languages", "category"] as const;
  for (const field of required) {
    if (!manifest[field]) {
      errors.push(`Missing required field: "${field}"`);
    }
  }

  // --- radzor version ---
  if (manifest.radzor && !/^\d+\.\d+\.\d+$/.test(manifest.radzor)) {
    errors.push(`"radzor" must be a semver string (e.g. "1.0.0"), got "${manifest.radzor}"`);
  }

  // --- name format ---
  if (manifest.name && !/^@[a-z0-9-]+\/[a-z0-9-]+$/.test(manifest.name)) {
    errors.push(`"name" must be scoped (e.g. @radzor/my-component), got "${manifest.name}"`);
  }

  // --- version format ---
  if (manifest.version && !/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(manifest.version)) {
    errors.push(`"version" must be semver (e.g. "0.1.0"), got "${manifest.version}"`);
  }

  // --- description length ---
  if (manifest.description) {
    if (manifest.description.length < 10) errors.push(`"description" too short (min 10 chars)`);
    if (manifest.description.length > 500) errors.push(`"description" too long (max 500 chars)`);
  }

  // --- languages ---
  if (manifest.languages && !Array.isArray(manifest.languages)) {
    errors.push(`"languages" must be an array`);
  } else if (manifest.languages && manifest.languages.length === 0) {
    errors.push(`"languages" must have at least one entry`);
  }

  // --- category ---
  if (manifest.category && !VALID_CATEGORIES.includes(manifest.category)) {
    errors.push(
      `"category" must be one of: ${VALID_CATEGORIES.join(", ")}. Got "${manifest.category}"`
    );
  }

  // --- tags ---
  if (manifest.tags) {
    if (manifest.tags.length > 10) warnings.push(`"tags" has ${manifest.tags.length} items (max recommended: 10)`);
    for (const tag of manifest.tags) {
      if (tag.length > 30) warnings.push(`Tag "${tag}" exceeds 30 chars`);
    }
  }

  // --- inputs/outputs ---
  for (const section of ["inputs", "outputs"] as const) {
    const items = manifest[section];
    if (items && Array.isArray(items)) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.name) errors.push(`${section}[${i}]: missing "name"`);
        if (!item.type) errors.push(`${section}[${i}]: missing "type"`);
        if (!item.description) errors.push(`${section}[${i}]: missing "description"`);
        if (item.name && !/^[a-zA-Z][a-zA-Z0-9]*$/.test(item.name)) {
          errors.push(`${section}[${i}].name "${item.name}" must be camelCase`);
        }
      }
    }
  }

  // --- events ---
  if (manifest.events && Array.isArray(manifest.events)) {
    for (let i = 0; i < manifest.events.length; i++) {
      const ev = manifest.events[i];
      if (!ev.name) errors.push(`events[${i}]: missing "name"`);
      if (!ev.description) errors.push(`events[${i}]: missing "description"`);
      if (ev.name && !/^on[A-Z][a-zA-Z]*$/.test(ev.name)) {
        errors.push(`events[${i}].name "${ev.name}" must start with "on" + PascalCase (e.g. onSpeechStart)`);
      }
    }
  }

  // --- actions ---
  if (manifest.actions && Array.isArray(manifest.actions)) {
    for (let i = 0; i < manifest.actions.length; i++) {
      const act = manifest.actions[i];
      if (!act.name) errors.push(`actions[${i}]: missing "name"`);
      if (!act.description) errors.push(`actions[${i}]: missing "description"`);
      if (act.name && !/^[a-z][a-zA-Z0-9]*$/.test(act.name)) {
        errors.push(`actions[${i}].name "${act.name}" must be camelCase`);
      }
    }
  }

  // --- llm docs existence ---
  const dir = manifestPath.replace(/\/[^/]+$/, "");
  if (manifest.llm?.integrationPrompt) {
    const llmPath = join(dir, manifest.llm.integrationPrompt);
    if (!existsSync(llmPath)) {
      errors.push(`llm.integrationPrompt points to "${manifest.llm.integrationPrompt}" but file not found`);
    }
  } else {
    warnings.push(`No llm.integrationPrompt — LLMs will have less context for integration`);
  }

  if (manifest.llm?.usageExamples) {
    const llmPath = join(dir, manifest.llm.usageExamples);
    if (!existsSync(llmPath)) {
      errors.push(`llm.usageExamples points to "${manifest.llm.usageExamples}" but file not found`);
    }
  } else {
    warnings.push(`No llm.usageExamples — LLMs will have fewer integration examples`);
  }

  // --- source file existence ---
  const srcDir = join(dir, "src");
  if (!existsSync(srcDir)) {
    errors.push(`No src/ directory found next to manifest`);
  } else {
    const indexTs = join(srcDir, "index.ts");
    const indexJs = join(srcDir, "index.js");
    if (!existsSync(indexTs) && !existsSync(indexJs)) {
      errors.push(`No src/index.ts or src/index.js found`);
    }
  }

  // --- Report ---
  if (warnings.length > 0) {
    for (const w of warnings) warn(w);
    console.log("");
  }

  if (errors.length > 0) {
    for (const e of errors) error(e);
    console.log("");
    error(`${errors.length} error${errors.length > 1 ? "s" : ""} found. Fix them before publishing.`);
    process.exit(1);
  }

  info(`${manifestPath}`);
  info(`${manifest.name}@${manifest.version} — valid ✓`);
  step(`Category: ${manifest.category}`);
  step(`Languages: ${manifest.languages?.join(", ")}`);
  step(`Inputs: ${manifest.inputs?.length ?? 0} | Outputs: ${manifest.outputs?.length ?? 0}`);
  step(`Actions: ${manifest.actions?.length ?? 0} | Events: ${manifest.events?.length ?? 0}`);
  if (manifest.llm?.integrationPrompt) step(`LLM docs: ✓`);
}
