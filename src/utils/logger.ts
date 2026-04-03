const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";

export function info(msg: string): void {
  console.log(`${GREEN}✓${RESET} ${msg}`);
}

export function warn(msg: string): void {
  console.log(`${YELLOW}⚠${RESET} ${msg}`);
}

export function error(msg: string): void {
  console.error(`\x1b[31m✗${RESET} ${msg}`);
}

export function step(msg: string): void {
  console.log(`${DIM}  ${msg}${RESET}`);
}

export function heading(msg: string): void {
  console.log(`\n${BOLD}${CYAN}${msg}${RESET}\n`);
}
