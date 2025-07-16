import { ipcMain, BrowserWindow, IpcMainInvokeEvent } from "electron";
import fetch from "node-fetch";
import { writeSettings, readSettings } from "../../main/settings";
import * as schema from "../../db/schema";
import { db } from "../../db";
import { apps } from "../../db/schema";
import { eq } from "drizzle-orm";
import log from "electron-log";
import { IS_TEST_BUILD } from "../utils/test_utils";

const logger = log.scope("vercel_handlers");

// --- Vercel OAuth Constants ---
const VERCEL_CLIENT_ID =
  process.env.VERCEL_CLIENT_ID || "your-vercel-client-id";

// Use test server URLs when in test mode
const TEST_SERVER_BASE = "http://localhost:3500";

const VERCEL_OAUTH_TOKEN_URL = IS_TEST_BUILD
  ? `${TEST_SERVER_BASE}/vercel/oauth/access_token`
  : "https://api.vercel.com/v2/oauth/access_token";
const VERCEL_API_BASE = IS_TEST_BUILD
  ? `${TEST_SERVER_BASE}/vercel/api`
  : "https://api.vercel.com";

const VERCEL_SCOPES =
  "read:project,write:project,read:deployment,write:deployment";

// --- State Management ---
interface DeviceFlowState {
  deviceCode: string;
  interval: number;
  timeoutId: NodeJS.Timeout | null;
  isPolling: boolean;
  window: BrowserWindow | null;
}

let currentFlowState: DeviceFlowState | null = null;

function stopPolling() {
  if (currentFlowState?.timeoutId) {
    clearTimeout(currentFlowState.timeoutId);
    currentFlowState.timeoutId = null;
  }
  if (currentFlowState) {
    currentFlowState.isPolling = false;
  }
}

async function pollForAccessToken(event: IpcMainInvokeEvent) {
  if (!currentFlowState || !currentFlowState.isPolling) {
    logger.debug("[Vercel Handler] Polling stopped or no active flow.");
    return;
  }

  const { deviceCode, interval } = currentFlowState;

  logger.debug("[Vercel Handler] Polling for token with device code");
  event.sender.send("vercel:flow-update", {
    message: "Polling Vercel for authorization...",
  });

  try {
    // For now, simulate the OAuth flow since Vercel doesn't have device flow like GitHub
    // In a real implementation, you'd use Vercel's OAuth flow
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Simulate successful authentication
    const accessToken = "test-vercel-token";

    logger.log("Successfully obtained Vercel Access Token.");
    event.sender.send("vercel:flow-success", {
      message: "Successfully connected!",
    });

    writeSettings({
      vercelAccessToken: {
        value: accessToken,
      },
    });

    stopPolling();
  } catch (error: any) {
    logger.error("Error during Vercel polling:", error);
    event.sender.send("vercel:flow-error", {
      error: `Failed to authenticate with Vercel: ${error.message}`,
    });
    stopPolling();
  }
}

// --- IPC Handlers ---

function handleStartVercelFlow(
  event: IpcMainInvokeEvent,
  args: { appId: number | null },
) {
  logger.debug(`Received vercel:start-flow for appId: ${args.appId}`);

  if (currentFlowState && currentFlowState.isPolling) {
    logger.warn("Another Vercel flow is already in progress.");
    event.sender.send("vercel:flow-error", {
      error: "Another connection process is already active.",
    });
    return;
  }

  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) {
    logger.error("Could not get BrowserWindow instance.");
    return;
  }

  currentFlowState = {
    deviceCode: "test-device-code",
    interval: 5,
    timeoutId: null,
    isPolling: false,
    window: window,
  };

  event.sender.send("vercel:flow-update", {
    message: "Starting Vercel authentication...",
  });

  // Simulate device flow for now
  setTimeout(() => {
    if (!currentFlowState) return;

    currentFlowState.isPolling = true;

    // Send simulated user code and verification URI
    event.sender.send("vercel:flow-update", {
      userCode: "ABCD-1234",
      verificationUri: "https://vercel.com/login/device",
      message: "Please authorize in your browser.",
    });

    // Start polling
    currentFlowState.timeoutId = setTimeout(
      () => pollForAccessToken(event),
      currentFlowState.interval * 1000,
    );
  }, 1000);
}

// --- Vercel List Projects Handler ---
async function handleListVercelProjects(): Promise<
  { id: string; name: string; framework: string | null }[]
> {
  try {
    const settings = readSettings();
    const accessToken = settings.vercelAccessToken?.value;
    if (!accessToken) {
      throw new Error("Not authenticated with Vercel.");
    }

    // For now, return mock data
    // In a real implementation, you'd call Vercel's API
    return [
      { id: "prj_1", name: "my-app", framework: "nextjs" },
      { id: "prj_2", name: "another-project", framework: "react" },
      { id: "prj_3", name: "static-site", framework: null },
    ];
  } catch (err: any) {
    logger.error("[Vercel Handler] Failed to list projects:", err);
    throw new Error(err.message || "Failed to list Vercel projects.");
  }
}

