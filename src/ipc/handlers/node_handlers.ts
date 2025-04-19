import { ipcMain, app } from "electron";
import { exec, execSync, spawn } from "child_process";
import { platform, arch } from "os";
import { NodeSystemInfo } from "../ipc_types";
import fixPath from "fix-path";

function checkCommandExists(command: string): Promise<string | null> {
  return new Promise((resolve) => {
    let output = "";
    const process = spawn(command, {
      shell: true,
      stdio: ["ignore", "pipe", "pipe"], // ignore stdin, pipe stdout/stderr
    });

    process.stdout?.on("data", (data) => {
      output += data.toString();
    });

    process.stderr?.on("data", (data) => {
      // Log stderr but don't treat it as a failure unless the exit code is non-zero
      console.warn(`Stderr from "${command}": ${data.toString().trim()}`);
    });

    process.on("error", (error) => {
      console.error(`Error executing command "${command}":`, error.message);
      resolve(null); // Command execution failed
    });

    process.on("close", (code) => {
      if (code === 0) {
        resolve(output.trim()); // Command succeeded, return trimmed output
      } else {
        console.error(`Command "${command}" failed with code ${code}`);
        resolve(null); // Command failed
      }
    });
  });
}

export function registerNodeHandlers() {
  ipcMain.handle("nodejs-status", async (): Promise<NodeSystemInfo> => {
    // Run checks in parallel
    const [nodeVersion, pnpmVersion] = await Promise.all([
      checkCommandExists("node --version"),
      // First, check if pnpm is installed.
      // If not, try to install it using corepack.
      // If both fail, then pnpm is not available.
      checkCommandExists(
        "pnpm --version || (corepack enable pnpm && pnpm --version) || (npm install -g pnpm@latest-10 && pnpm --version)"
      ),
    ]);
    // Default to mac download url.
    let nodeDownloadUrl = "https://nodejs.org/dist/v22.14.0/node-v22.14.0.pkg";
    if (platform() == "win32") {
      if (arch() === "arm64" || arch() === "arm") {
        nodeDownloadUrl =
          "https://nodejs.org/dist/v22.14.0/node-v22.14.0-arm64.msi";
      } else {
        // x64 is the most common architecture for Windows so it's the
        // default download url.
        nodeDownloadUrl =
          "https://nodejs.org/dist/v22.14.0/node-v22.14.0-x64.msi";
      }
    }
    return { nodeVersion, pnpmVersion, nodeDownloadUrl };
  });

  ipcMain.handle("reload-env-path", async (): Promise<void> => {
    console.debug("Reloading env path, previously:", process.env.PATH);
    if (platform() === "win32") {
      const newPath = execSync("cmd /c echo %PATH%", {
        encoding: "utf8",
      }).trim();
      process.env.PATH = newPath;
    } else {
      fixPath();
    }
    console.debug("Reloaded env path, now:", process.env.PATH);
  });
}
