# radzor

The CLI for the **Radzor Platform**. 

Radzor is like *shadcn/ui*, but for **backend logic, APIs, and AI integrations**. It downloads high-quality, fully-typed code directly into your project, accompanied by a `radzor.manifest.json` designed specifically to help your AI agents (Claude, Copilot, Cursor) integrate the code flawlessly.

## Usage

```bash
# List available components
npx radzor@latest list

# Add a component to your project
npx radzor@latest add audio-capture

# Scaffold a full AI Workflow (Recipe)
npx radzor@latest recipe add voice-bot
```

## What happens when you run `radzor add`

1. Fetches the component source from the [Radzor registry](https://radzor.io)
2. Copies the source code into your project (default: `components/radzor/<name>/`)
3. Includes the `radzor.manifest.json` and LLM documentation (`llm/integration.md`)
4. Installs npm dependencies declared in the manifest
5. Auto-updates your `.env` file with required API keys

The code is **local, modifiable, and readable by your LLM**. No black-box packages.

## Commands

### `radzor add <component>`
Downloads a component and adds it to your project.
- `--no-deps`: Skip installing npm dependencies
- `-d, --dir <path>`: Override target directory

### `radzor recipe add <slug>`
Scaffolds a complete AI workflow by installing multiple components and generating the "wiring" code to connect them.

### `radzor diff <component>`
Shows the differences between your local component code and the latest version in the Radzor registry. Perfect for tracking updates while keeping your local modifications safe.

### `radzor update <component>`
Overwrites your local component with the latest version from the registry.

### `radzor list`
Lists all available components from the registry.

### `radzor validate [path]`
Validates a `radzor.manifest.json` against the official Radzor Component Spec (RCS) schema. Use this before submitting a new component to the registry.

### `radzor create <name>`
Scaffolds a new component boilerplate with a valid manifest, source directory, and LLM docs template.

## License

MIT
