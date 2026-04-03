import { writeConfig, configExists, type RadzorConfig } from "../utils/config.js";
import { info, warn, step } from "../utils/logger.js";

export async function initCommand(opts: { dir: string }): Promise<void> {
  if (configExists()) {
    warn("radzor.json already exists. Skipping init.");
    return;
  }

  const config: RadzorConfig = {
    $schema: "https://radzor.io/schema/config",
    componentDir: opts.dir,
    registry: "https://radzor.io",
  };

  await writeConfig(config);

  info("Created radzor.json");
  step(`Components will be added to ${opts.dir}/`);
  step("Run `radzor add <component>` to get started");
}
