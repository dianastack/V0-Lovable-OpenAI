import { createLoggedHandler } from "./safe_handle";
import log from "electron-log";
import { db } from "../../db";
import { apps } from "../../db/schema";
import { eq } from "drizzle-orm";
import { getDyadAppPath } from "../../paths/paths";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const logger = log.scope("capacitor_handlers");
const handle = createLoggedHandler(logger);

async function simpleSpawn({
  command,
  cwd,
  successMessage,
  errorPrefix,
}: {
  command: string;
  cwd: string;
  successMessage: string;
  errorPrefix: string;
}): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    logger.info(`Running: ${command}`);
    const process = spawn(command, {
      cwd,
      shell: true,
      stdio: "pipe",
    });

    let stdout = "";
    let stderr = "";

    process.stdout?.on("data", (data) => {
      const output = data.toString();
      stdout += output;
      logger.info(output);
    });

    process.stderr?.on("data", (data) => {
      const output = data.toString();
      stderr += output;
      logger.error(output);
    });

    process.on("close", (code) => {
      if (code === 0) {
        logger.info(successMessage);
        resolve();
      } else {
        logger.error(`${errorPrefix}, exit code ${code}`);
        const errorMessage = `${errorPrefix} (exit code ${code})\n\nSTDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`;
        reject(new Error(errorMessage));
      }
    });

    process.on("error", (err) => {
      logger.error(`Failed to spawn command: ${command}`, err);
      const errorMessage = `Failed to spawn command: ${err.message}\n\nSTDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`;
      reject(new Error(errorMessage));
    });
  });
}

async function getApp(appId: number) {
  const app = await db.query.apps.findFirst({
    where: eq(apps.id, appId),
  });
  if (!app) {
    throw new Error(`App with id ${appId} not found`);
  }
  return app;
}

function isCapacitorInstalled(appPath: string): boolean {
  const capacitorConfigJs = path.join(appPath, "capacitor.config.js");
  const capacitorConfigTs = path.join(appPath, "capacitor.config.ts");
  const capacitorConfigJson = path.join(appPath, "capacitor.config.json");

  return (
    fs.existsSync(capacitorConfigJs) ||
    fs.existsSync(capacitorConfigTs) ||
    fs.existsSync(capacitorConfigJson)
  );
}

export function registerCapacitorHandlers() {
  handle(
    "is-capacitor",
    async (_, { appId }: { appId: number }): Promise<boolean> => {
      const app = await getApp(appId);
      const appPath = getDyadAppPath(app.path);
      return isCapacitorInstalled(appPath);
    },
  );

  handle(
    "sync-capacitor",
    async (_, { appId }: { appId: number }): Promise<void> => {
      const app = await getApp(appId);
      const appPath = getDyadAppPath(app.path);

      if (!isCapacitorInstalled(appPath)) {
        throw new Error("Capacitor is not installed in this app");
      }

      await simpleSpawn({
        command: "npm run build",
        cwd: appPath,
        successMessage: "App built successfully",
        errorPrefix: "Failed to build app",
      });

      await simpleSpawn({
        command: "npx cap sync",
        cwd: appPath,
        successMessage: "Capacitor sync completed successfully",
        errorPrefix: "Failed to sync Capacitor",
      });
    },
  );

  handle("open-ios", async (_, { appId }: { appId: number }): Promise<void> => {
    const app = await getApp(appId);
    const appPath = getDyadAppPath(app.path);

    if (!isCapacitorInstalled(appPath)) {
      throw new Error("Capacitor is not installed in this app");
    }

    await simpleSpawn({
      command: "npx cap open ios",
      cwd: appPath,
      successMessage: "iOS project opened successfully",
      errorPrefix: "Failed to open iOS project",
    });
  });

  handle(
    "open-android",
    async (_, { appId }: { appId: number }): Promise<void> => {
      const app = await getApp(appId);
      const appPath = getDyadAppPath(app.path);

      if (!isCapacitorInstalled(appPath)) {
        throw new Error("Capacitor is not installed in this app");
      }

      await simpleSpawn({
        command: "npx cap open android",
        cwd: appPath,
        successMessage: "Android project opened successfully",
        errorPrefix: "Failed to open Android project",
      });
    },
  );
}
