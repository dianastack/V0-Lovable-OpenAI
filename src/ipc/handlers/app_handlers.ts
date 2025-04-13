import { ipcMain } from "electron";
import { db, getDatabasePath } from "../../db";
import { apps, chats } from "../../db/schema";
import { desc, eq } from "drizzle-orm";
import type {
  App,
  CreateAppParams,
  SandboxConfig,
  Version,
} from "../ipc_types";
import fs from "node:fs";
import path from "node:path";
import { getDyadAppPath, getUserDataPath } from "../../paths/paths";
import { spawn } from "node:child_process";
import git from "isomorphic-git";
import { promises as fsPromises } from "node:fs";
import { extractCodebase } from "../../utils/codebase";
// Import our utility modules
import { withLock } from "../utils/lock_utils";
import {
  copyDirectoryRecursive,
  getFilesRecursively,
} from "../utils/file_utils";
import {
  runningApps,
  processCounter,
  killProcess,
  removeAppIfCurrentProcess,
  RunningAppInfo,
} from "../utils/process_manager";
import { ALLOWED_ENV_VARS } from "../../constants/models";
import { getEnvVar } from "../utils/read_env";
import { readSettings } from "../../main/settings";
import { Worker } from "worker_threads";
import fixPath from "fix-path";

// Needed, otherwise electron in MacOS/Linux will not be able
// to find "npm".
fixPath();

// Keep track of the static file server worker
let staticServerWorker: Worker | null = null;
let staticServerPort: number | null = null;
// let staticServerRootDir: string | null = null; // Store the root dir it's serving - Removed

