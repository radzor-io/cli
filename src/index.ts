#!/usr/bin/env node

import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { addCommand } from "./commands/add.js";
import { listCommand } from "./commands/list.js";
import { validateCommand } from "./commands/validate.js";
import { createCommand } from "./commands/create.js";
import { graphCommand } from "./commands/graph.js";

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

program.parse();
