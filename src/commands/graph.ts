import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readConfig, configExists } from "../utils/config.js";
import { info, warn, error, step, heading } from "../utils/logger.js";

interface Connection {
  from: string;
  output: string;
  to: string;
  input: string;
  mapField?: string;
}

interface ComponentNode {
  slug: string;
  name: string;
  runtime: string;
  inputs: string[];
  outputs: string[];
}

export async function graphCommand(opts: { mermaid?: boolean }): Promise<void> {
  if (!configExists()) {
    error("No radzor.json found. Run `radzor init` first.");
    process.exit(1);
  }

  const config = await readConfig();
  const baseDir = join(process.cwd(), config.componentDir);

  if (!existsSync(baseDir)) {
    error(`Component directory "${config.componentDir}" not found.`);
    process.exit(1);
  }

  // Scan all installed manifests
  const entries = await readdir(baseDir, { withFileTypes: true });
  const nodes: Map<string, ComponentNode> = new Map();
  const manifests: Map<string, Record<string, any>> = new Map();

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = join(baseDir, entry.name, "radzor.manifest.json");
    if (!existsSync(manifestPath)) continue;

    try {
      const raw = await readFile(manifestPath, "utf-8");
      const manifest = JSON.parse(raw);
      const slug = entry.name;

      nodes.set(slug, {
        slug,
        name: manifest.name ?? `@radzor/${slug}`,
        runtime: manifest.runtime ?? "server",
        inputs: (manifest.inputs ?? []).map((i: { name: string }) => i.name),
        outputs: (manifest.outputs ?? []).map((o: { name: string }) => o.name),
      });
      manifests.set(slug, manifest);
    } catch {
      // Skip invalid manifests
    }
  }

  if (nodes.size === 0) {
    error("No components found. Run `radzor add <component>` first.");
    process.exit(1);
  }

  // Resolve connections between installed components
  const connections: Connection[] = [];
  const installedSlugs = new Set(nodes.keys());

  for (const [slug, manifest] of manifests) {
    const connectsTo = manifest.composability?.connectsTo ?? [];
    for (const conn of connectsTo) {
      const output = conn.output as string;
      const mapField = conn.mapField as string | undefined;
      const compatibleWith = (conn.compatibleWith ?? []) as string[];

      for (const ref of compatibleWith) {
        // Parse @radzor/component.action.method.param
        const match = ref.match(/@radzor\/([^.]+)\.(.+)/);
        if (!match) continue;
        const targetSlug = match[1];
        const targetInput = match[2];

        if (installedSlugs.has(targetSlug)) {
          connections.push({
            from: slug,
            output,
            to: targetSlug,
            input: targetInput,
            mapField,
          });
        }
      }
    }
  }

  if (opts.mermaid) {
    printMermaid(nodes, connections);
  } else {
    printText(nodes, connections);
  }
}

function printText(nodes: Map<string, ComponentNode>, connections: Connection[]): void {
  heading("Component Graph");

  // Print nodes
  const RUNTIME_BADGE: Record<string, string> = {
    browser: "\x1b[33m[browser]\x1b[0m",
    server: "\x1b[36m[server]\x1b[0m",
    universal: "\x1b[32m[universal]\x1b[0m",
  };

  for (const node of nodes.values()) {
    const badge = RUNTIME_BADGE[node.runtime] ?? `[${node.runtime}]`;
    console.log(`  ${badge} ${node.name}`);
  }

  console.log("");

  if (connections.length === 0) {
    step("No connections between installed components.");
    step("Install connected components to see the data flow.");
    return;
  }

  // Print connections as DAG
  heading("Data Flow");

  // Group by source
  const bySource = new Map<string, Connection[]>();
  for (const conn of connections) {
    const arr = bySource.get(conn.from) ?? [];
    arr.push(conn);
    bySource.set(conn.from, arr);
  }

  // Find roots (nodes that have outgoing edges but no incoming)
  const hasIncoming = new Set(connections.map((c) => c.to));
  const roots = [...bySource.keys()].filter((s) => !hasIncoming.has(s));
  if (roots.length === 0) roots.push([...bySource.keys()][0]);

  const visited = new Set<string>();

  function printNode(slug: string, depth: number): void {
    if (visited.has(slug)) return;
    visited.add(slug);

    const node = nodes.get(slug);
    if (!node) return;

    const conns = bySource.get(slug) ?? [];
    for (const conn of conns) {
      const indent = "  ".repeat(depth);
      const field = conn.mapField ? `\x1b[32m.${conn.mapField}\x1b[0m` : "";
      const arrow = `\x1b[2m──▶\x1b[0m`;
      console.log(`${indent}${node.name} \x1b[2m(${conn.output}${field})\x1b[0m ${arrow} ${nodes.get(conn.to)?.name ?? conn.to} \x1b[2m(${conn.input})\x1b[0m`);
      printNode(conn.to, depth + 1);
    }
  }

  for (const root of roots) {
    printNode(root, 1);
  }

  // Show orphans (no connections)
  const connected = new Set([...connections.map((c) => c.from), ...connections.map((c) => c.to)]);
  const orphans = [...nodes.keys()].filter((s) => !connected.has(s));
  if (orphans.length > 0) {
    console.log("");
    step(`Standalone: ${orphans.map((s) => nodes.get(s)?.name ?? s).join(", ")}`);
  }

  // Warn about cross-runtime connections
  const crossRuntime = connections.filter((c) => {
    const fromRuntime = nodes.get(c.from)?.runtime ?? "server";
    const toRuntime = nodes.get(c.to)?.runtime ?? "server";
    return fromRuntime !== toRuntime;
  });
  if (crossRuntime.length > 0) {
    console.log("");
    warn("Cross-runtime connections detected (need a bridge):");
    for (const conn of crossRuntime) {
      const fromNode = nodes.get(conn.from)!;
      const toNode = nodes.get(conn.to)!;
      step(`  ${fromNode.name} [${fromNode.runtime}] → ${toNode.name} [${toNode.runtime}]`);
    }
  }
}

function printMermaid(nodes: Map<string, ComponentNode>, connections: Connection[]): void {
  const lines: string[] = ["graph LR"];

  // Node definitions with runtime styling
  for (const node of nodes.values()) {
    const label = node.name.replace(/^@radzor\//, "");
    if (node.runtime === "browser") {
      lines.push(`  ${node.slug}[/"${label} 🌐"/]`);
    } else {
      lines.push(`  ${node.slug}["${label}"]`);
    }
  }

  // Edges
  for (const conn of connections) {
    const label = conn.mapField ? `${conn.output}.${conn.mapField}` : conn.output;
    lines.push(`  ${conn.from} -->|"${label}"| ${conn.to}`);
  }

  // Styling
  const browserNodes = [...nodes.values()].filter((n) => n.runtime === "browser").map((n) => n.slug);
  if (browserNodes.length > 0) {
    lines.push(`  style ${browserNodes.join(",")} fill:#ebcb8b,stroke:#d08770,color:#2e3440`);
  }
  const serverNodes = [...nodes.values()].filter((n) => n.runtime === "server").map((n) => n.slug);
  if (serverNodes.length > 0) {
    lines.push(`  style ${serverNodes.join(",")} fill:#88c0d0,stroke:#5e81ac,color:#2e3440`);
  }

  console.log(lines.join("\n"));
}
