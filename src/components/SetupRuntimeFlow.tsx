import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { IpcClient } from "@/ipc/ipc_client";
import { useSettings } from "@/hooks/useSettings"; // Assuming useSettings provides a refresh function
import { RuntimeMode } from "@/lib/schemas";
import { ExternalLink } from "lucide-react";

interface SetupRuntimeFlowProps {
  hideIntroText?: boolean;
}

export function SetupRuntimeFlow({ hideIntroText }: SetupRuntimeFlowProps) {
  const [isLoading, setIsLoading] = useState<RuntimeMode | "check" | null>(
    null
  );
  const [showNodeInstallPrompt, setShowNodeInstallPrompt] = useState(false);
  const [nodeVersion, setNodeVersion] = useState<string | null>(null);
  const [npmVersion, setNpmVersion] = useState<string | null>(null);
  const [downloadClicked, setDownloadClicked] = useState(false);
  const { updateSettings } = useSettings();

  // Pre-check Node.js status on component mount (optional but good UX)
  useEffect(() => {
    const checkNode = async () => {
      try {
        const status = await IpcClient.getInstance().getNodejsStatus();
        setNodeVersion(status.nodeVersion);
        setNpmVersion(status.npmVersion);
      } catch (error) {
        console.error("Failed to check Node.js status:", error);
        // Assume not installed if check fails
        setNodeVersion(null);
        setNpmVersion(null);
      }
    };
    checkNode();
  }, []);

  const handleSelect = async (mode: RuntimeMode) => {
    if (isLoading) return; // Prevent double clicks

    setIsLoading(mode);
    try {
      await updateSettings({ runtimeMode: mode });
      // Component likely unmounts on success
    } catch (error) {
      console.error("Failed to set runtime mode:", error);
      alert(
        `Error setting runtime mode: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      setIsLoading(null); // Reset loading state on error
    }
  };

  const handleLocalNodeClick = async () => {
    if (isLoading) return;

    setIsLoading("check");
    try {
      if (nodeVersion && npmVersion) {
        // Node and npm found, proceed directly
        handleSelect("local-node");
      } else {
        // Node or npm not found, show prompt
        setShowNodeInstallPrompt(true);
        setIsLoading(null);
      }
    } catch (error) {
      console.error("Failed to check Node.js status on click:", error);
      // Show prompt if check fails
      setShowNodeInstallPrompt(true);
      setIsLoading(null);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center max-w-2xl m-auto p-6">
      {!hideIntroText && (
        <>
          <h1 className="text-4xl font-bold mb-2 text-center">
            Welcome to Dyad
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-6 text-center">
            Before you start building, choose how your apps will run. <br />
            Don’t worry — you can change this later anytime.
          </p>
        </>
      )}

      <div className="w-full space-y-4">
        <Button
          variant="outline"
          className="relative bg-(--background-lightest) w-full justify-start p-4 h-auto text-left relative"
          onClick={() => handleSelect("web-sandbox")}
          disabled={!!isLoading}
        >
          {isLoading === "web-sandbox" && (
            <svg
              className="animate-spin h-5 w-5 mr-3 absolute right-4 top-1/2 -translate-y-1/2"
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
          <div>
            <p className="font-medium text-base">Sandboxed Mode</p>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              <div>
                <span className="absolute top-4 right-2 bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">
                  Recommended for beginners
                </span>
                <p>Apps run in a protected environment within your browser.</p>
                <p>Does not support advanced apps.</p>
              </div>
            </div>
          </div>
        </Button>

        <Button
          variant="outline"
          className="bg-(--background-lightest) w-full justify-start p-4 h-auto text-left relative flex flex-col items-start"
          onClick={handleLocalNodeClick}
          disabled={isLoading === "web-sandbox" || isLoading === "local-node"}
          style={{ height: "auto" }} // Ensure height adjusts
        >
          {isLoading === "check" || isLoading === "local-node" ? (
            <svg
              className="animate-spin h-5 w-5 mr-3 absolute right-4 top-6" // Adjust position
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
          ) : null}
          <div className="w-full">
            <p className="font-medium text-base">Full Access Mode</p>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 w-full">
              <p>
                <span className="absolute top-4 right-2 bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">
                  Best for power users
                </span>
                <p>
                  Apps run directly on your computer with full access to your
                  system.
                </p>
                <p>
                  Supports advanced apps that require server-side capabilities.
                </p>
              </p>

              {showNodeInstallPrompt && (
                <div className="mt-4 p-4 border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/30 rounded-md text-yellow-800 dark:text-yellow-200 w-full">
                  <p className="font-semibold">Install Node.js</p>
                  <p className="mt-1">
                    This mode requires Node.js to be installed.
                  </p>
                  {downloadClicked ? (
                    <div
                      className="text-blue-400 cursor-pointer flex items-center"
                      onClick={() => {
                        IpcClient.getInstance().openExternalUrl(
                          "https://nodejs.org/en/download#:~:text=Or%20get%20a%20prebuilt%20Node.js"
                        );
                        setDownloadClicked(true);
                      }}
                    >
                      Download Node.js
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </div>
                  ) : null}
                  {!downloadClicked ? (
                    <Button
                      size="sm"
                      className=" mt-3 w-full inline-flex items-center justify-center"
                      onClick={() => {
                        IpcClient.getInstance().openExternalUrl(
                          "https://nodejs.org/en/download#:~:text=Or%20get%20a%20prebuilt%20Node.js"
                        );
                        setDownloadClicked(true);
                      }}
                    >
                      Download Node.js <ExternalLink className="w-3 h-3 ml-1" />
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="mt-3 w-full"
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent outer button click
                        handleSelect("local-node"); // Proceed with selection
                      }}
                      disabled={isLoading === "local-node"} // Disable while processing selection
                    >
                      {isLoading === "local-node" ? (
                        <svg
                          className="animate-spin h-4 w-4 mr-2"
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
                      ) : null}
                      Continue - I installed Node.js
                    </Button>
                  )}
                </div>
              )}

              <p className="mt-4 text-wrap break-words text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/50 px-2 py-1 rounded-md">
                Warning: this will run AI-generated code directly on your
                computer, which could put your computer at risk.
              </p>
            </div>
          </div>
        </Button>
      </div>
    </div>
  );
}
