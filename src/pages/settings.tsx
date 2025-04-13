import { useState, useEffect } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { ProviderSettingsGrid } from "@/components/ProviderSettings";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import { IpcClient } from "@/ipc/ipc_client";
import { showSuccess, showError } from "@/lib/toast";
import { useSettings } from "@/hooks/useSettings";
import { RuntimeMode } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const {
    settings,
    updateSettings,
    loading: settingsLoading,
    error: settingsError,
  } = useSettings();
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isUpdatingRuntime, setIsUpdatingRuntime] = useState<
    RuntimeMode | "check" | null
  >(null);
  const [showNodeInstallPrompt, setShowNodeInstallPrompt] = useState(false);
  const [nodeVersion, setNodeVersion] = useState<string | null>(null);
  const [npmVersion, setNpmVersion] = useState<string | null>(null);
  const [downloadClicked, setDownloadClicked] = useState(false);

  useEffect(() => {
    const checkNode = async () => {
      try {
        const status = await IpcClient.getInstance().getNodejsStatus();
        setNodeVersion(status.nodeVersion);
        setNpmVersion(status.npmVersion);
      } catch (error) {
        console.error("Failed to check Node.js status:", error);
        setNodeVersion(null);
        setNpmVersion(null);
      }
    };
    checkNode();
  }, []);

  const handleResetEverything = async () => {
    setIsResetting(true);
    try {
      const ipcClient = IpcClient.getInstance();
      const result = await ipcClient.resetAll();
      if (result.success) {
        showSuccess("Successfully reset everything. Restart the application.");
      } else {
        showError(result.message || "Failed to reset everything.");
      }
    } catch (error) {
      console.error("Error resetting:", error);
      showError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
    } finally {
      setIsResetting(false);
      setIsResetDialogOpen(false);
    }
  };

  const handleRuntimeChange = async (newMode: RuntimeMode) => {
    if (newMode === settings?.runtimeMode || isUpdatingRuntime) return;
    setIsUpdatingRuntime(newMode);
    setShowNodeInstallPrompt(false);
    setDownloadClicked(false);

    try {
      await updateSettings({ runtimeMode: newMode });
      showSuccess("Runtime mode updated successfully.");
    } catch (error) {
      console.error("Error updating runtime mode:", error);
      showError(
        error instanceof Error
          ? error.message
          : "Failed to update runtime mode."
      );
    } finally {
      setIsUpdatingRuntime(null);
    }
  };

  const handleLocalNodeClick = async () => {
    if (isUpdatingRuntime) return;

    if (nodeVersion && npmVersion) {
      handleRuntimeChange("local-node");
      return;
    }

    setIsUpdatingRuntime("check");
    try {
      const status = await IpcClient.getInstance().getNodejsStatus();
      setNodeVersion(status.nodeVersion);
      setNpmVersion(status.npmVersion);
      if (status.nodeVersion && status.npmVersion) {
        handleRuntimeChange("local-node");
      } else {
        setShowNodeInstallPrompt(true);
        setIsUpdatingRuntime(null);
      }
    } catch (error) {
      console.error("Failed to check Node.js status on click:", error);
      setShowNodeInstallPrompt(true);
      setIsUpdatingRuntime(null);
      showError("Could not verify Node.js installation.");
    }
  };

  const currentRuntimeMode =
    settings?.runtimeMode && settings.runtimeMode !== "unset"
      ? settings.runtimeMode
      : "web-sandbox";

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">
          Settings
        </h1>

        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Appearance
            </h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Theme
                </label>

                <div className="relative bg-gray-100 dark:bg-gray-700 rounded-lg p-1 flex">
                  {(["system", "light", "dark"] as const).map((option) => (
                    <button
                      key={option}
                      onClick={() => setTheme(option)}
                      className={`
                        px-4 py-1.5 text-sm font-medium rounded-md
                        transition-all duration-200
                        ${
                          theme === option
                            ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                        }
                      `}
                    >
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Runtime Environment Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Runtime Environment
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Choose how app code is executed. This affects performance,
              security, and capabilities.
            </p>

            {settingsLoading ? (
              <div className="flex items-center justify-center h-24">
                {/* Inline SVG Spinner */}
                <svg
                  className="animate-spin h-8 w-8 text-gray-500 dark:text-gray-400"
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
              </div>
            ) : settingsError ? (
              <p className="text-red-500 text-center">
                Error loading runtime settings: {settingsError.message}
              </p>
            ) : (
              <div className="space-y-4">
                <Button
                  variant={
                    currentRuntimeMode === "web-sandbox" ? "default" : "outline"
                  }
                  className={`disabled:opacity-90 w-full justify-start p-4 h-auto text-left relative group ${
                    currentRuntimeMode === "web-sandbox"
                      ? "border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-gray-700 ring-2 ring-blue-300 dark:ring-blue-600"
                      : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  } ${
                    isUpdatingRuntime && currentRuntimeMode !== "web-sandbox"
                      ? "opacity-50 cursor-not-allowed"
                      : "cursor-pointer"
                  }`}
                  onClick={() => handleRuntimeChange("web-sandbox")}
                  disabled={
                    isUpdatingRuntime !== null ||
                    currentRuntimeMode === "web-sandbox"
                  }
                >
                  {isUpdatingRuntime === "web-sandbox" && (
                    <svg
                      className="animate-spin h-5 w-5 absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400"
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
                  <span className="absolute top-2 right-2 bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full group-hover:bg-blue-200 dark:group-hover:bg-blue-900">
                    Recommended for beginners
                  </span>
                  <div>
                    <p
                      className={`font-medium text-base ${
                        currentRuntimeMode === "web-sandbox"
                          ? "text-blue-800 dark:text-blue-100"
                          : "text-gray-900 dark:text-white"
                      }`}
                    >
                      Sandboxed Mode
                    </p>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      <p>
                        Apps run in a protected environment within your browser.
                      </p>
                      <p>Does not support advanced apps.</p>
                    </div>
                  </div>
                </Button>

                <Button
                  variant={
                    currentRuntimeMode === "local-node" ? "default" : "outline"
                  }
                  className={`disabled:opacity-90 w-full justify-start p-4 h-auto text-left relative group flex flex-col items-start ${
                    currentRuntimeMode === "local-node"
                      ? "border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-gray-700 ring-2 ring-blue-300 dark:ring-blue-600"
                      : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  } ${
                    isUpdatingRuntime && currentRuntimeMode !== "local-node"
                      ? "opacity-50 cursor-not-allowed"
                      : "cursor-pointer"
                  }`}
                  onClick={handleLocalNodeClick}
                  disabled={
                    isUpdatingRuntime !== null ||
                    currentRuntimeMode === "local-node"
                  }
                >
                  {(isUpdatingRuntime === "check" ||
                    isUpdatingRuntime === "local-node") && (
                    <svg
                      className="animate-spin h-5 w-5 absolute right-4 top-6 text-gray-500 dark:text-gray-400"
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
                  <span className="absolute top-2 right-2 bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full group-hover:bg-blue-200 dark:group-hover:bg-blue-900">
                    Best for power users
                  </span>
                  <div className="w-full">
                    <p
                      className={`font-medium text-base ${
                        currentRuntimeMode === "local-node"
                          ? "text-blue-800 dark:text-blue-100"
                          : "text-gray-900 dark:text-white"
                      }`}
                    >
                      Full Access Mode
                    </p>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 w-full">
                      <p>
                        Apps run directly on your computer with full access to
                        your system.
                      </p>
                      <p>
                        Supports advanced apps that require server-side
                        capabilities.
                      </p>

                      {showNodeInstallPrompt && (
                        <div className="mt-4 p-4 border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/30 rounded-md text-yellow-800 dark:text-yellow-200 w-full">
                          <p className="font-semibold">Install Node.js</p>
                          <p className="mt-1 text-xs">
                            This mode requires Node.js and npm to be installed
                            and accessible in your system's PATH.
                          </p>
                          {!downloadClicked ? (
                            <Button
                              variant="link"
                              size="sm"
                              className="p-0 h-auto mt-2 text-blue-600 dark:text-blue-400 hover:underline flex items-center"
                              onClick={(e) => {
                                e.stopPropagation();
                                IpcClient.getInstance().openExternalUrl(
                                  "https://nodejs.org/en/download"
                                );
                                setDownloadClicked(true);
                              }}
                            >
                              Download Node.js{" "}
                              <ExternalLink className="w-3 h-3 ml-1" />
                            </Button>
                          ) : (
                            <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                              Node.js download page opened.
                            </p>
                          )}
                          <Button
                            variant="default"
                            size="sm"
                            className="mt-3 w-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRuntimeChange("local-node");
                            }}
                            disabled={isUpdatingRuntime === "local-node"}
                          >
                            {isUpdatingRuntime === "local-node" ? (
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
                            Continue - I have installed Node.js
                          </Button>
                        </div>
                      )}

                      <p className="mt-4 text-wrap break-words text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/50 px-2 py-1 rounded-md text-xs">
                        Warning: This mode runs AI-generated code directly on
                        your computer, which can be risky. Only use code from
                        trusted sources or review it carefully.
                      </p>
                    </div>
                  </div>
                </Button>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
            <ProviderSettingsGrid configuredProviders={[]} />
          </div>

          {/* Danger Zone */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-red-200 dark:border-red-800">
            <h2 className="text-lg font-medium text-red-600 dark:text-red-400 mb-4">
              Danger Zone
            </h2>

            <div className="space-y-4">
              <div className="flex items-start justify-between flex-col sm:flex-row sm:items-center gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    Reset Everything
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    This will delete all your apps, chats, and settings. This
                    action cannot be undone.
                  </p>
                </div>
                <button
                  onClick={() => setIsResetDialogOpen(true)}
                  disabled={isResetting}
                  className="rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResetting ? "Resetting..." : "Reset Everything"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmationDialog
        isOpen={isResetDialogOpen}
        title="Reset Everything"
        message="Are you sure you want to reset everything? This will delete all your apps, chats, and settings. This action cannot be undone."
        confirmText="Reset Everything"
        cancelText="Cancel"
        onConfirm={handleResetEverything}
        onCancel={() => setIsResetDialogOpen(false)}
      />
    </div>
  );
}
