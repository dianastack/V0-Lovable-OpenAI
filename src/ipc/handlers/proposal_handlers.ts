import { ipcMain, type IpcMainInvokeEvent } from "electron";
import type { Proposal } from "@/lib/schemas";

// Placeholder Proposal data
const placeholderProposal: Proposal = {
  title: "Review: Example Refactoring (from IPC)",
  securityRisks: [
    {
      type: "warning",
      title: "Potential XSS Vulnerability",
      description: "User input is directly rendered without sanitization.",
    },
    {
      type: "danger",
      title: "Hardcoded API Key",
      description: "API key found in plain text in configuration file.",
    },
  ],
  filesChanged: [
    {
      name: "ChatInput.tsx",
      path: "src/components/chat/ChatInput.tsx",
      summary: "Added review actions and details section.",
    },
    {
      name: "api.ts",
      path: "src/lib/api.ts",
      summary: "Refactored API call structure.",
    },
  ],
};

const getProposalHandler = async (
  _event: IpcMainInvokeEvent,
  { chatId }: { chatId: number }
): Promise<Proposal> => {
  console.log(`IPC: get-proposal called for chatId: ${chatId}`);
  // Simulate async operation
  await new Promise((resolve) => setTimeout(resolve, 500)); // 500ms delay
  return placeholderProposal;
};

// Function to register proposal-related handlers
export function registerProposalHandlers() {
  ipcMain.handle("get-proposal", getProposalHandler);
  console.log("Registered proposal IPC handlers");
}