// --- Vercel Project Availability Handler ---
async function handleIsProjectAvailable(
  event: IpcMainInvokeEvent,
  { name }: { name: string },
): Promise<{ available: boolean; error?: string }> {
  try {
    const settings = readSettings();
    const accessToken = settings.vercelAccessToken?.value;
    if (!accessToken) {
      return { available: false, error: "Not authenticated with Vercel." };
    }

    // For now, simulate availability check
    // In a real implementation, you'd check against Vercel's API
    const unavailableNames = ["vercel", "nextjs", "react", "test"];
    const isAvailable = !unavailableNames.includes(name.toLowerCase());

    return {
      available: isAvailable,
      error: isAvailable ? undefined : "Project name is not available.",
    };
  } catch (err: any) {
    return { available: false, error: err.message || "Unknown error" };
  }
}

// --- Vercel Create Project Handler ---
async function handleCreateProject(
  event: IpcMainInvokeEvent,
  { name, appId }: { name: string; appId: number },
): Promise<void> {
  const settings = readSettings();
  const accessToken = settings.vercelAccessToken?.value;
  if (!accessToken) {
    throw new Error("Not authenticated with Vercel.");
  }

  // For now, simulate project creation
  // In a real implementation, you'd call Vercel's API to create the project
  logger.info(`Creating Vercel project: ${name} for app ${appId}`);

  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Store project info in the app's DB row
  await updateAppVercelProject({
    appId,
    projectId: `prj_${Date.now()}`,
    projectName: name,
    teamId: null,
    deploymentUrl: `https://${name}.vercel.app`,
  });
}

// --- Vercel Connect to Existing Project Handler ---
async function handleConnectToExistingProject(
  event: IpcMainInvokeEvent,
  { projectId, appId }: { projectId: string; appId: number },
): Promise<void> {
  try {
    const settings = readSettings();
    const accessToken = settings.vercelAccessToken?.value;
    if (!accessToken) {
      throw new Error("Not authenticated with Vercel.");
    }

    // For now, simulate connecting to existing project
    // In a real implementation, you'd verify the project exists via Vercel's API
    logger.info(
      `Connecting to existing Vercel project: ${projectId} for app ${appId}`,
    );

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Store project info in the app's DB row
    await updateAppVercelProject({
      appId,
      projectId,
      projectName: `project-${projectId}`,
      teamId: null,
      deploymentUrl: `https://project-${projectId}.vercel.app`,
    });
  } catch (err: any) {
    logger.error(
      "[Vercel Handler] Failed to connect to existing project:",
      err,
    );
    throw new Error(err.message || "Failed to connect to existing project.");
  }
}

// --- Vercel Deploy Handler ---
async function handleDeployToVercel(
  event: IpcMainInvokeEvent,
  { appId }: { appId: number },
): Promise<{ success: boolean; error?: string }> {
  try {
    const settings = readSettings();
    const accessToken = settings.vercelAccessToken?.value;
    if (!accessToken) {
      return { success: false, error: "Not authenticated with Vercel." };
    }

    const app = await db.query.apps.findFirst({ where: eq(apps.id, appId) });
    if (!app || !app.vercelProjectId) {
      return {
        success: false,
        error: "App is not linked to a Vercel project.",
      };
    }

    // For now, simulate deployment
    // In a real implementation, you'd trigger a deployment via Vercel's API
    logger.info(
      `Deploying to Vercel project: ${app.vercelProjectId} for app ${appId}`,
    );

    // Simulate deployment delay
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Update deployment URL
    const newDeploymentUrl = `https://${app.vercelProjectName}-${Date.now()}.vercel.app`;
    await db
      .update(apps)
      .set({ vercelDeploymentUrl: newDeploymentUrl })
      .where(eq(apps.id, appId));

    return { success: true };
  } catch (err: any) {
    logger.error("[Vercel Handler] Failed to deploy:", err);
    return {
      success: false,
      error: err.message || "Failed to deploy to Vercel.",
    };
  }
}

async function handleDisconnectVercelProject(
  event: IpcMainInvokeEvent,
  { appId }: { appId: number },
): Promise<void> {
  logger.log(`Disconnecting Vercel project for appId: ${appId}`);

  const app = await db.query.apps.findFirst({
    where: eq(apps.id, appId),
  });

  if (!app) {
    throw new Error("App not found");
  }

  // Update app in database to remove Vercel project info
  await db
    .update(apps)
    .set({
      vercelProjectId: null,
      vercelProjectName: null,
      vercelTeamId: null,
      vercelDeploymentUrl: null,
    })
    .where(eq(apps.id, appId));
}

// --- Registration ---
export function registerVercelHandlers() {
  ipcMain.handle("vercel:start-flow", handleStartVercelFlow);
  ipcMain.handle("vercel:list-projects", handleListVercelProjects);
  ipcMain.handle("vercel:is-project-available", handleIsProjectAvailable);
  ipcMain.handle("vercel:create-project", handleCreateProject);
  ipcMain.handle(
    "vercel:connect-existing-project",
    handleConnectToExistingProject,
  );
  ipcMain.handle("vercel:deploy", handleDeployToVercel);
  ipcMain.handle("vercel:disconnect", handleDisconnectVercelProject);
}

export async function updateAppVercelProject({
  appId,
  projectId,
  projectName,
  teamId,
  deploymentUrl,
}: {
  appId: number;
  projectId: string;
  projectName: string;
  teamId?: string | null;
  deploymentUrl?: string | null;
}): Promise<void> {
  await db
    .update(schema.apps)
    .set({
      vercelProjectId: projectId,
      vercelProjectName: projectName,
      vercelTeamId: teamId,
      vercelDeploymentUrl: deploymentUrl,
    })
    .where(eq(schema.apps.id, appId));
}
