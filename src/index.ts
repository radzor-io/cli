#!/usr/bin/env node

import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { addCommand } from "./commands/add.js";
import { listCommand } from "./commands/list.js";
import { validateCommand } from "./commands/validate.js";
import { createCommand } from "./commands/create.js";
import { graphCommand } from "./commands/graph.js";
import { recipeCommand } from "./commands/recipe.js";

import { diffCommand } from "./commands/diff.js";
import { updateCommand } from "./commands/update.js";

const program = new Command();

program
  .name("radzor")
  .description("Add AI-ready components to your project")
  .version("0.1.1");

program
  .command("init")
  .description("Initialize Radzor in your project")
  .option("-d, --dir <path>", "Target directory for components", "components/radzor")
  .option("--no-rules", "Skip generating AI agent context files")
  .action(initCommand);

program
  .command("add")
  .argument("<components...>", "One or more component names")
  .description("Add components to your project")
  .option("-d, --dir <path>", "Override target directory")
  .option("--no-deps", "Skip installing dependencies")
  .action(addCommand);

const recipeGrp = program
  .command("recipe")
  .description("Manage and scaffold recipes");

recipeGrp
  .command("add <slug>")
  .description("Install a recipe and its components")
  .option("-d, --dir <path>", "Override target directory")
  .action(recipeCommand);

program
  .command("list")
  .description("List all available components")
  .action(listCommand);

program
  .command("validate [path]")
  .description("Validate a radzor.manifest.json file")
  .action(validateCommand);

program
  .command("create <name>")
  .description("Scaffold a new component (e.g. radzor create @myorg/my-component)")
  .option("-c, --category <category>", "Component category", "other")
  .option("-d, --dir <path>", "Override output directory")
  .action(createCommand);

program
  .command("graph")
  .description("Display the data-flow graph of installed components")
  .option("--mermaid", "Output as Mermaid diagram syntax")
  .action(graphCommand);

program
  .command("diff <component>")
  .description("Show differences between local component and registry version")
  .option("-d, --dir <path>", "Override target directory")
  .action(diffCommand);

program
  .command("update <component>")
  .description("Update an existing component to the latest registry version")
  .option("-d, --dir <path>", "Override target directory")
  .option("--no-deps", "Skip updating dependencies")
  .action(updateCommand);

program.parse();
