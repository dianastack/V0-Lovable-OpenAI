import { selectedAppIdAtom, appUrlAtom, appOutputAtom } from "@/atoms/appAtoms";
import { useAtomValue, useSetAtom } from "jotai";
import { useRunApp } from "@/hooks/useRunApp";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  Maximize2,
  Loader2,
  X,
  Sparkles,
  ChevronDown,
  Lightbulb,
} from "lucide-react";
import { chatInputValueAtom } from "@/atoms/chatAtoms";
import { IpcClient } from "@/ipc/ipc_client";
import { useLoadApp } from "@/hooks/useLoadApp";
import { useLoadAppFile } from "@/hooks/useLoadAppFile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSettings } from "@/hooks/useSettings";
import {
  loadSandpackClient,
  type SandboxSetup,
  type ClientOptions,
  SandpackClient,
} from "@codesandbox/sandpack-client";
import { showError } from "@/lib/toast";
import { SandboxConfig } from "@/ipc/ipc_types";

interface ErrorBannerProps {
  error: string | null;
  onDismiss: () => void;
  onAIFix: () => void;
}

const ErrorBanner = ({ error, onDismiss, onAIFix }: ErrorBannerProps) => {
  if (!error) return null;

  return (
    <div className="absolute top-2 left-2 right-2 z-10 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-md shadow-sm p-2">
      {/* Close button in top left */}
      <button
        onClick={onDismiss}
        className="absolute top-1 left-1 p-1 hover:bg-red-100 dark:hover:bg-red-900/50 rounded"
      >
        <X size={14} className="text-red-500 dark:text-red-400" />
      </button>

      {/* Error message in the middle */}
      <div className="px-6 py-1 text-sm">
        <div className="text-red-700 dark:text-red-300 text-wrap">{error}</div>
      </div>

      {/* Tip message */}
      <div className="mt-2 px-6">
        <div className="relative p-2 bg-red-100 dark:bg-red-900/50 rounded-sm flex gap-1 items-center">
          <div>
            <Lightbulb size={16} className=" text-red-800 dark:text-red-300" />
          </div>
          <span className="text-sm text-red-700 dark:text-red-400">
            <span className="font-medium">Tip: </span>Check if refreshing the
            page or restarting the app fixes the error.
          </span>
        </div>
      </div>

      {/* AI Fix button at the bottom */}
      <div className="mt-2 flex justify-end">
        <button
          onClick={onAIFix}
          className="cursor-pointer flex items-center space-x-1 px-2 py-0.5 bg-red-500 dark:bg-red-600 text-white rounded text-sm hover:bg-red-600 dark:hover:bg-red-700"
        >
          <Sparkles size={14} />
          <span>Fix error with AI</span>
        </button>
      </div>
    </div>
  );
};

