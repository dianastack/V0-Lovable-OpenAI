import { useState, useEffect, useCallback } from "react";
import { useAtom } from "jotai";
import { versionsListAtom } from "@/atoms/appAtoms";
import { IpcClient } from "@/ipc/ipc_client";

export function useLoadVersions(appId: number | null) {
  const [versions, setVersions] = useAtom(versionsListAtom);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const loadVersions = async () => {
      // If no app is selected, clear versions and return
      if (appId === null) {
        setVersions([]);
        setLoading(false);
        return;
      }

      try {
        const ipcClient = IpcClient.getInstance();
        const versionsList = await ipcClient.listVersions({ appId });

        setVersions(versionsList);
        setError(null);
      } catch (error) {
        console.error("Error loading versions:", error);
        setError(error instanceof Error ? error : new Error(String(error)));
      } finally {
        setLoading(false);
      }
    };

    loadVersions();
  }, [appId, setVersions]);

  const refreshVersions = useCallback(async () => {
    if (appId === null) {
      return;
    }

    try {
      const ipcClient = IpcClient.getInstance();
      const versionsList = await ipcClient.listVersions({ appId });
      setVersions(versionsList);
      setError(null);
    } catch (error) {
      console.error("Error refreshing versions:", error);
      setError(error instanceof Error ? error : new Error(String(error)));
    }
  }, [appId, setVersions, setError]);

  return { versions, loading, error, refreshVersions };
}
