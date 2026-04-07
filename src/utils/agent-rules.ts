import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { info, step } from "./logger.js";

const START_MARKER = "<!-- radzor:start -->";
const END_MARKER = "<!-- radzor:end -->";

function generateRulesContent(componentDir: string): string {
  return `
# Radzor Components

This project uses [Radzor](https://radzor.io) components — AI-ready building blocks with machine-readable manifests.

## Component Discovery

- Installed components live in \`${componentDir}/*/\`
- Each component has a \`radzor.manifest.json\` describing its full API (inputs, outputs, events, actions)
- Each component has \`llm/integration.md\` with step-by-step integration instructions
- Each component has \`llm/examples.md\` with copy-paste usage examples
- The project-wide registry is in \`radzor.registry.json\` at the project root

## Rules

- ALWAYS read \`radzor.manifest.json\` before using or modifying a Radzor component
- Read \`llm/integration.md\` for the recommended integration pattern
- Respect the \`composability.connectsTo\` field when wiring components together
- Use the types defined in \`outputs\` and \`inputs\` — do not invent custom interfaces
- Event names follow the pattern \`onEventName\` — do not rename them
- When the user asks to add a new component, run \`npx radzor add <name>\`
- Browse available components at https://radzor.io/components or run \`npx radzor list\`
`.trim();
}

interface AgentFile {
  path: string;
  name: string;
  wrapInMarkers: boolean;
}

const AGENT_FILES: AgentFile[] = [
  { path: "CLAUDE.md", name: "Claude Code", wrapInMarkers: true },
  { path: ".cursorrules", name: "Cursor", wrapInMarkers: true },
  { path: ".windsurfrules", name: "Windsurf", wrapInMarkers: true },
  { path: ".github/copilot-instructions.md", name: "GitHub Copilot", wrapInMarkers: true },
  { path: ".clinerules", name: "Cline", wrapInMarkers: true },
];

async function writeOrAppend(
  filePath: string,
  content: string,
  wrapInMarkers: boolean
): Promise<"created" | "updated" | "unchanged"> {
  const markedContent = wrapInMarkers
    ? `${START_MARKER}\n${content}\n${END_MARKER}`
    : content;

  await mkdir(dirname(filePath), { recursive: true });

  if (!existsSync(filePath)) {
    await writeFile(filePath, markedContent + "\n");
    return "created";
  }

  const existing = await readFile(filePath, "utf-8");

  // Replace existing Radzor section
  const startIdx = existing.indexOf(START_MARKER);
  const endIdx = existing.indexOf(END_MARKER);

  if (startIdx !== -1 && endIdx !== -1) {
    const before = existing.slice(0, startIdx);
    const after = existing.slice(endIdx + END_MARKER.length);
    const updated = before + markedContent + after;
    if (updated === existing) return "unchanged";
    await writeFile(filePath, updated);
    return "updated";
  }

  // Append to existing file
  const separator = existing.endsWith("\n") ? "\n" : "\n\n";
  await writeFile(filePath, existing + separator + markedContent + "\n");
  return "updated";
}

export async function writeAgentRules(componentDir: string): Promise<void> {
  const content = generateRulesContent(componentDir);
  const cwd = process.cwd();

  step("Generating AI agent context files...");

  for (const agent of AGENT_FILES) {
    const filePath = join(cwd, agent.path);
    const result = await writeOrAppend(filePath, content, agent.wrapInMarkers);

    if (result === "created") {
      info(`Created ${agent.path} (${agent.name})`);
    } else if (result === "updated") {
      info(`Updated Radzor section in ${agent.path} (${agent.name})`);
    } else {
      step(`${agent.path} already up to date`);
    }
  }
}
