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
import { showError } from "@/lib/toast";

export function SetupBanner() {
  const navigate = useNavigate();
  const { isAnyProviderSetup } = useSettings();
  const [nodeVersion, setNodeVersion] = useState<string | null>(null);
  const [pnpmVersion, setPnpmVersion] = useState<string | null>(null);
  const [nodeCheckError, setNodeCheckError] = useState<boolean>(false);
  const [nodeInstallError, setNodeInstallError] = useState<string | null>(null);
  const [nodeInstallLoading, setNodeInstallLoading] = useState<boolean>(false);
  const checkNode = useCallback(async () => {
    try {
      setNodeCheckError(false);
      const status = await IpcClient.getInstance().getNodejsStatus();
      setNodeVersion(status.nodeVersion);
      setPnpmVersion(status.pnpmVersion);
    } catch (error) {
      console.error("Failed to check Node.js status:", error);
      setNodeVersion(null);
      setPnpmVersion(null);
      setNodeCheckError(true);
    }
  }, [setNodeVersion, setNodeCheckError]);

  useEffect(() => {
    checkNode();
  }, [checkNode]);

  const handleAiSetupClick = () => {
    navigate({
      to: providerSettingsRoute.id,
      params: { provider: "google" },
    });
  };

  const handleNodeInstallClick = async () => {
    setNodeInstallLoading(true);
    try {
      const result = await IpcClient.getInstance().installNode();
      if (!result.success) {
        showError(result.errorMessage);
        setNodeInstallError(result.errorMessage || "Unknown error");
      } else {
        setNodeVersion(result.nodeVersion);
        setPnpmVersion(result.pnpmVersion);
      }
    } catch (error) {
      showError("Failed to install Node.js. " + (error as Error).message);
      setNodeInstallError(
        "Failed to install Node.js. " + (error as Error).message
      );
    } finally {
      setNodeInstallLoading(false);
    }
  };

  const isNodeSetupComplete = !!nodeVersion && !!pnpmVersion;
  const isAiProviderSetup = isAnyProviderSetup();

  const itemsNeedAction: string[] = [];
  if (!isNodeSetupComplete) itemsNeedAction.push("node-setup");
  if (isNodeSetupComplete && !isAiProviderSetup)
    itemsNeedAction.push("ai-setup");

  if (itemsNeedAction.length === 0) {
    return null;
  }

  const bannerClasses = cn(
    "w-full mb-8 border rounded-xl shadow-sm overflow-hidden",
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
                  1. Check Node.js Runtime
                </span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pt-2 pb-4 bg-white dark:bg-zinc-900 border-t border-inherit">
            {nodeInstallError && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {nodeInstallError}
              </p>
            )}
            {nodeCheckError ? (
              <p className="text-sm text-red-600 dark:text-red-400">
                Error checking Node.js status. Please ensure node.js are
                installed correctly and accessible in your system's PATH.
              </p>
            ) : isNodeSetupComplete ? (
              <p className="text-sm">Node.js ({nodeVersion}) installed.</p>
            ) : (
              <div>
                <p className="text-sm mb-3">
                  Node.js is required to run apps locally. We also use pnpm as
                  our package manager as it's faster and more efficient than
                  npm.
                </p>
                <Button
                  size="sm"
                  onClick={handleNodeInstallClick}
                  disabled={nodeInstallLoading}
                >
                  {nodeInstallLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Installing...
                    </>
                  ) : (
                    "Install Node.js Runtime"
                  )}
                </Button>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem
          value="ai-setup"
          disabled={!isNodeSetupComplete}
          className={cn(
            isAiProviderSetup
              ? "bg-green-50 dark:bg-green-900/30"
              : "bg-yellow-50 dark:bg-yellow-900/30",
            !isNodeSetupComplete ? "opacity-60" : ""
          )}
        >
          <AccordionTrigger
            className={cn(
              "px-4 py-3 transition-colors w-full hover:no-underline",
              !isNodeSetupComplete ? "cursor-not-allowed" : ""
            )}
            onClick={(e) => !isNodeSetupComplete && e.preventDefault()}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                {getStatusIcon(isAiProviderSetup)}
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
                isNodeSetupComplete && e.key === "Enter" && handleAiSetupClick()
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
  );
}
