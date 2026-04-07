import { readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { info, step } from "./logger.js";

export const REGISTRY_FILENAME = "radzor.registry.json";

interface InstalledComponent {
  slug: string;
  name: string;
  version: string;
  category: string;
  description: string;
  path: string;
  composability?: {
    connectsTo?: Array<{ output: string; compatibleWith: string[] }>;
  };
}

interface ProjectRegistry {
  $schema: string;
  updatedAt: string;
  components: InstalledComponent[];
}

function emptyRegistry(): ProjectRegistry {
  return {
    $schema: "https://radzor.io/schema/registry",
    updatedAt: new Date().toISOString(),
    components: [],
  };
}

export async function readProjectRegistry(): Promise<ProjectRegistry> {
  const filePath = join(process.cwd(), REGISTRY_FILENAME);
  if (!existsSync(filePath)) return emptyRegistry();
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as ProjectRegistry;
  } catch {
    return emptyRegistry();
  }
}

export async function writeProjectRegistry(
  registry: ProjectRegistry
): Promise<void> {
  registry.updatedAt = new Date().toISOString();
  const filePath = join(process.cwd(), REGISTRY_FILENAME);
  await writeFile(filePath, JSON.stringify(registry, null, 2) + "\n");
}

export async function scanInstalledComponents(
  componentDir: string
): Promise<InstalledComponent[]> {
  const baseDir = join(process.cwd(), componentDir);
  if (!existsSync(baseDir)) return [];

  const entries = await readdir(baseDir, { withFileTypes: true });
  const components: InstalledComponent[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const manifestPath = join(baseDir, entry.name, "radzor.manifest.json");
    if (!existsSync(manifestPath)) continue;

    try {
      const raw = await readFile(manifestPath, "utf-8");
      const manifest = JSON.parse(raw);
      components.push({
        slug: entry.name,
        name: manifest.name ?? `@radzor/${entry.name}`,
        version: manifest.version ?? "0.0.0",
        category: manifest.category ?? "other",
        description: manifest.description ?? "",
        path: `${componentDir}/${entry.name}`,
        ...(manifest.composability ? { composability: manifest.composability } : {}),
      });
    } catch {
      // Skip invalid manifests
    }
  }

  return components.sort((a, b) => a.slug.localeCompare(b.slug));
}

export async function addToRegistry(
  manifest: { name?: string; version?: string; category?: string; description?: string; composability?: unknown },
  componentDir: string,
  slug: string
): Promise<void> {
  const registry = await readProjectRegistry();

  const entry: InstalledComponent = {
    slug,
    name: manifest.name ?? `@radzor/${slug}`,
    version: manifest.version ?? "0.0.0",
    category: manifest.category ?? "other",
    description: manifest.description ?? "",
    path: `${componentDir}/${slug}`,
    ...(manifest.composability ? { composability: manifest.composability as InstalledComponent["composability"] } : {}),
  };

  const existingIdx = registry.components.findIndex((c) => c.slug === slug);
  if (existingIdx !== -1) {
    registry.components[existingIdx] = entry;
  } else {
    registry.components.push(entry);
    registry.components.sort((a, b) => a.slug.localeCompare(b.slug));
  }

  await writeProjectRegistry(registry);
}

export async function rebuildRegistry(componentDir: string): Promise<void> {
  const components = await scanInstalledComponents(componentDir);
  const registry: ProjectRegistry = {
    $schema: "https://radzor.io/schema/registry",
    updatedAt: new Date().toISOString(),
    components,
  };
  await writeProjectRegistry(registry);

  if (components.length > 0) {
    info(`Registry: ${components.length} component${components.length > 1 ? "s" : ""} found`);
    for (const c of components) {
      step(`  ${c.name}@${c.version}`);
    }
  } else {
    step("Registry created (no components installed yet)");
  }
}
