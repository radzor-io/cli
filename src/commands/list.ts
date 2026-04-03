import { listComponents } from "../utils/registry.js";
import { error, heading } from "../utils/logger.js";

export async function listCommand(): Promise<void> {
  heading("Available components");

  try {
    const components = await listComponents();

    if (!Array.isArray(components) || components.length === 0) {
      console.log("  No components found.");
      return;
    }

    // Find max name length for alignment
    const maxName = Math.max(...components.map((c) => (c.slug ?? c.name).length));

    for (const c of components) {
      const name = (c.slug ?? c.name).padEnd(maxName + 2);
      const version = `v${c.latestVersion ?? c.version ?? "?"}`.padEnd(8);
      const category = `[${c.category}]`.padEnd(12);
      console.log(`  ${name} ${version} ${category} ${c.description}`);
    }

    console.log("");
    console.log(`  ${components.length} components available`);
    console.log(`  Run \`radzor add <name>\` to add one to your project`);
    console.log("");
  } catch (err) {
    error(`Failed to fetch component list: ${(err as Error).message}`);
    process.exit(1);
  }
}
