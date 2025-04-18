import { useState, useEffect } from "react";
import { IpcClient } from "@/ipc/ipc_client";
import type { Proposal } from "@/lib/schemas"; // Import Proposal type

export function useProposal(chatId: number | undefined) {
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (chatId === undefined) {
      setProposal(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const fetchProposal = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const fetchedProposal = await IpcClient.getInstance().getProposal(
          chatId
        );
        setProposal(fetchedProposal);
      } catch (err: any) {
        console.error("Error fetching proposal:", err);
        setError(err.message || "Failed to fetch proposal");
        setProposal(null); // Clear proposal on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchProposal();

    // Cleanup function if needed (e.g., for aborting requests)
    // return () => {
    //   // Abort logic here
    // };
  }, [chatId]); // Re-run effect if chatId changes

  return { proposal, isLoading, error };
}
