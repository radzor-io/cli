import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { info, step, warn } from "./logger.js";

interface McpConfigTarget {
  path: string;
  name: string;
  /** Build the full config JSON given the radzor MCP server entry. */
  build: (entry: McpServerEntry) => Record<string, unknown>;
}

interface McpServerEntry {
  command: string;
  args: string[];
}

const RADZOR_MCP: McpServerEntry = {
  command: "npx",
  args: ["-y", "@radzor/mcp"],
};

const MCP_TARGETS: McpConfigTarget[] = [
  {
    path: ".cursor/mcp.json",
    name: "Cursor",
    build: (entry) => ({ mcpServers: { radzor: entry } }),
  },
  {
    path: ".vscode/mcp.json",
    name: "VS Code (Copilot)",
    build: (entry) => ({ servers: { radzor: entry } }),
  },
];

/**
 * Write MCP config files for supported IDEs.
 * Skips files that already exist (user may have customised them).
 */
export async function writeMcpConfigs(): Promise<void> {
  step("Configuring MCP server for supported IDEs...");

  for (const target of MCP_TARGETS) {
    const filePath = join(process.cwd(), target.path);

    if (existsSync(filePath)) {
      // Check if radzor entry already exists
      try {
        const { readFile } = await import("node:fs/promises");
        const existing = JSON.parse(await readFile(filePath, "utf-8"));
        const servers =
          existing.mcpServers ?? existing.servers ?? {};
        if ("radzor" in servers) {
          step(`${target.path} already has radzor MCP config`);
          continue;
        }
        // File exists but no radzor entry — add it
        servers.radzor = RADZOR_MCP;
        if (existing.mcpServers) existing.mcpServers = servers;
        else if (existing.servers) existing.servers = servers;
        await writeFile(filePath, JSON.stringify(existing, null, 2) + "\n");
        info(`Added radzor to ${target.path} (${target.name})`);
      } catch {
        warn(`${target.path} exists but couldn't be updated — add radzor MCP config manually`);
      }
      continue;
    }

    // Create new file
    await mkdir(dirname(filePath), { recursive: true });
    const config = target.build(RADZOR_MCP);
    await writeFile(filePath, JSON.stringify(config, null, 2) + "\n");
    info(`Created ${target.path} (${target.name})`);
  }
}
