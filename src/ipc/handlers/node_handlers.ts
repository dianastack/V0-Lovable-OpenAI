import { ipcMain } from "electron";
import { spawn } from "child_process";
import { platform } from "os";
import { InstallNodeResult } from "../ipc_types";
type ShellResult =
  | {
      success: true;
      output: string;
    }
  | {
      success: false;
      errorMessage: string;
    };

function runShell(command: string): Promise<ShellResult> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    const process = spawn(command, {
      shell: true,
      stdio: ["ignore", "pipe", "pipe"], // ignore stdin, pipe stdout/stderr
    });

    process.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    process.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    process.on("error", (error) => {
      console.error(`Error executing command "${command}":`, error.message);
      resolve({ success: false, errorMessage: error.message });
    });

    process.on("close", (code) => {
      if (code === 0) {
        resolve({ success: true, output: stdout.trim() });
      } else {
        const errorMessage =
          stderr.trim() || `Command failed with code ${code}`;
        console.error(
          `Command "${command}" failed with code ${code}: ${stderr.trim()}`
        );
        resolve({ success: false, errorMessage });
      }
    });
  });
}

function checkCommandExists(command: string): Promise<string | null> {
  return new Promise((resolve) => {
    let output = "";
    const process = spawn(command, ["--version"], {
      shell: true,
      stdio: ["ignore", "pipe", "pipe"], // ignore stdin, pipe stdout/stderr
    });

    process.stdout?.on("data", (data) => {
      output += data.toString();
    });

    process.stderr?.on("data", (data) => {
      // Log stderr but don't treat it as a failure unless the exit code is non-zero
      console.warn(
        `Stderr from "${command} --version": ${data.toString().trim()}`
      );
    });

    process.on("error", (error) => {
      console.error(`Error executing command "${command}":`, error.message);
      resolve(null); // Command execution failed
    });

    process.on("close", (code) => {
      if (code === 0) {
        resolve(output.trim()); // Command succeeded, return trimmed output
      } else {
        console.error(
          `Command "${command} --version" failed with code ${code}`
        );
        resolve(null); // Command failed
      }
    });
  });
}

export function registerNodeHandlers() {
  ipcMain.handle(
    "nodejs-status",
    async (): Promise<{
      nodeVersion: string | null;
      npmVersion: string | null;
    }> => {
      // Run checks in parallel
      const [nodeVersion, npmVersion] = await Promise.all([
        checkCommandExists("node"),
        checkCommandExists("npm"),
      ]);
      return { nodeVersion, npmVersion };
    }
  );

  ipcMain.handle("install-node", async (): Promise<InstallNodeResult> => {
    console.log("Installing Node.js...");
    if (platform() === "win32") {
      let result = await runShell("winget install Volta.Volta");
      if (!result.success) {
        return { success: false, errorMessage: result.errorMessage };
      }
    } else {
      let result = await runShell("curl https://get.volta.sh | bash");
      if (!result.success) {
        return { success: false, errorMessage: result.errorMessage };
      }
    }
    console.log("Installed Volta");

    process.env.PATH = ["~/.volta/bin", process.env.PATH].join(":");
    console.log("Updated PATH");
    let result = await runShell("volta install node");
    if (!result.success) {
      return { success: false, errorMessage: result.errorMessage };
    }
    console.log("Installed Node.js (via Volta)");

    result = await runShell("node --version");
    if (!result.success) {
      return { success: false, errorMessage: result.errorMessage };
    }
    console.log("Node.js is setup with version");

    return { success: true, version: result.output };
  });
}
