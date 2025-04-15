import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Github } from "lucide-react";
import { IpcClient } from "@/ipc/ipc_client";
import { useSettings } from "@/hooks/useSettings";

interface GitHubConnectorProps {
  appId: number | null;
}

export function GitHubConnector({ appId }: GitHubConnectorProps) {
  // --- GitHub Device Flow State ---
  const { settings, refreshSettings } = useSettings();
  const [githubUserCode, setGithubUserCode] = useState<string | null>(null);
  const [githubVerificationUri, setGithubVerificationUri] = useState<
    string | null
  >(null);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [isConnectingToGithub, setIsConnectingToGithub] = useState(false);
  const [githubStatusMessage, setGithubStatusMessage] = useState<string | null>(
    null
  );
  // --- ---

  const handleConnectToGithub = async () => {
    if (!appId) return;
    setIsConnectingToGithub(true);
    setGithubError(null);
    setGithubUserCode(null);
    setGithubVerificationUri(null);
    setGithubStatusMessage("Requesting device code from GitHub...");

    // Send IPC message to main process to start the flow
    IpcClient.getInstance().startGithubDeviceFlow(appId);
  };

  useEffect(() => {
    if (!appId) return; // Don't set up listeners if appId is null initially

    const cleanupFunctions: (() => void)[] = [];

    // Listener for updates (user code, verification uri, status messages)
    const removeUpdateListener =
      IpcClient.getInstance().onGithubDeviceFlowUpdate((data) => {
        console.log("Received github:flow-update", data);
        if (data.userCode) {
          setGithubUserCode(data.userCode);
        }
        if (data.verificationUri) {
          setGithubVerificationUri(data.verificationUri);
        }
        if (data.message) {
          setGithubStatusMessage(data.message);
        }

        setGithubError(null); // Clear previous errors on new update
        if (!data.userCode && !data.verificationUri && data.message) {
          // Likely just a status message, keep connecting state
          setIsConnectingToGithub(true);
        }
        if (data.userCode && data.verificationUri) {
          setIsConnectingToGithub(true); // Still connecting until success/error
        }
      });
    cleanupFunctions.push(removeUpdateListener);

    // Listener for success
    const removeSuccessListener =
      IpcClient.getInstance().onGithubDeviceFlowSuccess((data) => {
        console.log("Received github:flow-success", data);
        setGithubStatusMessage("Successfully connected to GitHub!");
        setGithubUserCode(null); // Clear user-facing info
        setGithubVerificationUri(null);
        setGithubError(null);
        setIsConnectingToGithub(false);
        refreshSettings();
        // TODO: Maybe update parent UI to show "Connected" state or trigger next action
      });
    cleanupFunctions.push(removeSuccessListener);

    // Listener for errors
    const removeErrorListener = IpcClient.getInstance().onGithubDeviceFlowError(
      (data) => {
        console.log("Received github:flow-error", data);
        setGithubError(data.error || "An unknown error occurred.");
        setGithubStatusMessage(null);
        setGithubUserCode(null);
        setGithubVerificationUri(null);
        setIsConnectingToGithub(false);
      }
    );
    cleanupFunctions.push(removeErrorListener);

    // Cleanup function to remove all listeners when component unmounts or appId changes
    return () => {
      cleanupFunctions.forEach((cleanup) => cleanup());
      // Optional: Send a message to main process to cancel polling if component unmounts
      // Only cancel if we were actually connecting for this specific appId
      // IpcClient.getInstance().cancelGithubDeviceFlow(appId);
      // Reset state when appId changes or component unmounts
      setGithubUserCode(null);
      setGithubVerificationUri(null);
      setGithubError(null);
      setIsConnectingToGithub(false);
      setGithubStatusMessage(null);
    };
  }, [appId]); // Re-run effect if appId changes

  if (settings?.githubSettings.secrets) {
    return (
      <div className="mt-4 w-full">
        <p>Connected to GitHub!</p>
      </div>
    );
  }

  return (
    <div className="mt-4 w-full">
      {" "}
      <Button
        onClick={handleConnectToGithub}
        className="cursor-pointer w-full py-6 flex justify-center items-center gap-2 text-lg"
        size="lg"
        variant="outline"
        disabled={isConnectingToGithub || !appId} // Also disable if appId is null
      >
        Connect to GitHub
        <Github className="h-5 w-5" />
        {isConnectingToGithub && (
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
      {/* GitHub Connection Status/Instructions */}
      {(githubUserCode || githubStatusMessage || githubError) && (
        <div className="mt-6 p-4 border rounded-md bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600">
          <h4 className="font-medium mb-2">GitHub Connection</h4>
          {githubError && (
            <p className="text-red-600 dark:text-red-400 mb-2">
              Error: {githubError}
            </p>
          )}
          {githubUserCode && githubVerificationUri && (
            <div className="mb-2">
              <p>
                1. Go to:
                <a
                  href={githubVerificationUri} // Make it a direct link
                  onClick={(e) => {
                    e.preventDefault();
                    IpcClient.getInstance().openExternalUrl(
                      githubVerificationUri
                    );
                  }}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 text-blue-600 hover:underline dark:text-blue-400"
                >
                  {githubVerificationUri}
                </a>
              </p>
              <p>
                2. Enter code:
                <strong className="ml-1 font-mono text-lg tracking-wider bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded">
                  {githubUserCode}
                </strong>
              </p>
            </div>
          )}
          {githubStatusMessage && (
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {githubStatusMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
