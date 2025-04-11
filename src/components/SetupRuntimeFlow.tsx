import { useState } from "react";
import { Button } from "@/components/ui/button";
import { IpcClient } from "@/ipc/ipc_client";
import { useSettings } from "@/hooks/useSettings"; // Assuming useSettings provides a refresh function
import { RuntimeMode } from "@/lib/schemas";

interface SetupRuntimeFlowProps {
  onRuntimeSelected: (mode: RuntimeMode) => Promise<void>;
}

export function SetupRuntimeFlow({ onRuntimeSelected }: SetupRuntimeFlowProps) {
  const [isLoading, setIsLoading] = useState<RuntimeMode | null>(null);

  const handleSelect = async (mode: RuntimeMode) => {
    setIsLoading(mode);
    try {
      await onRuntimeSelected(mode);
      // No need to setIsLoading(null) as the component will unmount on success
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

  return (
    <div className="flex flex-col items-center justify-center max-w-2xl m-auto p-8">
      <h1 className="text-4xl font-bold mb-4 text-center">Welcome to Dyad</h1>
      <p className="text-lg text-gray-600 dark:text-gray-400 mb-10 text-center">
        You can start building apps with AI in a moment, but first pick how you
        want to run these apps. You can always change your mind later.
      </p>

      <div className="w-full space-y-4">
        <Button
          variant="outline"
          className="relative bg-(--background-lightest) w-full justify-start p-6 h-auto text-left relative"
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
            <p className="font-medium text-base">Sandboxed Runtime</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              <div>
                <span className="absolute top-4 right-2 bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">
                  Recommended for beginners
                </span>
                Code will run inside a browser sandbox.
              </div>
            </p>
          </div>
        </Button>

        <Button
          variant="outline"
          className="bg-(--background-lightest) w-full justify-start p-6 h-auto text-left relative"
          onClick={() => handleSelect("local-node")}
          disabled={!!isLoading}
        >
          {isLoading === "local-node" && (
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
            <p className="font-medium text-base">Local Node.js Runtime</p>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              <p>
                Code will run using Node.js on your computer and have full
                system access.
              </p>
              <p className=" mt-2 text-wrap wrap-break-word text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900 px-2 py-1 rounded-md">
                Warning: this will run AI-generated code directly on your
                computer, which could put your system at risk.
              </p>
            </div>
          </div>
        </Button>
      </div>
    </div>
  );
}
