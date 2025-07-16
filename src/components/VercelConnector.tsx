import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  ExternalLink,
  Clipboard,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Globe,
} from "lucide-react";
import { IpcClient } from "@/ipc/ipc_client";
import { useSettings } from "@/hooks/useSettings";
import { useLoadApp } from "@/hooks/useLoadApp";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface VercelConnectorProps {
  appId: number | null;
  folderName: string;
}

interface VercelProject {
  id: string;
  name: string;
  framework: string | null;
}

interface ConnectedVercelConnectorProps {
  appId: number;
  app: any;
  refreshApp: () => void;
}

interface UnconnectedVercelConnectorProps {
  appId: number | null;
  folderName: string;
  settings: any;
  refreshSettings: () => void;
  refreshApp: () => void;
}

function ConnectedVercelConnector({
  appId,
  app,
  refreshApp,
}: ConnectedVercelConnectorProps) {
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [deploySuccess, setDeploySuccess] = useState<boolean>(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  const handleDisconnectProject = async () => {
    setIsDisconnecting(true);
    setDisconnectError(null);
    try {
      await IpcClient.getInstance().disconnectVercelProject(appId);
      refreshApp();
    } catch (err: any) {
      setDisconnectError(err.message || "Failed to disconnect project.");
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleDeploy = async () => {
    setIsDeploying(true);
    setDeployError(null);
    setDeploySuccess(false);

    try {
      const result = await IpcClient.getInstance().deployToVercel(appId);
      if (result.success) {
        setDeploySuccess(true);
        refreshApp(); // Refresh to get updated deployment URL
      } else {
        setDeployError(result.error || "Failed to deploy to Vercel.");
      }
    } catch (err: any) {
      setDeployError(err.message || "Failed to deploy to Vercel.");
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div
      className="mt-4 w-full border border-gray-200 rounded-md p-4"
      data-testid="vercel-connected-project"
    >
      <p>Connected to Vercel Project:</p>
      <a
        onClick={(e) => {
          e.preventDefault();
          IpcClient.getInstance().openExternalUrl(
            `https://vercel.com/${app.vercelTeamId ? `${app.vercelTeamId}/` : ""}${app.vercelProjectName}`,
          );
        }}
        className="cursor-pointer text-blue-600 hover:underline dark:text-blue-400"
        target="_blank"
        rel="noopener noreferrer"
      >
        {app.vercelTeamId ? `${app.vercelTeamId}/` : ""}
        {app.vercelProjectName}
      </a>
      {app.vercelDeploymentUrl && (
        <div className="mt-2">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Live URL:{" "}
            <a
              onClick={(e) => {
                e.preventDefault();
                IpcClient.getInstance().openExternalUrl(
                  app.vercelDeploymentUrl,
                );
              }}
              className="cursor-pointer text-blue-600 hover:underline dark:text-blue-400 font-mono"
              target="_blank"
              rel="noopener noreferrer"
            >
              {app.vercelDeploymentUrl}
            </a>
          </p>
        </div>
      )}
      <div className="mt-2 flex gap-2">
        <Button onClick={handleDeploy} disabled={isDeploying}>
          {isDeploying ? (
            <>
              <svg
                className="animate-spin h-5 w-5 mr-2 inline"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                style={{ display: "inline" }}
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Deploying...
            </>
          ) : (
            "Deploy to Vercel"
          )}
        </Button>
        <Button
          onClick={handleDisconnectProject}
          disabled={isDisconnecting}
          variant="outline"
        >
          {isDisconnecting ? "Disconnecting..." : "Disconnect from project"}
        </Button>
      </div>
      {deployError && (
        <div className="mt-2">
          <p className="text-red-600">
            {deployError}{" "}
            <a
              onClick={(e) => {
                e.preventDefault();
                IpcClient.getInstance().openExternalUrl(
                  "https://vercel.com/docs/troubleshooting",
                );
              }}
              className="cursor-pointer text-blue-600 hover:underline dark:text-blue-400"
              target="_blank"
              rel="noopener noreferrer"
            >
              See troubleshooting guide
            </a>
          </p>
        </div>
      )}
      {deploySuccess && (
        <p className="text-green-600 mt-2">Successfully deployed to Vercel!</p>
      )}
      {disconnectError && (
        <p className="text-red-600 mt-2">{disconnectError}</p>
      )}
    </div>
  );
}

function UnconnectedVercelConnector({
  appId,
  folderName,
  settings,
  refreshSettings,
  refreshApp,
}: UnconnectedVercelConnectorProps) {
  // --- Collapsible State ---
  const [isExpanded, setIsExpanded] = useState(false);

  // --- Vercel OAuth State ---
  const [vercelUserCode, setVercelUserCode] = useState<string | null>(null);
  const [vercelVerificationUri, setVercelVerificationUri] = useState<
    string | null
  >(null);
  const [vercelError, setVercelError] = useState<string | null>(null);
  const [isConnectingToVercel, setIsConnectingToVercel] = useState(false);
  const [vercelStatusMessage, setVercelStatusMessage] = useState<string | null>(
    null,
  );
  const [codeCopied, setCodeCopied] = useState(false);

  // --- Project Setup State ---
  const [projectSetupMode, setProjectSetupMode] = useState<
    "create" | "existing"
  >("create");
  const [availableProjects, setAvailableProjects] = useState<VercelProject[]>(
    [],
  );
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>("");

  // Create new project state
  const [projectName, setProjectName] = useState(folderName);
  const [projectAvailable, setProjectAvailable] = useState<boolean | null>(
    null,
  );
  const [projectCheckError, setProjectCheckError] = useState<string | null>(
    null,
  );
  const [isCheckingProject, setIsCheckingProject] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [createProjectError, setCreateProjectError] = useState<string | null>(
    null,
  );
  const [createProjectSuccess, setCreateProjectSuccess] =
    useState<boolean>(false);

  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!appId) return; // Don't set up listeners if appId is null initially

    const cleanupFunctions: (() => void)[] = [];

    // Listener for updates (user code, verification uri, status messages)
    const removeUpdateListener =
      IpcClient.getInstance().onVercelDeviceFlowUpdate((data) => {
        console.log("Received vercel:flow-update", data);
        if (data.userCode) {
          setVercelUserCode(data.userCode);
        }
        if (data.verificationUri) {
          setVercelVerificationUri(data.verificationUri);
        }
        if (data.message) {
          setVercelStatusMessage(data.message);
        }

        setVercelError(null); // Clear previous errors on new update
        if (!data.userCode && !data.verificationUri && data.message) {
          // Likely just a status message, keep connecting state
          setIsConnectingToVercel(true);
        }
        if (data.userCode && data.verificationUri) {
          setIsConnectingToVercel(true); // Still connecting until success/error
        }
      });
    cleanupFunctions.push(removeUpdateListener);

    // Listener for success
    const removeSuccessListener =
      IpcClient.getInstance().onVercelDeviceFlowSuccess((data) => {
        console.log("Received vercel:flow-success", data);
        setVercelStatusMessage("Successfully connected to Vercel!");
        setVercelUserCode(null); // Clear user-facing info
        setVercelVerificationUri(null);
        setVercelError(null);
        setIsConnectingToVercel(false);
        refreshSettings();
        setIsExpanded(true);
      });
    cleanupFunctions.push(removeSuccessListener);

    // Listener for errors
    const removeErrorListener = IpcClient.getInstance().onVercelDeviceFlowError(
      (data) => {
        console.log("Received vercel:flow-error", data);
        setVercelError(data.error || "An unknown error occurred.");
        setVercelStatusMessage(null);
        setVercelUserCode(null);
        setVercelVerificationUri(null);
        setIsConnectingToVercel(false);
      },
    );
    cleanupFunctions.push(removeErrorListener);

    // Cleanup function to remove all listeners when component unmounts or appId changes
    return () => {
      cleanupFunctions.forEach((cleanup) => cleanup());
      // Reset state when appId changes or component unmounts
      setVercelUserCode(null);
      setVercelVerificationUri(null);
      setVercelError(null);
      setIsConnectingToVercel(false);
      setVercelStatusMessage(null);
    };
  }, [appId, refreshSettings]); // Re-run effect if appId changes

  // Load available projects when Vercel is connected
  useEffect(() => {
    if (settings?.vercelAccessToken && projectSetupMode === "existing") {
      loadAvailableProjects();
    }
  }, [settings?.vercelAccessToken, projectSetupMode]);

  const loadAvailableProjects = async () => {
    setIsLoadingProjects(true);
    try {
      const projects = await IpcClient.getInstance().listVercelProjects();
      setAvailableProjects(projects);
    } catch (error) {
      console.error("Failed to load Vercel projects:", error);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const handleConnectToVercel = async () => {
    if (!appId) return;
    setIsConnectingToVercel(true);
    setVercelError(null);
    setVercelUserCode(null);
    setVercelVerificationUri(null);
    setVercelStatusMessage("Requesting device code from Vercel...");

    // Send IPC message to main process to start the Vercel OAuth flow
    IpcClient.getInstance().startVercelDeviceFlow(appId);
  };

  const checkProjectAvailability = useCallback(async (name: string) => {
    setProjectCheckError(null);
    setProjectAvailable(null);
    if (!name) return;
    setIsCheckingProject(true);
    try {
      const result =
        await IpcClient.getInstance().checkVercelProjectAvailable(name);
      setProjectAvailable(result.available);
      if (!result.available) {
        setProjectCheckError(result.error || "Project name is not available.");
      }
    } catch (err: any) {
      setProjectCheckError(
        err.message || "Failed to check project availability.",
      );
    } finally {
      setIsCheckingProject(false);
    }
  }, []);

  const debouncedCheckProjectAvailability = useCallback(
    (name: string) => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      debounceTimeoutRef.current = setTimeout(() => {
        checkProjectAvailability(name);
      }, 500);
    },
    [checkProjectAvailability],
  );

  const handleSetupProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appId) return;

    setCreateProjectError(null);
    setIsCreatingProject(true);
    setCreateProjectSuccess(false);

    try {
      if (projectSetupMode === "create") {
        await IpcClient.getInstance().createVercelProject(projectName, appId);
      } else {
        await IpcClient.getInstance().connectToExistingVercelProject(
          selectedProject,
          appId,
        );
      }
      setCreateProjectSuccess(true);
      setProjectCheckError(null);
      refreshApp();
    } catch (err: any) {
      setCreateProjectError(
        err.message ||
          `Failed to ${projectSetupMode === "create" ? "create" : "connect to"} project.`,
      );
    } finally {
      setIsCreatingProject(false);
    }
  };

  if (!settings?.vercelAccessToken) {
    return (
      <div className="mt-1 w-full" data-testid="vercel-unconnected-project">
        <Button
          onClick={handleConnectToVercel}
          className="cursor-pointer w-full py-5 flex justify-center items-center gap-2"
          size="lg"
          variant="outline"
          disabled={isConnectingToVercel || !appId}
        >
          Connect to Vercel
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M24 22.525H0l12-21.05 12 21.05z" />
          </svg>
          {isConnectingToVercel && (
            <svg
              className="animate-spin h-5 w-5 ml-2"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          )}
        </Button>
        {/* Vercel Connection Status/Instructions */}
        {(vercelUserCode || vercelStatusMessage || vercelError) && (
          <div className="mt-6 p-4 border rounded-md bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600">
            <h4 className="font-medium mb-2">Vercel Connection</h4>
            {vercelError && (
              <p className="text-red-600 dark:text-red-400 mb-2">
                {vercelError}
              </p>
            )}
            {vercelUserCode && vercelVerificationUri && (
              <div className="mb-2">
                <p>
                  1. Go to:
                  <a
                    href={vercelVerificationUri}
                    onClick={(e) => {
                      e.preventDefault();
                      IpcClient.getInstance().openExternalUrl(
                        vercelVerificationUri,
                      );
                    }}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {vercelVerificationUri}
                  </a>
                </p>
                <p>
                  2. Enter code:
                  <strong className="ml-1 font-mono text-lg tracking-wider bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded">
                    {vercelUserCode}
                  </strong>
                  <button
                    className="ml-2 p-1 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 focus:outline-none"
                    onClick={() => {
                      if (vercelUserCode) {
                        navigator.clipboard
                          .writeText(vercelUserCode)
                          .then(() => {
                            setCodeCopied(true);
                            setTimeout(() => setCodeCopied(false), 2000);
                          })
                          .catch((err) =>
                            console.error("Failed to copy code:", err),
                          );
                      }
                    }}
                    title="Copy to clipboard"
                  >
                    {codeCopied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Clipboard className="h-4 w-4" />
                    )}
                  </button>
                </p>
              </div>
            )}
            {vercelStatusMessage && (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {vercelStatusMessage}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="mt-4 w-full border border-gray-200 rounded-md"
      data-testid="vercel-setup-project"
    >
      {/* Collapsible Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={`cursor-pointer w-full p-4 text-left transition-colors rounded-md flex items-center justify-between ${
          !isExpanded ? "hover:bg-gray-50 dark:hover:bg-gray-800/50" : ""
        }`}
      >
        <span className="font-medium">Set up your Vercel project</span>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-500" />
        )}
      </button>

      {/* Collapsible Content */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="p-4 pt-0 space-y-4">
          {/* Mode Selection */}
          <div>
            <div className="flex rounded-md border border-gray-200 dark:border-gray-700">
              <Button
                type="button"
                variant={projectSetupMode === "create" ? "default" : "ghost"}
                className={`flex-1 rounded-none rounded-l-md border-0 ${
                  projectSetupMode === "create"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
                onClick={() => {
                  setProjectSetupMode("create");
                  setCreateProjectError(null);
                  setCreateProjectSuccess(false);
                }}
              >
                Create new project
              </Button>
              <Button
                type="button"
                variant={projectSetupMode === "existing" ? "default" : "ghost"}
                className={`flex-1 rounded-none rounded-r-md border-0 border-l border-gray-200 dark:border-gray-700 ${
                  projectSetupMode === "existing"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
                onClick={() => {
                  setProjectSetupMode("existing");
                  setCreateProjectError(null);
                  setCreateProjectSuccess(false);
                }}
              >
                Connect to existing project
              </Button>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSetupProject}>
            {projectSetupMode === "create" ? (
              <>
                <div>
                  <Label className="block text-sm font-medium">
                    Project Name
                  </Label>
                  <Input
                    data-testid="vercel-create-project-name-input"
                    className="w-full mt-1"
                    value={projectName}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setProjectName(newValue);
                      setProjectAvailable(null);
                      setProjectCheckError(null);
                      debouncedCheckProjectAvailability(newValue);
                    }}
                    disabled={isCreatingProject}
                  />
                  {isCheckingProject && (
                    <p className="text-xs text-gray-500 mt-1">
                      Checking availability...
                    </p>
                  )}
                  {projectAvailable === true && (
                    <p className="text-xs text-green-600 mt-1">
                      Project name is available!
                    </p>
                  )}
                  {projectAvailable === false && (
                    <p className="text-xs text-red-600 mt-1">
                      {projectCheckError}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label className="block text-sm font-medium">
                    Select Project
                  </Label>
                  <Select
                    value={selectedProject}
                    onValueChange={setSelectedProject}
                    disabled={isLoadingProjects}
                  >
                    <SelectTrigger
                      className="w-full mt-1"
                      data-testid="vercel-project-select"
                    >
                      <SelectValue
                        placeholder={
                          isLoadingProjects
                            ? "Loading projects..."
                            : "Select a project"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProjects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}{" "}
                          {project.framework && `(${project.framework})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <Button
              type="submit"
              disabled={
                isCreatingProject ||
                (projectSetupMode === "create" &&
                  (projectAvailable === false || !projectName)) ||
                (projectSetupMode === "existing" && !selectedProject)
              }
            >
              {isCreatingProject
                ? projectSetupMode === "create"
                  ? "Creating..."
                  : "Connecting..."
                : projectSetupMode === "create"
                  ? "Create Project"
                  : "Connect to Project"}
            </Button>
          </form>

          {createProjectError && (
            <p className="text-red-600 mt-2">{createProjectError}</p>
          )}
          {createProjectSuccess && (
            <p className="text-green-600 mt-2">
              {projectSetupMode === "create"
                ? "Project created and linked!"
                : "Connected to project!"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function VercelConnector({ appId, folderName }: VercelConnectorProps) {
  const { app, refreshApp } = useLoadApp(appId);
  const { settings, refreshSettings } = useSettings();

  if (app?.vercelProjectId && appId) {
    return (
      <ConnectedVercelConnector
        appId={appId}
        app={app}
        refreshApp={refreshApp}
      />
    );
  } else {
    return (
      <UnconnectedVercelConnector
        appId={appId}
        folderName={folderName}
        settings={settings}
        refreshSettings={refreshSettings}
        refreshApp={refreshApp}
      />
    );
  }
}