async function executeApp({
  appPath,
  appId,
  event, // Keep event for local-node case
}: {
  appPath: string;
  appId: number;
  event: Electron.IpcMainInvokeEvent;
}): Promise<void> {
  // Return type is void, communication happens via event.sender.send
  const settings = readSettings();
  if (settings.runtimeMode === "web-sandbox") {
    // If server is already running, do nothing.
    if (staticServerWorker) {
      console.log(`Static server already running on port ${staticServerPort}`);
      // No need to send app:output here
      return;
    }

    // Start the worker if it's not running
    console.log(`Starting static file server worker for the first time.`);
    // No need to send starting status

    const workerScriptPath = path.resolve(
      __dirname,
      "../../worker/static_file_server.js"
    );

    // Check if worker script exists
    if (!fs.existsSync(workerScriptPath)) {
      const errorMsg = `Worker script not found at ${workerScriptPath}. Build process might be incomplete.`;
      console.error(errorMsg);
      // No need to send error status via event
      throw new Error(errorMsg);
    }

    staticServerWorker = new Worker(workerScriptPath, {
      workerData: {
        rootDir: path.join(__dirname, "..", "..", "sandpack-generated"), // Use the appPath of the first app run in this mode
        // Optionally pass other config like port preference
        // port: 3001 // Example
      },
    });
    // staticServerRootDir = appPath; // Removed

    staticServerWorker.on("message", (message) => {
      console.log(
        `Message from static server worker: ${JSON.stringify(message)}`
      );
      if (message.status === "ready" && message.port) {
        staticServerPort = message.port;
        console.log(`Static file server ready on port ${staticServerPort}`);
        // No need to send ready status
      } else if (message.status === "error") {
        console.error(`Static file server worker error: ${message.message}`);
        // No need to send error status
        // Terminate the failed worker
        staticServerWorker?.terminate();
        staticServerWorker = null;
        staticServerPort = null;
      }
    });

    staticServerWorker.on("error", (error) => {
      console.error(`Static file server worker encountered an error:`, error);
      // No need to send error status
      staticServerWorker = null; // Worker is likely unusable
      staticServerPort = null;
    });

    staticServerWorker.on("exit", (code) => {
      console.log(`Static file server worker exited with code ${code}`);
      // Clear state if the worker exits unexpectedly
      if (staticServerWorker) {
        // Check avoids race condition if terminated intentionally
        staticServerWorker = null;
        staticServerPort = null;
        // No need to send exit status
      }
    });

    return; // Return void
  }
  if (settings.runtimeMode === "local-node") {
    // Ensure worker isn't running if switching modes (optional, depends on desired behavior)
    // if (staticServerWorker) { await staticServerWorker.terminate(); staticServerWorker = null; staticServerPort = null; }
    await executeAppLocalNode({ appPath, appId, event });
    return;
  }
  throw new Error(`Invalid runtime mode: ${settings.runtimeMode}`);
}
async function executeAppLocalNode({
  appPath,
  appId,
  event,
}: {
  appPath: string;
  appId: number;
  event: Electron.IpcMainInvokeEvent;
}): Promise<void> {
  const process = spawn("npm install && npm run dev", [], {
    cwd: appPath,
    shell: true,
    stdio: "pipe", // Ensure stdio is piped so we can capture output/errors and detect close
    detached: false, // Ensure child process is attached to the main process lifecycle unless explicitly backgrounded
  });

  // Check if process spawned correctly
  if (!process.pid) {
    // Attempt to capture any immediate errors if possible
    let errorOutput = "";
    process.stderr?.on("data", (data) => (errorOutput += data));
    await new Promise((resolve) => process.on("error", resolve)); // Wait for error event
    throw new Error(
      `Failed to spawn process for app ${appId}. Error: ${
        errorOutput || "Unknown spawn error"
      }`
    );
  }

  // Increment the counter and store the process reference with its ID
  const currentProcessId = processCounter.increment();
  runningApps.set(appId, { process, processId: currentProcessId });

  // Log output
  process.stdout?.on("data", (data) => {
    console.log(
      `App ${appId} (PID: ${process.pid}) stdout: ${data.toString().trim()}`
    );
    event.sender.send("app:output", {
      type: "stdout",
      message: data.toString().trim(),
      appId: appId,
    });
  });

  process.stderr?.on("data", (data) => {
    console.error(
      `App ${appId} (PID: ${process.pid}) stderr: ${data.toString().trim()}`
    );
    event.sender.send("app:output", {
      type: "stderr",
      message: data.toString().trim(),
      appId: appId,
    });
  });

  // Handle process exit/close
  process.on("close", (code, signal) => {
    console.log(
      `App ${appId} (PID: ${process.pid}) process closed with code ${code}, signal ${signal}.`
    );
    removeAppIfCurrentProcess(appId, process);
  });

  // Handle errors during process lifecycle (e.g., command not found)
  process.on("error", (err) => {
    console.error(
      `Error in app ${appId} (PID: ${process.pid}) process: ${err.message}`
    );
    removeAppIfCurrentProcess(appId, process);
    // Note: We don't throw here as the error is asynchronous. The caller got a success response already.
    // Consider adding ipcRenderer event emission to notify UI of the error.
  });
}

