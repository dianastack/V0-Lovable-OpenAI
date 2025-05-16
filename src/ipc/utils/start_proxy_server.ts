// startProxy.js – helper to launch proxy.js as a worker

import { Worker } from "worker_threads";
import path from "path";

export function startProxy(
  targetOrigin: string,
  opts: {
    // host?: string;
    // port?: number;
    // env?: Record<string, string>;
    onStarted?: (proxyUrl: string) => void;
  } = {},
) {
  if (!/^https?:\/\//.test(targetOrigin))
    throw new Error("startProxy: targetOrigin must be absolute http/https URL");

  const {
    // host = "localhost",
    // port = 31111,
    // env = {}, // additional env vars to pass to the worker
    onStarted,
  } = opts;

  const worker = new Worker(
    path.resolve(__dirname, "..", "..", "worker", "proxy_server.js"),
    {
      env: {
        ...process.env, // inherit parent env

        TARGET_URL: targetOrigin,
        LISTEN_HOST: "localhost",
        LISTEN_PORT: "31111",
      },
      workerData: {
        targetOrigin,
      },
    },
  );

  worker.on("message", (m) => {
    console.log("[proxy]", m);
    if (typeof m === "string" && m.startsWith("proxy-server-start url=")) {
      const url = m.substring("proxy-server-start url=".length);
      onStarted?.(url);
    }
  });
  worker.on("error", (e) => console.error("[proxy] error:", e));
  worker.on("exit", (c) => console.log("[proxy] exit", c));

  return worker; // let the caller keep a handle if desired
}

module.exports = startProxy;
