import { writeConfig, configExists, type RadzorConfig } from "../utils/config.js";
import { writeAgentRules } from "../utils/agent-rules.js";
import { writeMcpConfigs } from "../utils/mcp-config.js";
import { rebuildRegistry } from "../utils/project-registry.js";
import { info, warn, step } from "../utils/logger.js";

export async function initCommand(opts: { dir: string; rules?: boolean; mcp?: boolean }): Promise<void> {
  const skipRules = opts.rules === false;
  const skipMcp = opts.mcp === false;

  if (configExists()) {
    warn("radzor.json already exists. Skipping config.");
  } else {
    const config: RadzorConfig = {
      $schema: "https://radzor.io/schema/config",
      componentDir: opts.dir,
      registry: "https://radzor.io",
    };

    await writeConfig(config);
    info("Created radzor.json");
  }

  // Generate AI agent context files
  if (!skipRules) {
    await writeAgentRules(opts.dir);
  }

  // Configure MCP server for IDEs
  if (!skipMcp) {
    await writeMcpConfigs();
  }

  // Build project registry from installed components
  await rebuildRegistry(opts.dir);

  console.log("");
  step(`Components will be added to ${opts.dir}/`);
  step("Run `radzor add <component>` to get started");
}
