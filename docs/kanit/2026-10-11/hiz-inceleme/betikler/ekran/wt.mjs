import { Worker } from "node:worker_threads";
const w = new Worker(new URL("./we.mjs", import.meta.url), { name: "destekofis-rapor", workerData: { id: "x" } });
w.on("exit", () => console.log("bitti"));
