import { useState, useEffect, useCallback } from "react";
import { IpcClient } from "@/ipc/ipc_client";
import type { Proposal } from "@/lib/schemas"; // Import Proposal type

// Define the structure returned by the IPC call
interface ProposalResult {
  proposal: Proposal;
  messageId: number;
}

export function useProposal(chatId?: number | undefined) {
  const [proposalData, setProposalData] = useState<ProposalResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProposal = useCallback(
    async (innerChatId?: number) => {
      chatId = chatId ?? innerChatId;
      if (chatId === undefined) {
        setProposalData(null);
        setIsLoading(false);
        setError(null);
        return;
      }
      setIsLoading(true);
      setError(null);
      setProposalData(null); // Reset on new fetch
      try {
        // Type assertion might be needed depending on how IpcClient is typed
        const result = (await IpcClient.getInstance().getProposal(
          chatId
        )) as ProposalResult | null;

        if (result) {
          setProposalData(result);
        } else {
          setProposalData(null); // Explicitly set to null if IPC returns null
        }
      } catch (err: any) {
        console.error("Error fetching proposal:", err);
        setError(err.message || "Failed to fetch proposal");
        setProposalData(null); // Clear proposal data on error
      } finally {
        setIsLoading(false);
      }
    },
    [chatId]
  ); // Depend on chatId

  useEffect(() => {
    fetchProposal();

    // Cleanup function if needed (e.g., for aborting requests)
    // return () => {
    //   // Abort logic here
    // };
  }, [fetchProposal]); // Re-run effect if fetchProposal changes (due to chatId change)

  const refreshProposal = useCallback(
    (chatId?: number) => {
      fetchProposal(chatId);
    },
    [fetchProposal]
  );

  return {
    proposal: proposalData?.proposal ?? null,
    messageId: proposalData?.messageId,
    isLoading,
    error,
    refreshProposal, // Expose the refresh function
  };
}
