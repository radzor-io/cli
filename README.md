# radzor

CLI to add AI-ready components to your project. Like shadcn/ui, but for any component with a [Radzor manifest](https://github.com/radzor-io/spec).

## Usage

```bash
# List available components
npx radzor list

# Add a component to your project
npx radzor add audio-capture

# Initialize with custom directory
npx radzor init --dir src/components/radzor
```

## What happens when you run `radzor add`

1. Fetches the component source from the [Radzor registry](https://radzor.io)
2. Copies the source code into your project (default: `components/radzor/<name>/`)
3. Includes the `radzor.manifest.json` — so your LLM can read it
4. Installs npm dependencies declared in the manifest

The code is **local, modifiable, and readable by your LLM**. No black-box packages.

## Commands

### `radzor init`
Creates a `radzor.json` config file in your project root.

| Option | Default | Description |
|--------|---------|-------------|
| `-d, --dir <path>` | `components/radzor` | Directory where components will be added |

### `radzor add <component>`
Downloads a component and adds it to your project.

| Option | Default | Description |
|--------|---------|-------------|
| `-d, --dir <path>` | from `radzor.json` | Override target directory |
| `--no-deps` | — | Skip installing npm dependencies |

### `radzor list`
Lists all available components from the registry.

### `radzor create <name>`
Scaffolds a new component with manifest, source, and LLM docs.

```bash
npx radzor create @radzor/my-component -c networking
```

### `radzor validate [path]`
Validates a component manifest against the RCS spec.

```bash
npx radzor validate .                    # Current directory
npx radzor validate my-component         # Component directory
npx radzor validate radzor.manifest.json # Manifest file
```

## LLM-Native Workflow

Components include a `radzor.manifest.json` that describes everything an LLM needs to integrate them:

```
"Use the radzor.manifest.json in components/radzor/audio-capture/ to add
audio recording to my app."
```

The manifest contains inputs, outputs, actions, events, and composability — so the LLM can generate correct integration code without reading the full source.

## Links

- [Radzor Platform](https://radzor.io)
- [Component Registry](https://github.com/radzor-io/components)
- [RCS Specification](https://github.com/radzor-io/spec)

## License

MIT
