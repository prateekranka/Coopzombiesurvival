// Runs the Worker (rooms) and the Vite dev server together. Vite proxies /api to the Worker.
import { spawn } from "node:child_process";

const run = (ws) => spawn("npm", ["run", "dev", "-w", ws], { stdio: "inherit" });
const children = [run("@lifeline/server"), run("@lifeline/client")];
const stop = () => children.forEach((c) => c.kill());
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
children.forEach((c) => c.on("exit", stop));
