import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { info, error, step, heading } from "../utils/logger.js";

const VALID_CATEGORIES = [
  "audio", "auth", "payment", "chat", "data", "ui", "ai",
  "storage", "email", "analytics", "media", "networking", "security", "other",
];

export async function createCommand(
  name: string,
  opts: { category?: string; dir?: string }
): Promise<void> {
  heading(`Creating component: ${name}`);

  // Validate name format
  if (!/^@[a-z0-9-]+\/[a-z0-9-]+$/.test(name)) {
    error(`Name must be scoped: @scope/component-name (e.g. @radzor/my-component)`);
    process.exit(1);
  }

  const category = opts.category ?? "other";
  if (!VALID_CATEGORIES.includes(category)) {
    error(`Invalid category "${category}". Must be one of: ${VALID_CATEGORIES.join(", ")}`);
    process.exit(1);
  }

  const slug = name.replace(/^@[^/]+\//, "");
  const targetDir = opts.dir ?? slug;
  const fullPath = join(process.cwd(), targetDir);

  if (existsSync(fullPath)) {
    error(`Directory already exists: ${targetDir}/`);
    process.exit(1);
  }

  // Create directory structure
  await mkdir(join(fullPath, "src"), { recursive: true });
  await mkdir(join(fullPath, "llm"), { recursive: true });

  // Write manifest
  const manifest = {
    radzor: "1.0.0",
    name,
    version: "0.1.0",
    description: "TODO: Describe what this component does (10-500 chars).",
    languages: ["typescript"],
    category,
    tags: [],
    inputs: [
      {
        name: "exampleInput",
        type: "string",
        description: "TODO: Describe this input.",
        required: true,
      },
    ],
    outputs: [
      {
        name: "exampleOutput",
        type: "string",
        description: "TODO: Describe this output.",
      },
    ],
    events: [
      {
        name: "onReady",
        payload: { timestamp: "number" },
        description: "TODO: Fired when the component is ready.",
      },
      {
        name: "onError",
        payload: { code: "string", message: "string" },
        description: "Fired when an error occurs.",
      },
    ],
    actions: [
      {
        name: "init",
        params: [],
        returns: "Promise<void>",
        description: "TODO: Initialize the component.",
      },
    ],
    dependencies: {
      packages: {},
    },
    composability: {},
    llm: {
      integrationPrompt: "llm/integration.md",
      usageExamples: "llm/examples.md",
      constraints: "TODO: List runtime constraints (browser-only, requires API key, etc.).",
    },
  };

  await writeFile(
    join(fullPath, "radzor.manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n"
  );

  // Write source scaffold
  const className = slug
    .split("-")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join("");

  const sourceCode = `// ${name}

export interface ${className}Config {
  exampleInput: string;
}

type EventMap = {
  onReady: { timestamp: number };
  onError: { code: string; message: string };
};

type Listener<T> = (event: T) => void;

export class ${className} {
  private config: ${className}Config;
  private listeners: { [K in keyof EventMap]?: Listener<EventMap[K]>[] } = {};

  constructor(config: ${className}Config) {
    this.config = config;
  }

  on<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event]!.push(listener);
  }

  private emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const list = this.listeners[event];
    if (list) list.forEach((l) => l(payload));
  }

  async init(): Promise<void> {
    // TODO: Implement initialization logic
    this.emit("onReady", { timestamp: Date.now() });
  }
}

export default ${className};
`;

  await writeFile(join(fullPath, "src", "index.ts"), sourceCode);

  // Write LLM integration doc
  const integrationMd = `# How to integrate ${name}

## Overview
TODO: Describe what this component does and when to use it.

## Integration Steps

1. **Import the component:**
\`\`\`typescript
import { ${className} } from "${name}";
\`\`\`

2. **Create an instance:**
\`\`\`typescript
const instance = new ${className}({
  exampleInput: "value",
});
\`\`\`

3. **Listen for events:**
\`\`\`typescript
instance.on("onReady", ({ timestamp }) => {
  console.log("Ready at", timestamp);
});

instance.on("onError", ({ code, message }) => {
  console.error(\`Error [\${code}]: \${message}\`);
});
\`\`\`

4. **Call actions:**
\`\`\`typescript
await instance.init();
\`\`\`

## Important Constraints
TODO: List constraints (browser-only, requires API key, etc.)
`;

  await writeFile(join(fullPath, "llm", "integration.md"), integrationMd);

  // Write LLM examples doc
  const examplesMd = `# Usage examples for ${name}

## Basic usage
\`\`\`typescript
import { ${className} } from "${name}";

const instance = new ${className}({
  exampleInput: "value",
});

instance.on("onReady", () => console.log("Component ready"));
instance.on("onError", (err) => console.error(err));

await instance.init();
\`\`\`

## With error handling
\`\`\`typescript
try {
  await instance.init();
} catch (err) {
  console.error("Failed to initialize:", err);
}
\`\`\`
`;

  await writeFile(join(fullPath, "llm", "examples.md"), examplesMd);

  // Summary
  info(`Created component scaffold in ${targetDir}/`);
  console.log("");
  step(`${targetDir}/radzor.manifest.json`);
  step(`${targetDir}/src/index.ts`);
  step(`${targetDir}/llm/integration.md`);
  step(`${targetDir}/llm/examples.md`);
  console.log("");
  step("Next steps:");
  step("  1. Edit radzor.manifest.json — fill in description, inputs, outputs, actions, events");
  step("  2. Implement your component in src/index.ts");
  step("  3. Write LLM docs in llm/integration.md and llm/examples.md");
  step("  4. Run: radzor validate radzor.manifest.json");
  step("  5. Submit a PR to https://github.com/radzor-io/components");
}
