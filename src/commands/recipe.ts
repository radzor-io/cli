import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { addCommand } from "./add.js";
import { readConfig } from "../utils/config.js";
import { info, error, step, heading, warn } from "../utils/logger.js";

import { REGISTRY_API } from "../utils/registry.js";

export async function recipeCommand(slug: string, opts: { dir?: string }): Promise<void> {
  heading(`Adding Recipe: ${slug}`);
  step("Fetching recipe details from registry...");

  let recipe;
  try {
    const response = await fetch(`${REGISTRY_API}/recipes/${slug}`);
    if (!response.ok) {
      throw new Error(`Recipe ${slug} not found`);
    }
    recipe = await response.json();
  } catch (err) {
    error(`Failed to fetch recipe "${slug}". Run \`radzor list\` (if recipes are listed) or check radzor.io/recipes.`);
    process.exit(1);
  }

  const componentNames = recipe.steps.map((s: { slug: string }) => s.slug);
  info(`Recipe "${recipe.title}" uses ${componentNames.length} components: ${componentNames.join(", ")}`);

  // Call the existing add command to install all components
  await addCommand(componentNames, { dir: opts.dir });

  // Now write the wiring code
  if (recipe.wiring) {
    const config = await readConfig().catch(() => ({ componentDir: opts.dir ?? "components/radzor" }));
    const targetDir = opts.dir ?? config.componentDir;
    await mkdir(targetDir, { recursive: true });
    
    // Suggest a file name based on recipe slug
    const wiringFile = join(targetDir, `${slug}-recipe.ts`);
    await writeFile(wiringFile, recipe.wiring);
    
    console.log("");
    info(`Recipe scaffolded! Wiring code written to: ${wiringFile}`);
    step("Review the file to see how the components are connected.");
    
    if (recipe.envVars && recipe.envVars.length > 0) {
      warn("This recipe requires the following environment variables. Check your .env file:");
      for (const env of recipe.envVars) {
        step(`  ${env}=...`);
      }
    }
  }
}
