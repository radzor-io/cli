import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const CONFIG_FILE = "radzor.json";

export interface RadzorConfig {
  $schema: string;
  componentDir: string;
  registry: string;
}

const DEFAULT_CONFIG: RadzorConfig = {
  $schema: "https://radzor.io/schema/config",
  componentDir: "components/radzor",
  registry: "https://radzor.io",
};

export function getConfigPath(): string {
  return join(process.cwd(), CONFIG_FILE);
}

export function configExists(): boolean {
  return existsSync(getConfigPath());
}

export async function readConfig(): Promise<RadzorConfig> {
  if (!configExists()) {
    return DEFAULT_CONFIG;
  }

  const raw = await readFile(getConfigPath(), "utf-8");
  return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
}

export async function writeConfig(config: RadzorConfig): Promise<void> {
  await writeFile(getConfigPath(), JSON.stringify(config, null, 2) + "\n");
}
