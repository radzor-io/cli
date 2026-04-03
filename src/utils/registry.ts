const GITHUB_RAW = "https://raw.githubusercontent.com/radzor-io/components/main";
const GITHUB_API = "https://api.github.com/repos/radzor-io/components/contents";
const REGISTRY_API = "https://radzor.io/api";

interface GitHubFile {
  name: string;
  path: string;
  type: "file" | "dir";
  download_url: string | null;
}

export interface ComponentManifest {
  radzor: string;
  name: string;
  slug?: string;
  version: string;
  latestVersion?: string;
  description: string;
  languages: string[];
  category: string;
  tags: string[];
  dependencies?: {
    packages?: Record<string, string>;
  };
}

export interface ComponentFile {
  path: string;
  content: string;
}

/** List all available components from the registry API. */
export async function listComponents(): Promise<ComponentManifest[]> {
  const res = await fetch(`${REGISTRY_API}/registry`);
  if (!res.ok) {
    throw new Error(`Failed to fetch registry: ${res.status}`);
  }
  const data = await res.json();
  return data.components ?? data;
}

/** Fetch the manifest for a specific component. */
export async function fetchManifest(name: string): Promise<ComponentManifest> {
  // Try the registry API first
  const res = await fetch(`${REGISTRY_API}/components/${name}/manifest`);
  if (res.ok) {
    return res.json();
  }

  // Fallback to GitHub raw
  const ghRes = await fetch(`${GITHUB_RAW}/${name}/radzor.manifest.json`);
  if (!ghRes.ok) {
    throw new Error(`Component "${name}" not found`);
  }
  return ghRes.json();
}

/** Recursively fetch all files for a component from GitHub. */
export async function fetchComponentFiles(name: string): Promise<ComponentFile[]> {
  const files: ComponentFile[] = [];
  await collectFiles(name, files);
  return files;
}

async function collectFiles(dirPath: string, files: ComponentFile[]): Promise<void> {
  const res = await fetch(`${GITHUB_API}/${dirPath}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch component files: ${res.status}`);
  }

  const entries: GitHubFile[] = await res.json();

  for (const entry of entries) {
    // Skip the manifest (we handle it separately) and llm docs
    if (entry.name === "radzor.manifest.json") continue;
    if (entry.path.includes("/llm/")) continue;

    if (entry.type === "dir") {
      await collectFiles(entry.path, files);
    } else if (entry.download_url) {
      const contentRes = await fetch(entry.download_url);
      if (!contentRes.ok) continue;
      const content = await contentRes.text();

      // Make path relative to the component root
      const componentName = dirPath.split("/")[0];
      const relativePath = entry.path.replace(`${componentName}/`, "");
      files.push({ path: relativePath, content });
    }
  }
}
