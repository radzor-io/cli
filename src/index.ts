#!/usr/bin/env node

import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { addCommand } from "./commands/add.js";
import { listCommand } from "./commands/list.js";

const program = new Command();

program
  .name("radzor")
  .description("Add AI-ready components to your project")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize Radzor in your project")
  .option("-d, --dir <path>", "Target directory for components", "components/radzor")
  .action(initCommand);

program
  .command("add <component>")
  .description("Add a component to your project")
  .option("-d, --dir <path>", "Override target directory")
  .option("--no-deps", "Skip installing dependencies")
  .action(addCommand);

program
  .command("list")
  .description("List all available components")
  .action(listCommand);

program.parse();
