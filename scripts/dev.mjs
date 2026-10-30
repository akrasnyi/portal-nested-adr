// Starts the three dev servers; Ctrl+C stops all
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vite = path.join(root, "node_modules/.bin/vite");
const kids = ["use-case-a", "app-hub", "shell"].map((app) =>
  spawn(vite, [], { cwd: path.join(root, "apps", app), stdio: "inherit" }),
);
const stop = () => {
  for (const k of kids) k.kill("SIGTERM");
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const k of kids) k.on("exit", (code) => code && stop());
