import { ipcMain, type IpcMainInvokeEvent } from "electron";
import type { Proposal } from "@/lib/schemas";
import { db } from "../../db";
import { messages } from "../../db/schema";
import { desc, eq, and } from "drizzle-orm";
import path from "node:path"; // Import path for basename
// Import tag parsers
import {
  getDyadChatSummaryTag,
  getDyadWriteTags,
} from "../processors/response_processor";

// Placeholder Proposal data (can be removed or kept for reference)
// const placeholderProposal: Proposal = { ... };

// Type guard for the parsed proposal structure
interface ParsedProposal {
  title: string;
  files: string[];
}

function isParsedProposal(obj: any): obj is ParsedProposal {
  return (
    obj &&
    typeof obj === "object" &&
    typeof obj.title === "string" &&
    Array.isArray(obj.files) &&
    obj.files.every((file: any) => typeof file === "string")
  );
}

const getProposalHandler = async (
  _event: IpcMainInvokeEvent,
  { chatId }: { chatId: number }
): Promise<Proposal | null> => {
  console.log(`IPC: get-proposal called for chatId: ${chatId}`);

  try {
    // Find the latest ASSISTANT message for the chat
    const latestAssistantMessage = await db.query.messages.findFirst({
      where: and(eq(messages.chatId, chatId), eq(messages.role, "assistant")),
      orderBy: [desc(messages.createdAt)],
      columns: {
        content: true, // Fetch the content to parse
      },
    });

    if (latestAssistantMessage?.content) {
      console.log("Found latest assistant message, parsing content...");
      const messageContent = latestAssistantMessage.content;

      // Parse tags directly from message content
      const proposalTitle = getDyadChatSummaryTag(messageContent);
      const proposalFiles = getDyadWriteTags(messageContent); // Gets { path: string, content: string }[]

      // Check if we have enough information to create a proposal
      if (proposalTitle || proposalFiles.length > 0) {
        const proposal: Proposal = {
          // Use parsed title or a default title if summary tag is missing but write tags exist
          title: proposalTitle ?? "Proposed File Changes",
          securityRisks: [], // Keep empty
          filesChanged: proposalFiles.map((tag) => ({
            name: path.basename(tag.path),
            path: tag.path,
            summary: tag.description ?? "(no change summary found)", // Generic summary
          })),
        };
        console.log("Generated proposal on the fly:", proposal);
        return proposal;
      } else {
        console.log(
          "No relevant tags found in the latest assistant message content."
        );
        return null; // No proposal could be generated
      }
    } else {
      console.log(`No assistant message found for chatId: ${chatId}`);
      return null; // No message found
    }
  } catch (error) {
    console.error(`Error processing proposal for chatId ${chatId}:`, error);
    return null; // Indicate DB or processing error
  }
};

// Function to register proposal-related handlers
export function registerProposalHandlers() {
  ipcMain.handle("get-proposal", getProposalHandler);
  console.log("Registered proposal IPC handlers");
}
