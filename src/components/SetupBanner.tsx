import { useNavigate } from "@tanstack/react-router";
import {
  ChevronRight,
  GiftIcon,
  Sparkles,
  CheckCircle,
  AlertCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { providerSettingsRoute } from "@/routes/settings/providers/$provider";
import { useSettings } from "@/hooks/useSettings";
import { useState, useEffect, useCallback } from "react";
import { IpcClient } from "@/ipc/ipc_client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NodeSystemInfo } from "@/ipc/ipc_types";
import { usePostHog } from "posthog-js/react";
type NodeInstallStep =
  | "install"
  | "waiting-for-continue"
  | "continue-processing";

export function SetupBanner() {
  const { capture } = usePostHog();
  const navigate = useNavigate();
  const { isAnyProviderSetup, loading } = useSettings();
  const [nodeSystemInfo, setNodeSystemInfo] = useState<NodeSystemInfo | null>(
    null
  );
  const [nodeCheckError, setNodeCheckError] = useState<boolean>(false);
  const [nodeInstallStep, setNodeInstallStep] =
    useState<NodeInstallStep>("install");
  const checkNode = useCallback(async () => {
    try {
      setNodeCheckError(false);
      const status = await IpcClient.getInstance().getNodejsStatus();
      setNodeSystemInfo(status);
    } catch (error) {
      console.error("Failed to check Node.js status:", error);
      setNodeSystemInfo(null);
      setNodeCheckError(true);
    }
  }, [setNodeSystemInfo, setNodeCheckError]);

  useEffect(() => {
    checkNode();
  }, [checkNode]);

  const handleAiSetupClick = () => {
    capture("setup-flow:ai-provider-setup-click");
    navigate({
      to: providerSettingsRoute.id,
      params: { provider: "google" },
    });
  };

  const handleNodeInstallClick = useCallback(async () => {
    capture("setup-flow:start-node-install-click");
    setNodeInstallStep("waiting-for-continue");
    IpcClient.getInstance().openExternalUrl(nodeSystemInfo!.nodeDownloadUrl);
  }, [nodeSystemInfo, setNodeInstallStep]);

  const finishNodeInstall = useCallback(async () => {
    capture("setup-flow:continue-node-install-click");
    setNodeInstallStep("continue-processing");
    await IpcClient.getInstance().reloadEnvPath();
    await checkNode();
  }, [checkNode, setNodeInstallStep]);

  const isNodeSetupComplete = Boolean(
    nodeSystemInfo?.nodeVersion && nodeSystemInfo?.pnpmVersion
  );

  const itemsNeedAction: string[] = [];
  if (!isNodeSetupComplete && nodeSystemInfo) {
    itemsNeedAction.push("node-setup");
  }
  if (!isAnyProviderSetup() && !loading) {
    itemsNeedAction.push("ai-setup");
  }

  if (itemsNeedAction.length === 0) {
    return (
      <h1 className="text-6xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-400 tracking-tight">
        Build your dream app
      </h1>
    );
  }

  const bannerClasses = cn(
    "w-full mb-6 border rounded-xl shadow-sm overflow-hidden",
    "border-zinc-200 dark:border-zinc-700"
  );

  const getStatusIcon = (isComplete: boolean, hasError: boolean = false) => {
    if (hasError) {
      return <XCircle className="w-5 h-5 text-red-500" />;
    }
    return isComplete ? (
      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-500" />
    ) : (
      <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-500" />
    );
  };

  return (
    <>
      <p className="text-xl text-zinc-700 dark:text-zinc-300 p-4">
        Follow these steps and you'll be ready to start building with Dyad...
      </p>
      <div className={bannerClasses}>
        <Accordion
          type="multiple"
          className="w-full"
          defaultValue={itemsNeedAction}
        >
          <AccordionItem
            value="node-setup"
            className={cn(
              nodeCheckError
                ? "bg-red-50 dark:bg-red-900/30"
                : isNodeSetupComplete
                ? "bg-green-50 dark:bg-green-900/30"
                : "bg-yellow-50 dark:bg-yellow-900/30"
            )}
          >
            <AccordionTrigger className="px-4 py-3 transition-colors w-full hover:no-underline">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  {getStatusIcon(isNodeSetupComplete, nodeCheckError)}
                  <span className="font-medium text-sm">
                    1. Install Node.js (App Runtime)
                  </span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pt-2 pb-4 bg-white dark:bg-zinc-900 border-t border-inherit">
              {nodeCheckError && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  Error checking Node.js status. Try installing Node.js.
                </p>
              )}
              {isNodeSetupComplete ? (
                <p className="text-sm">
                  Node.js ({nodeSystemInfo!.nodeVersion}) installed.{" "}
                  {nodeSystemInfo!.pnpmVersion && (
                    <span className="text-xs text-gray-500">
                      pnpm ({nodeSystemInfo!.pnpmVersion}) installed.
                    </span>
                  )}
                </p>
              ) : (
                <div className="text-sm">
                  <p>Node.js is required to run apps locally.</p>
                  {nodeInstallStep === "waiting-for-continue" && (
                    <p className="mt-1">
                      After you have installed Node.js, click "Continue". If the
                      installer didn't work, try{" "}
                      <a
                        className="text-blue-500 dark:text-blue-400 hover:underline"
                        onClick={() => {
                          IpcClient.getInstance().openExternalUrl(
                            "https://nodejs.org/en/download"
                          );
                        }}
                      >
                        more download options
                      </a>
                      .
                    </p>
                  )}
                  {nodeInstallStep === "install" ? (
                    <Button className="mt-3" onClick={handleNodeInstallClick}>
                      Install Node.js Runtime
                    </Button>
                  ) : (
                    <Button className="mt-3" onClick={finishNodeInstall}>
                      {nodeInstallStep === "continue-processing" ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Checking Node.js setup...
                        </div>
                      ) : (
                        "Continue | I installed Node.js"
                      )}
                    </Button>
                  )}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="ai-setup"
            className={cn(
              isAnyProviderSetup()
                ? "bg-green-50 dark:bg-green-900/30"
                : "bg-yellow-50 dark:bg-yellow-900/30"
            )}
          >
            <AccordionTrigger
              className={cn(
                "px-4 py-3 transition-colors w-full hover:no-underline"
              )}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  {getStatusIcon(isAnyProviderSetup())}
                  <span className="font-medium text-sm">
                    2. Setup AI Model Access
                  </span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pt-2 pb-4 bg-white dark:bg-zinc-900 border-t border-inherit">
              <p className="text-sm mb-3">
                Connect your preferred AI provider to start generating code.
              </p>
              <div
                className="p-3 bg-blue-50 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-700 rounded-lg cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/70 transition-colors"
                onClick={handleAiSetupClick}
                role="button"
                tabIndex={isNodeSetupComplete ? 0 : -1}
                onKeyDown={(e) =>
                  isNodeSetupComplete &&
                  e.key === "Enter" &&
                  handleAiSetupClick()
                }
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="bg-blue-100 dark:bg-blue-800 p-1.5 rounded-full">
                      <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm text-blue-800 dark:text-blue-300">
                        Setup Google Gemini API Key
                      </h4>
                      <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <GiftIcon className="w-3 h-3" />
                        Use Google Gemini for free
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </>
  );
}