export function registerAppHandlers() {
  ipcMain.handle(
    "get-app-sandbox-config",
    async (_, { appId }: { appId: number }): Promise<SandboxConfig> => {
      const app = await db.query.apps.findFirst({
        where: eq(apps.id, appId),
      });
      if (!app) {
        throw new Error("App not found");
      }
      const appPath = getDyadAppPath(app.path);
      const files = getFilesRecursively(appPath, appPath);

      const filesMap = await Promise.all(
        files.map(async (file) => {
          const content = await fs.promises.readFile(
            path.join(appPath, file),
            "utf-8"
          );
          return { [file]: content };
        })
      );

      // Get dependencies from package.json
      const packageJsonPath = path.join(appPath, "package.json");
      const packageJson = await fs.promises.readFile(packageJsonPath, "utf-8");
      const dependencies = JSON.parse(packageJson).dependencies;

      return {
        files: filesMap.reduce((acc, file) => ({ ...acc, ...file }), {}),
        dependencies,
        entry: "src/main.tsx",
      };
    }
  );
  ipcMain.handle("create-app", async (_, params: CreateAppParams) => {
    const appPath = params.name;
    const fullAppPath = getDyadAppPath(appPath);
    if (fs.existsSync(fullAppPath)) {
      throw new Error(`App already exists at: ${fullAppPath}`);
    }
    // Create a new app
    const [app] = await db
      .insert(apps)
      .values({
        name: params.name,
        // Use the name as the path for now
        path: appPath,
      })
      .returning();

    // Create an initial chat for this app
    const [chat] = await db
      .insert(chats)
      .values({
        appId: app.id,
      })
      .returning();

    // Start async operations in background
    try {
      // Copy scaffold asynchronously
      await copyDirectoryRecursive(
        path.join(__dirname, "..", "..", "scaffold"),
        fullAppPath
      );
      // Initialize git repo and create first commit
      await git.init({
        fs: fs,
        dir: fullAppPath,
        defaultBranch: "main",
      });

      // Stage all files
      await git.add({
        fs: fs,
        dir: fullAppPath,
        filepath: ".",
      });

      // Create initial commit
      await git.commit({
        fs: fs,
        dir: fullAppPath,
        message: "Init from react vite template",
        author: {
          name: "Dyad",
          email: "dyad@example.com",
        },
      });
    } catch (error) {
      console.error("Error in background app initialization:", error);
    }
    // })();

    return { app, chatId: chat.id };
  });

  ipcMain.handle("get-app", async (_, appId: number): Promise<App> => {
    const app = await db.query.apps.findFirst({
      where: eq(apps.id, appId),
    });

    if (!app) {
      throw new Error("App not found");
    }

    // Get app files
    const appPath = getDyadAppPath(app.path);
    let files: string[] = [];

    try {
      files = getFilesRecursively(appPath, appPath);
    } catch (error) {
      console.error(`Error reading files for app ${appId}:`, error);
      // Return app even if files couldn't be read
    }

    return {
      ...app,
      files,
    };
  });

  ipcMain.handle("list-apps", async () => {
    const allApps = await db.query.apps.findMany({
      orderBy: [desc(apps.createdAt)],
    });
    return {
      apps: allApps,
      appBasePath: getDyadAppPath("$APP_BASE_PATH"),
    };
  });

  ipcMain.handle(
    "read-app-file",
    async (_, { appId, filePath }: { appId: number; filePath: string }) => {
      const app = await db.query.apps.findFirst({
        where: eq(apps.id, appId),
      });

      if (!app) {
        throw new Error("App not found");
      }

      const appPath = getDyadAppPath(app.path);
      const fullPath = path.join(appPath, filePath);

      // Check if the path is within the app directory (security check)
      if (!fullPath.startsWith(appPath)) {
        throw new Error("Invalid file path");
      }

      if (!fs.existsSync(fullPath)) {
        throw new Error("File not found");
      }

      try {
        const contents = fs.readFileSync(fullPath, "utf-8");
        return contents;
      } catch (error) {
        console.error(
          `Error reading file ${filePath} for app ${appId}:`,
          error
        );
        throw new Error("Failed to read file");
      }
    }
  );

  ipcMain.handle("get-env-vars", async () => {
    const envVars: Record<string, string | undefined> = {};
    for (const key of ALLOWED_ENV_VARS) {
      envVars[key] = getEnvVar(key);
    }
    return envVars;
  });

  ipcMain.handle(
    "run-app",
    async (
      event: Electron.IpcMainInvokeEvent,
      { appId }: { appId: number }
    ) => {
      return withLock(appId, async () => {
        // Check if app is already running
        if (runningApps.has(appId)) {
          console.debug(`App ${appId} is already running.`);
          // Potentially return the existing process info or confirm status
          return { success: true, message: "App already running." };
        }

        const app = await db.query.apps.findFirst({
          where: eq(apps.id, appId),
        });

        if (!app) {
          throw new Error("App not found");
        }

        console.debug(`Starting app ${appId} in path ${app.path}`);

        const appPath = getDyadAppPath(app.path);
        try {
          const currentProcessId = await executeApp({ appPath, appId, event });

          return { success: true, processId: currentProcessId };
        } catch (error: any) {
          console.error(`Error running app ${appId}:`, error);
          // Ensure cleanup if error happens during setup but before process events are handled
          if (
            runningApps.has(appId) &&
            runningApps.get(appId)?.processId === processCounter.value
          ) {
            runningApps.delete(appId);
          }
          throw new Error(`Failed to run app ${appId}: ${error.message}`);
        }
      });
    }
  );

  ipcMain.handle("stop-app", async (_, { appId }: { appId: number }) => {
    console.log(
      `Attempting to stop app ${appId} (local-node only). Current running apps: ${runningApps.size}`
    );

    // Static server worker is NOT terminated here anymore

    // Use withLock for local-node apps
    return withLock(appId, async () => {
      const appInfo = runningApps.get(appId);

      if (!appInfo) {
        console.log(
          `App ${appId} not found in running apps map (local-node). Assuming already stopped or was web-sandbox.`
        );
        // If no local-node app was running, and we terminated the static server above, return success.
        return {
          success: true,
          message: "App not running in local-node mode.", // Simplified message
        };
      }

      const { process, processId } = appInfo;
      console.log(
        `Found running app ${appId} with processId ${processId} (PID: ${process.pid}). Attempting to stop.`
      );

      // Check if the process is already exited or closed
      if (process.exitCode !== null || process.signalCode !== null) {
        console.log(
          `Process for app ${appId} (PID: ${process.pid}) already exited (code: ${process.exitCode}, signal: ${process.signalCode}). Cleaning up map.`
        );
        runningApps.delete(appId); // Ensure cleanup if somehow missed
        return { success: true, message: "Process already exited." };
      }

      try {
        // Use the killProcess utility to stop the process
        await killProcess(process);

        // Now, safely remove the app from the map *after* confirming closure
        removeAppIfCurrentProcess(appId, process);

        return { success: true };
      } catch (error: any) {
        console.error(
          `Error stopping app ${appId} (PID: ${process.pid}, processId: ${processId}):`,
          error
        );
        // Attempt cleanup even if an error occurred during the stop process
        removeAppIfCurrentProcess(appId, process);
        throw new Error(`Failed to stop app ${appId}: ${error.message}`);
      }
    });
  });

  ipcMain.handle(
    "restart-app",
    async (
      event: Electron.IpcMainInvokeEvent,
      { appId }: { appId: number }
    ) => {
      // Static server worker is NOT terminated here anymore

      return withLock(appId, async () => {
        try {
          // First stop the app if it's running
          const appInfo = runningApps.get(appId);
          if (appInfo) {
            const { process, processId } = appInfo;
            console.log(
              `Stopping local-node app ${appId} (processId ${processId}) before restart` // Adjusted log
            );

            // Use the killProcess utility to stop the process
            await killProcess(process);

            // Remove from running apps
            runningApps.delete(appId);
          } else {
            console.log(
              `App ${appId} not running in local-node mode, proceeding to start.`
            );
          }

          // Now start the app again
          const app = await db.query.apps.findFirst({
            where: eq(apps.id, appId),
          });

          if (!app) {
            throw new Error("App not found");
          }

          const appPath = getDyadAppPath(app.path);
          console.debug(
            `Executing app ${appId} in path ${app.path} after restart request`
          ); // Adjusted log

          await executeApp({ appPath, appId, event }); // This will handle starting either mode

          return { success: true };
        } catch (error) {
          console.error(`Error restarting app ${appId}:`, error);
          throw error;
        }
      });
    }
  );

  ipcMain.handle("list-versions", async (_, { appId }: { appId: number }) => {
    const app = await db.query.apps.findFirst({
      where: eq(apps.id, appId),
    });

    if (!app) {
      throw new Error("App not found");
    }

    const appPath = getDyadAppPath(app.path);

    // Just return an empty array if the app is not a git repo.
    if (!fs.existsSync(path.join(appPath, ".git"))) {
      return [];
    }

    try {
      const commits = await git.log({
        fs,
        dir: appPath,
        depth: 1000, // Limit to last 1000 commits for performance
      });

      return commits.map((commit) => ({
        oid: commit.oid,
        message: commit.commit.message,
        timestamp: commit.commit.author.timestamp,
      })) satisfies Version[];
    } catch (error: any) {
      console.error(`Error listing versions for app ${appId}:`, error);
      throw new Error(`Failed to list versions: ${error.message}`);
    }
  });

  ipcMain.handle(
    "revert-version",
    async (
      _,
      { appId, previousVersionId }: { appId: number; previousVersionId: string }
    ) => {
      return withLock(appId, async () => {
        const app = await db.query.apps.findFirst({
          where: eq(apps.id, appId),
        });

        if (!app) {
          throw new Error("App not found");
        }

        const appPath = getDyadAppPath(app.path);

        try {
          await git.checkout({
            fs,
            dir: appPath,
            ref: "main",
            force: true,
          });
          // Get status matrix comparing the target commit (previousVersionId as HEAD) with current working directory
          const matrix = await git.statusMatrix({
            fs,
            dir: appPath,
            ref: previousVersionId,
          });

          // Process each file to revert to the state in previousVersionId
          for (const [
            filepath,
            headStatus,
            workdirStatus,
            stageStatus,
          ] of matrix) {
            const fullPath = path.join(appPath, filepath);

            // If file exists in HEAD (previous version)
            if (headStatus === 1) {
              // If file doesn't exist or has changed in working directory, restore it from the target commit
              if (workdirStatus !== 1) {
                const { blob } = await git.readBlob({
                  fs,
                  dir: appPath,
                  oid: previousVersionId,
                  filepath,
                });
                await fsPromises.mkdir(path.dirname(fullPath), {
                  recursive: true,
                });
                await fsPromises.writeFile(fullPath, Buffer.from(blob));
              }
            }
            // If file doesn't exist in HEAD but exists in working directory, delete it
            else if (headStatus === 0 && workdirStatus !== 0) {
              if (fs.existsSync(fullPath)) {
                await fsPromises.unlink(fullPath);
                await git.remove({
                  fs,
                  dir: appPath,
                  filepath: filepath,
                });
              }
            }
          }

          // Stage all changes
          await git.add({
            fs,
            dir: appPath,
            filepath: ".",
          });

          // Create a revert commit
          await git.commit({
            fs,
            dir: appPath,
            message: `Reverted all changes back to version ${previousVersionId}`,
            author: {
              name: "Dyad",
              email: "hi@dyad.sh",
            },
          });

          return { success: true };
        } catch (error: any) {
          console.error(
            `Error reverting to version ${previousVersionId} for app ${appId}:`,
            error
          );
          throw new Error(`Failed to revert version: ${error.message}`);
        }
      });
    }
  );

  ipcMain.handle(
    "checkout-version",
    async (_, { appId, versionId }: { appId: number; versionId: string }) => {
      return withLock(appId, async () => {
        const app = await db.query.apps.findFirst({
          where: eq(apps.id, appId),
        });

        if (!app) {
          throw new Error("App not found");
        }

        const appPath = getDyadAppPath(app.path);

        try {
          if (versionId !== "main") {
            // First check if the version exists
            const commits = await git.log({
              fs,
              dir: appPath,
              depth: 100,
            });

            const targetCommit = commits.find((c) => c.oid === versionId);
            if (!targetCommit) {
              throw new Error("Target version not found");
            }
          }

          // Checkout the target commit
          await git.checkout({
            fs,
            dir: appPath,
            ref: versionId,
            force: true,
          });

          return { success: true };
        } catch (error: any) {
          console.error(
            `Error checking out version ${versionId} for app ${appId}:`,
            error
          );
          throw new Error(`Failed to checkout version: ${error.message}`);
        }
      });
    }
  );

  // Extract codebase information
  ipcMain.handle(
    "extract-codebase",
    async (_, { appId, maxFiles }: { appId: number; maxFiles?: number }) => {
      const app = await db.query.apps.findFirst({
        where: eq(apps.id, appId),
      });

      if (!app) {
        throw new Error("App not found");
      }

      const appPath = getDyadAppPath(app.path);

      try {
        return await extractCodebase(appPath, maxFiles);
      } catch (error) {
        console.error(`Error extracting codebase for app ${appId}:`, error);
        throw new Error(
          `Failed to extract codebase: ${(error as any).message}`
        );
      }
    }
  );

  ipcMain.handle(
    "edit-app-file",
    async (
      _,
      {
        appId,
        filePath,
        content,
      }: { appId: number; filePath: string; content: string }
    ) => {
      const app = await db.query.apps.findFirst({
        where: eq(apps.id, appId),
      });

      if (!app) {
        throw new Error("App not found");
      }

      const appPath = getDyadAppPath(app.path);
      const fullPath = path.join(appPath, filePath);

      // Check if the path is within the app directory (security check)
      if (!fullPath.startsWith(appPath)) {
        throw new Error("Invalid file path");
      }

      // Ensure directory exists
      const dirPath = path.dirname(fullPath);
      await fsPromises.mkdir(dirPath, { recursive: true });

      try {
        await fsPromises.writeFile(fullPath, content, "utf-8");

        // Check if git repository exists and commit the change
        if (fs.existsSync(path.join(appPath, ".git"))) {
          await git.add({
            fs,
            dir: appPath,
            filepath: filePath,
          });

          await git.commit({
            fs,
            dir: appPath,
            message: `Updated ${filePath}`,
            author: {
              name: "Dyad",
              email: "hi@dyad.sh",
            },
          });
        }

        return { success: true };
      } catch (error: any) {
        console.error(
          `Error writing file ${filePath} for app ${appId}:`,
          error
        );
        throw new Error(`Failed to write file: ${error.message}`);
      }
    }
  );

  ipcMain.handle("delete-app", async (_, { appId }: { appId: number }) => {
    // Static server worker is NOT terminated here anymore

    return withLock(appId, async () => {
      // Check if app exists
      const app = await db.query.apps.findFirst({
        where: eq(apps.id, appId),
      });

      if (!app) {
        throw new Error("App not found");
      }

      // Stop the app if it's running
      if (runningApps.has(appId)) {
        const appInfo = runningApps.get(appId)!;
        try {
          console.log(`Stopping local-node app ${appId} before deletion.`); // Adjusted log
          await killProcess(appInfo.process);
          runningApps.delete(appId);
        } catch (error: any) {
          console.error(
            `Error stopping local-node app ${appId} before deletion:`,
            error
          ); // Adjusted log
          // Continue with deletion even if stopping fails
        }
      }

      // Delete app files
      const appPath = getDyadAppPath(app.path);
      try {
        await fsPromises.rm(appPath, { recursive: true, force: true });
      } catch (error: any) {
        console.error(`Error deleting app files for app ${appId}:`, error);
        throw new Error(`Failed to delete app files: ${error.message}`);
      }

      // Delete app from database
      try {
        await db.delete(apps).where(eq(apps.id, appId));
        // Note: Associated chats will cascade delete if that's set up in the schema
        return { success: true };
      } catch (error: any) {
        console.error(`Error deleting app ${appId} from database:`, error);
        throw new Error(`Failed to delete app from database: ${error.message}`);
      }
    });
  });

  ipcMain.handle(
    "rename-app",
    async (
      _,
      {
        appId,
        appName,
        appPath,
      }: { appId: number; appName: string; appPath: string }
    ) => {
      return withLock(appId, async () => {
        // Check if app exists
        const app = await db.query.apps.findFirst({
          where: eq(apps.id, appId),
        });

        if (!app) {
          throw new Error("App not found");
        }

        // Check for conflicts with existing apps
        const nameConflict = await db.query.apps.findFirst({
          where: eq(apps.name, appName),
        });

        const pathConflict = await db.query.apps.findFirst({
          where: eq(apps.path, appPath),
        });

        if (nameConflict && nameConflict.id !== appId) {
          throw new Error(`An app with the name '${appName}' already exists`);
        }

        if (pathConflict && pathConflict.id !== appId) {
          throw new Error(`An app with the path '${appPath}' already exists`);
        }

        // Stop the app if it's running
        if (runningApps.has(appId)) {
          const appInfo = runningApps.get(appId)!;
          try {
            await killProcess(appInfo.process);
            runningApps.delete(appId);
          } catch (error: any) {
            console.error(
              `Error stopping app ${appId} before renaming:`,
              error
            );
            throw new Error(
              `Failed to stop app before renaming: ${error.message}`
            );
          }
        }

        const oldAppPath = getDyadAppPath(app.path);
        const newAppPath = getDyadAppPath(appPath);
        // Only move files if needed
        if (newAppPath !== oldAppPath) {
          // Move app files
          try {
            // Check if destination directory already exists
            if (fs.existsSync(newAppPath)) {
              throw new Error(
                `Destination path '${newAppPath}' already exists`
              );
            }

            // Create parent directory if it doesn't exist
            await fsPromises.mkdir(path.dirname(newAppPath), {
              recursive: true,
            });

            // Move the files
            await fsPromises.rename(oldAppPath, newAppPath);
          } catch (error: any) {
            console.error(
              `Error moving app files from ${oldAppPath} to ${newAppPath}:`,
              error
            );
            throw new Error(`Failed to move app files: ${error.message}`);
          }
        }

        // Update app in database
        try {
          const [updatedApp] = await db
            .update(apps)
            .set({
              name: appName,
              path: appPath,
            })
            .where(eq(apps.id, appId))
            .returning();

          return { success: true, app: updatedApp };
        } catch (error: any) {
          // Attempt to rollback the file move
          if (newAppPath !== oldAppPath) {
            try {
              await fsPromises.rename(newAppPath, oldAppPath);
            } catch (rollbackError) {
              console.error(
                `Failed to rollback file move during rename error:`,
                rollbackError
              );
            }
          }

          console.error(`Error updating app ${appId} in database:`, error);
          throw new Error(`Failed to update app in database: ${error.message}`);
        }
      });
    }
  );

  ipcMain.handle("reset-all", async () => {
    // Terminate static server worker if it's running
    if (staticServerWorker) {
      console.log(`Terminating static server worker on reset-all command.`);
      await staticServerWorker.terminate();
      staticServerWorker = null;
      staticServerPort = null;
      staticServerRootDir = null;
    }
    // Stop all running apps first
    const runningAppIds = Array.from(runningApps.keys());
    for (const appId of runningAppIds) {
      try {
        const appInfo = runningApps.get(appId)!;
        await killProcess(appInfo.process);
        runningApps.delete(appId);
      } catch (error) {
        console.error(`Error stopping app ${appId} during reset:`, error);
        // Continue with reset even if stopping fails
      }
    }

    // 1. Remove all app files recursively
    const dyadAppPath = getDyadAppPath(".");
    if (fs.existsSync(dyadAppPath)) {
      await fsPromises.rm(dyadAppPath, { recursive: true, force: true });
      // Recreate the base directory
      await fsPromises.mkdir(dyadAppPath, { recursive: true });
    }

    // 2. Drop the database by deleting the SQLite file
    const dbPath = getDatabasePath();
    if (fs.existsSync(dbPath)) {
      // Close database connections first
      if (db.$client) {
        db.$client.close();
      }
      await fsPromises.unlink(dbPath);
      console.log(`Database file deleted: ${dbPath}`);
    }

    // 3. Remove settings
    const userDataPath = getUserDataPath();
    const settingsPath = path.join(userDataPath, "user-settings.json");

    if (fs.existsSync(settingsPath)) {
      await fsPromises.unlink(settingsPath);
      console.log(`Settings file deleted: ${settingsPath}`);
    }

    return { success: true, message: "Successfully reset everything" };
  });
}