// Preview iframe component
export const PreviewIframe = ({
  loading,
  error,
}: {
  loading: boolean;
  error: Error | null;
}) => {
  const selectedAppId = useAtomValue(selectedAppIdAtom);
  const { appUrl } = useAtomValue(appUrlAtom);
  const setAppOutput = useSetAtom(appOutputAtom);
  const { app } = useLoadApp(selectedAppId);

  // State to trigger iframe reload
  const [reloadKey, setReloadKey] = useState(0);
  const [iframeError, setIframeError] = useState<string | null>(null);
  const [showError, setShowError] = useState(true);
  const setInputValue = useSetAtom(chatInputValueAtom);
  const [availableRoutes, setAvailableRoutes] = useState<
    Array<{ path: string; label: string }>
  >([]);

  // Load router related files to extract routes
  const { content: routerContent } = useLoadAppFile(
    selectedAppId,
    "src/App.tsx"
  );

  // Effect to parse routes from the router file
  useEffect(() => {
    if (routerContent) {
      try {
        const routes: Array<{ path: string; label: string }> = [];

        // Extract route imports and paths using regex for React Router syntax
        // Match <Route path="/path">
        const routePathsRegex = /<Route\s+(?:[^>]*\s+)?path=["']([^"']+)["']/g;
        let match;

        // Find all route paths in the router content
        while ((match = routePathsRegex.exec(routerContent)) !== null) {
          const path = match[1];
          // Create a readable label from the path
          const label =
            path === "/"
              ? "Home"
              : path
                  .split("/")
                  .filter((segment) => segment && !segment.startsWith(":"))
                  .pop()
                  ?.replace(/[-_]/g, " ")
                  .replace(/^\w/, (c) => c.toUpperCase()) || path;

          if (!routes.some((r) => r.path === path)) {
            routes.push({ path, label });
          }
        }

        setAvailableRoutes(routes);
      } catch (e) {
        console.error("Error parsing router file:", e);
      }
    }
  }, [routerContent]);

  // Navigation state
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [navigationHistory, setNavigationHistory] = useState<string[]>([]);
  const [currentHistoryPosition, setCurrentHistoryPosition] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { settings } = useSettings();

  // Add message listener for iframe errors and navigation events
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only handle messages from our iframe
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      const { type, payload } = event.data;

      if (type === "window-error") {
        const errorMessage = `Error in ${payload.filename} (line ${payload.lineno}, col ${payload.colno}): ${payload.message}`;
        console.error("Iframe error:", errorMessage);
        setIframeError(errorMessage);
        setAppOutput((prev) => [
          ...prev,
          {
            message: `Iframe error: ${errorMessage}`,
            type: "client-error",
            appId: selectedAppId!,
          },
        ]);
      } else if (type === "unhandled-rejection") {
        const errorMessage = `Unhandled Promise Rejection: ${payload.reason}`;
        console.error("Iframe unhandled rejection:", errorMessage);
        setIframeError(errorMessage);
        setAppOutput((prev) => [
          ...prev,
          {
            message: `Iframe unhandled rejection: ${errorMessage}`,
            type: "client-error",
            appId: selectedAppId!,
          },
        ]);
      } else if (type === "pushState" || type === "replaceState") {
        console.debug(`Navigation event: ${type}`, payload);

        // Update navigation history based on the type of state change
        if (type === "pushState") {
          // For pushState, we trim any forward history and add the new URL
          const newHistory = [
            ...navigationHistory.slice(0, currentHistoryPosition + 1),
            payload.newUrl,
          ];
          setNavigationHistory(newHistory);
          setCurrentHistoryPosition(newHistory.length - 1);
        } else if (type === "replaceState") {
          // For replaceState, we replace the current URL
          const newHistory = [...navigationHistory];
          newHistory[currentHistoryPosition] = payload.newUrl;
          setNavigationHistory(newHistory);
        }

        // Update navigation buttons state
        setCanGoBack(currentHistoryPosition > 0);
        setCanGoForward(currentHistoryPosition < navigationHistory.length - 1);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [navigationHistory, currentHistoryPosition, selectedAppId]);

  // Initialize navigation history when iframe loads
  useEffect(() => {
    if (appUrl) {
      setNavigationHistory([appUrl]);
      setCurrentHistoryPosition(0);
      setCanGoBack(false);
      setCanGoForward(false);
    }
  }, [appUrl]);

  // Function to navigate back
  const handleNavigateBack = () => {
    if (canGoBack && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: "navigate",
          payload: { direction: "backward" },
        },
        "*"
      );

      // Update our local state
      setCurrentHistoryPosition((prev) => prev - 1);
      setCanGoBack(currentHistoryPosition - 1 > 0);
      setCanGoForward(true);
    }
  };

  // Function to navigate forward
  const handleNavigateForward = () => {
    if (canGoForward && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: "navigate",
          payload: { direction: "forward" },
        },
        "*"
      );

      // Update our local state
      setCurrentHistoryPosition((prev) => prev + 1);
      setCanGoBack(true);
      setCanGoForward(
        currentHistoryPosition + 1 < navigationHistory.length - 1
      );
    }
  };

  // Function to handle reload
  const handleReload = () => {
    setReloadKey((prevKey) => prevKey + 1);
    // Optionally, add logic here if you need to explicitly stop/start the app again
    // For now, just changing the key should remount the iframe
    console.debug("Reloading iframe preview for app", selectedAppId);
  };

  // Function to navigate to a specific route
  const navigateToRoute = (path: string) => {
    if (iframeRef.current?.contentWindow && appUrl) {
      // Create the full URL by combining the base URL with the path
      const baseUrl = new URL(appUrl).origin;
      const newUrl = `${baseUrl}${path}`;

      // Navigate to the URL
      iframeRef.current.contentWindow.location.href = newUrl;

      // Update navigation history
      const newHistory = [
        ...navigationHistory.slice(0, currentHistoryPosition + 1),
        newUrl,
      ];
      setNavigationHistory(newHistory);
      setCurrentHistoryPosition(newHistory.length - 1);
      setCanGoBack(true);
      setCanGoForward(false);
    }
  };

  // Display loading state
  if (loading) {
    return <div className="p-4 dark:text-gray-300">Loading app preview...</div>;
  }

  // Display message if no app is selected
  if (selectedAppId === null) {
    return (
      <div className="p-4 text-gray-500 dark:text-gray-400">
        Select an app to see the preview.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Browser-style header */}
      <div className="flex items-center p-2 border-b space-x-2 ">
        {/* Navigation Buttons */}
        <div className="flex space-x-1">
          <button
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed dark:text-gray-300"
            disabled={!canGoBack || loading || !selectedAppId}
            onClick={handleNavigateBack}
          >
            <ArrowLeft size={16} />
          </button>
          <button
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed dark:text-gray-300"
            disabled={!canGoForward || loading || !selectedAppId}
            onClick={handleNavigateForward}
          >
            <ArrowRight size={16} />
          </button>
          <button
            onClick={handleReload}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed dark:text-gray-300"
            disabled={loading || !selectedAppId}
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {/* Address Bar with Routes Dropdown - using shadcn/ui dropdown-menu */}
        <div className="relative flex-grow">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center justify-between px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm text-gray-700 dark:text-gray-200 cursor-pointer w-full">
                <span>
                  {navigationHistory[currentHistoryPosition]
                    ? new URL(navigationHistory[currentHistoryPosition])
                        .pathname
                    : "/"}
                </span>
                <ChevronDown size={14} />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-full">
              {availableRoutes.length > 0 ? (
                availableRoutes.map((route) => (
                  <DropdownMenuItem
                    key={route.path}
                    onClick={() => navigateToRoute(route.path)}
                    className="flex justify-between"
                  >
                    <span>{route.label}</span>
                    <span className="text-gray-500 dark:text-gray-400 text-xs">
                      {route.path}
                    </span>
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem disabled>Loading routes...</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-1">
          <button
            onClick={() => {
              if (appUrl) {
                IpcClient.getInstance().openExternalUrl(appUrl);
              }
            }}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed dark:text-gray-300"
          >
            <ExternalLink size={16} />
          </button>
        </div>
      </div>

      <div className="relative flex-grow ">
        <ErrorBanner
          error={showError ? error?.message || iframeError : null}
          onDismiss={() => setShowError(false)}
          onAIFix={() => {
            setInputValue(`Fix the error in ${error?.message || iframeError}`);
          }}
        />

        {settings?.runtimeMode === "web-sandbox" ? (
          <SandpackIframe reloadKey={reloadKey} />
        ) : !appUrl ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 bg-gray-50 dark:bg-gray-950">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400 dark:text-gray-500" />
            <p className="text-gray-600 dark:text-gray-300">
              Starting up your app...
            </p>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            key={reloadKey}
            title={`Preview for App ${selectedAppId}`}
            className="w-full h-full border-none bg-white dark:bg-gray-950"
            src={appUrl}
          />
        )}
      </div>
    </div>
  );
};

const parseTailwindConfig = (config: string) => {
  const themeRegex = /theme\s*:\s*(\{[\s\S]*?\})(?=\s*,\s*plugins)/;
  const match = config.match(themeRegex);
  if (!match) return "{};";
  return `{theme: ${match[1]}};`;
};

const SandpackIframe = ({ reloadKey }: { reloadKey: number }) => {
  const selectedAppId = useAtomValue(selectedAppIdAtom);
  const { app } = useLoadApp(selectedAppId);
  const keyRef = useRef<number | null>(null);
  const isFirstRender = useRef(true);
  const sandpackClientRef = useRef<SandpackClient | null>(null);

  async function loadSandpack() {
    if (keyRef.current === reloadKey) return;
    keyRef.current = reloadKey;

    if (!iframeRef.current || !app || !selectedAppId) return;
    const sandboxConfig = await IpcClient.getInstance().getAppSandboxConfig(
      selectedAppId
    );

    const sandpackConfig: SandboxSetup = mapSandpackConfig(sandboxConfig);

    const options: ClientOptions = {
      // bundlerURL: "https://sandpack.dyad.sh/",
      showOpenInCodeSandbox: false,
      showLoadingScreen: true,
      showErrorScreen: true,
      externalResources: [
        // "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4",
        "https://cdn.tailwindcss.com",
      ],
    };

    let client: SandpackClient | undefined;
    try {
      client = await loadSandpackClient(
        iframeRef.current,
        sandpackConfig,
        options
      );
      sandpackClientRef.current = client;
      return client;
    } catch (error) {
      showError(error);
    }
  }

  useEffect(() => {
    async function updateSandpack() {
      if (sandpackClientRef.current && selectedAppId) {
        const sandboxConfig = await IpcClient.getInstance().getAppSandboxConfig(
          selectedAppId
        );
        sandpackClientRef.current.updateSandbox(
          mapSandpackConfig(sandboxConfig)
        );
      }
    }
    updateSandpack();
  }, [app]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (!iframeRef.current || !app || !selectedAppId) return () => {};

    const clientPromise = loadSandpack();
    return () => {
      clientPromise.then((client) => {
        client?.destroy();
        sandpackClientRef.current = null;
      });
    };
  }, [reloadKey]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  return (
    <iframe
      ref={iframeRef}
      className="w-full h-full border-none bg-gray-50"
    ></iframe>
  );
};

const mapSandpackConfig = (sandboxConfig: SandboxConfig): SandboxSetup => {
  return {
    files: Object.fromEntries(
      Object.entries(sandboxConfig.files).map(([key, value]) => [
        key,
        {
          code: value.replace(
            "import './globals.css'",
            `
const injectedStyle = document.createElement("style");
injectedStyle.textContent = \`${sandboxConfig.files["src/globals.css"]}\`;
injectedStyle.type = "text/tailwindcss";
document.head.appendChild(injectedStyle);

window.tailwind.config = ${parseTailwindConfig(
              sandboxConfig.files["tailwind.config.ts"]
            )}
`
          ),
        },
      ])
    ),
    dependencies: sandboxConfig.dependencies,
    entry: sandboxConfig.entry,
  };
};
