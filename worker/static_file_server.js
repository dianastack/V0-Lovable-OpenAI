import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import * as net from "net";
import { promisify } from "util";
import { parentPort, isMainThread, workerData } from "worker_threads";

// Promisify file system operations
const statAsync = promisify(fs.stat);
const readFileAsync = promisify(fs.readFile);

// Configuration interface with types
// export interface ServerConfig {
//   port: number;
//   rootDir: string;
//   cacheMaxAge: number;
//   maxPortRetries?: number;
// }

// Default configuration
const DEFAULT_CONFIG = {
  port: 31_111,
  rootDir: ".",
  cacheMaxAge: 86400, // 1 day in seconds
  maxPortRetries: 5,
};

// MIME types mapping
const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".ts": "application/typescript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
  ".pdf": "application/pdf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".otf": "font/otf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".webp": "image/webp",
};

/**
 * Checks if a port is available
 * @param port Port number to check
 * @returns Promise that resolves to true if port is available, false otherwise
 */
const isPortAvailable = (port) => {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once("error", () => {
        // Port is in use
        resolve(false);
      })
      .once("listening", () => {
        // Port is available
        tester.close(() => resolve(true));
      })
      .listen(port);
  });
};

/**
 * Finds the first available port starting from the specified port
 * @param startPort Starting port number
 * @param maxRetries Maximum number of ports to try
 * @returns Promise resolving to the first available port, or undefined if none found
 */
const findAvailablePort = async (startPort, maxRetries) => {
  for (let i = 0; i < maxRetries; i++) {
    const port = startPort + i;
    // eslint-disable-next-line no-await-in-loop
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  return undefined;
};

/**
 * Handles HTTP requests, serving static files with caching
 */
const handleRequest = (config) => async (req, res) => {
  try {
    if (!req.url) {
      res.statusCode = 400;
      res.end("Bad Request");
      return;
    }

    // Only allow GET requests
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.setHeader("Allow", "GET");
      res.end("Method Not Allowed");
      return;
    }

    // Parse URL and sanitize path
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    let filePath = path.normalize(
      path.join(config.rootDir, parsedUrl.pathname)
    );

    // Handle root path, directory paths, or paths without file extensions by serving index.html
    if (
      filePath === path.normalize(config.rootDir) ||
      filePath.endsWith("/") ||
      !path.extname(filePath)
    ) {
      filePath = path.join(config.rootDir, "index.html");
    }

    // Check if file exists and get its stats
    let stats;
    try {
      stats = await statAsync(filePath);
    } catch (error) {
      // File not found
      res.statusCode = 404;
      res.end("Not Found");
      return;
    }

    // Handle directory requests
    if (stats.isDirectory()) {
      try {
        // Redirect to directory with trailing slash if needed
        if (!req.url.endsWith("/")) {
          res.statusCode = 301;
          res.setHeader("Location", `${req.url}/`);
          res.end();
          return;
        }

        // Try to serve index.html from directory
        filePath = path.join(filePath, "index.html");
        stats = await statAsync(filePath);
      } catch (error) {
        res.statusCode = 404;
        res.end("Not Found");
        return;
      }
    }

    // Get file extension and MIME type
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    // Handle caching - check if file has been modified
    const ifModifiedSince = req.headers["if-modified-since"];
    if (ifModifiedSince) {
      const modifiedSinceDate = new Date(ifModifiedSince);
      // Check if the file hasn't been modified since the client's last request
      if (modifiedSinceDate && stats.mtime <= modifiedSinceDate) {
        res.statusCode = 304; // Not Modified
        res.end();
        return;
      }
    }

    // Set cache headers
    const lastModified = stats.mtime.toUTCString();
    res.setHeader("Last-Modified", lastModified);
    res.setHeader("Cache-Control", `public, max-age=${config.cacheMaxAge}`);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", stats.size);

    // Read and send file
    const fileContent = await readFileAsync(filePath);
    res.end(fileContent);
  } catch (error) {
    console.error(`[Worker ${process.pid}] Server error:`, error);
    // Only attempt to send error response if headers haven't been sent
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  }
};

// Create and start the server
// Modified to return the port and not handle process exit
export const startServer = async (userConfig = {}) => {
  // Merge default config with user provided config
  const config = { ...DEFAULT_CONFIG, ...userConfig };

  // Try to find an available port
  const maxRetries = config.maxPortRetries || 5;
  const availablePort = await findAvailablePort(config.port, maxRetries);

  if (!availablePort) {
    throw new Error(
      `Could not find an available port after trying ${maxRetries} ports starting from ${config.port}`
    );
  }
  config.port = availablePort; // Update config with the actual port

  // Create server with the handler
  const server = http.createServer(handleRequest(config));

  // Start the server
  await new Promise((resolve, reject) => {
    server.on("error", (err) => {
      console.error(`[Worker ${process.pid}] Server error:`, err);
      reject(err); // Reject promise on server error during startup
    });
    console.log(`[Worker ${process.pid}] Listening on port ${config.port}`);
    server.listen(config.port, "localhost", () => {
      console.log(
        `[Worker ${process.pid}] 🚀 Static file server running at http://localhost:${config.port}/`
      );
      console.log(
        `[Worker ${process.pid}] 📁 Serving files from: ${path.resolve(
          config.rootDir
        )}`
      );
      console.log(
        `[Worker ${process.pid}] 🔄 Cache max age: ${config.cacheMaxAge} seconds`
      );
      resolve();
    });
  });

  // Don't handle SIGINT here, let the main thread manage the worker lifecycle

  return { server, port: config.port };
};

// --- Worker Logic ---
if (!isMainThread && parentPort) {
  const run = async () => {
    try {
      if (!workerData || !workerData.rootDir) {
        throw new Error("rootDir must be provided in workerData");
      }
      const config = { ...DEFAULT_CONFIG, ...workerData };
      const { port } = await startServer(config);
      parentPort?.postMessage({ status: "ready", port });
    } catch (error) {
      console.error(`[Worker ${process.pid}] Failed to start server:`, error);
      parentPort?.postMessage({ status: "error", message: error.message });
    }
  };

  run().catch((err) => {
    // Catch unhandled promise rejections during startup
    console.error(
      `[Worker ${process.pid}] Unhandled error during startup:`,
      err
    );
    parentPort?.postMessage({
      status: "error",
      message: err.message || "Unknown startup error",
    });
  });

  // Keep the worker alive
  // The server itself will keep the event loop running
} else if (!isMainThread) {
  // Should not happen if used correctly, but good to handle
  console.error("Running as worker but parentPort is not available.");
  process.exit(1);
}
// If it IS the main thread, exporting startServer allows for potential direct use or testing
