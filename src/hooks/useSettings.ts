import { useState, useEffect } from "react";
import { useAtom } from "jotai";
import { userSettingsAtom, envVarsAtom } from "@/atoms/appAtoms";
import { IpcClient } from "@/ipc/ipc_client";
import type { UserSettings } from "@/lib/schemas";

const PROVIDER_TO_ENV_VAR: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GEMINI_API_KEY",
};

// Define a type for the environment variables we expect
type EnvVars = Record<string, string | undefined>;

export function useSettings() {
  const [settings, setSettingsAtom] = useAtom(userSettingsAtom);
  const [envVars, setEnvVarsAtom] = useAtom(envVarsAtom);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const ipcClient = IpcClient.getInstance();
        // Fetch settings and env vars concurrently
        const [userSettings, fetchedEnvVars] = await Promise.all([
          ipcClient.getUserSettings(),
          ipcClient.getEnvVars(),
        ]);
        setSettingsAtom(userSettings);
        setEnvVarsAtom(fetchedEnvVars);
        setError(null);
      } catch (error) {
        console.error("Error loading initial data:", error);
        setError(error instanceof Error ? error : new Error(String(error)));
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
    // Only run once on mount, dependencies are stable getters/setters
  }, [setSettingsAtom, setEnvVarsAtom]);

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    setLoading(true);
    try {
      const ipcClient = IpcClient.getInstance();
      const updatedSettings = await ipcClient.setUserSettings(newSettings);
      setSettingsAtom(updatedSettings);
      setError(null);
      return updatedSettings;
    } catch (error) {
      console.error("Error updating settings:", error);
      setError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const isProviderSetup = (provider: string) => {
    const providerSettings = settings?.providerSettings[provider];
    if (providerSettings) {
      return true;
    }
    if (envVars[PROVIDER_TO_ENV_VAR[provider]]) {
      return true;
    }
    return false;
  };

  return {
    settings,
    envVars,
    loading,
    error,
    updateSettings,
    isProviderSetup,
    isAnyProviderSetup: () => {
      return Object.keys(PROVIDER_TO_ENV_VAR).some((provider) =>
        isProviderSetup(provider)
      );
    },
  };
}
