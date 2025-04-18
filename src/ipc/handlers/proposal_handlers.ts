import { ipcMain, type IpcMainInvokeEvent } from "electron";
import type { CodeProposal, ProposalResult } from "@/lib/schemas";
import { db } from "../../db";
import { messages } from "../../db/schema";
import { desc, eq, and, Update } from "drizzle-orm";
import path from "node:path"; // Import path for basename
// Import tag parsers
import {
  getDyadChatSummaryTag,
  getDyadWriteTags,
  processFullResponseActions,
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
): Promise<ProposalResult | null> => {
  console.log(`IPC: get-proposal called for chatId: ${chatId}`);

  try {
    // Find the latest ASSISTANT message for the chat
    const latestAssistantMessage = await db.query.messages.findFirst({
      where: and(eq(messages.chatId, chatId), eq(messages.role, "assistant")),
      orderBy: [desc(messages.createdAt)],
      columns: {
        id: true, // Fetch the ID
        content: true, // Fetch the content to parse
        approvalState: true,
      },
    });

    if (latestAssistantMessage?.approvalState === "rejected") {
      return null;
    }
    if (latestAssistantMessage?.approvalState === "approved") {
      return null;
    }

    if (latestAssistantMessage?.content && latestAssistantMessage.id) {
      const messageId = latestAssistantMessage.id; // Get the message ID
      console.log(
        `Found latest assistant message (ID: ${messageId}), parsing content...`
      );
      const messageContent = latestAssistantMessage.content;

      // Parse tags directly from message content
      const proposalTitle = getDyadChatSummaryTag(messageContent);
      const proposalFiles = getDyadWriteTags(messageContent); // Gets { path: string, content: string }[]

      // Check if we have enough information to create a proposal
      if (proposalTitle || proposalFiles.length > 0) {
        const proposal: CodeProposal = {
          type: "code-proposal",
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
        return { proposal, chatId, messageId }; // Return proposal and messageId
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

// Handler to approve a proposal (process actions and update message)
const approveProposalHandler = async (
  _event: IpcMainInvokeEvent,
  { chatId, messageId }: { chatId: number; messageId: number }
): Promise<{ success: boolean; error?: string }> => {
  console.log(
    `IPC: approve-proposal called for chatId: ${chatId}, messageId: ${messageId}`
  );

  try {
    // 1. Fetch the specific assistant message
    const messageToApprove = await db.query.messages.findFirst({
      where: and(
        eq(messages.id, messageId),
        eq(messages.chatId, chatId),
        eq(messages.role, "assistant")
      ),
      columns: {
        content: true,
      },
    });

    if (!messageToApprove?.content) {
      console.error(
        `Assistant message not found for chatId: ${chatId}, messageId: ${messageId}`
      );
      return { success: false, error: "Assistant message not found." };
    }

    // 2. Process the actions defined in the message content
    const chatSummary = getDyadChatSummaryTag(messageToApprove.content);
    const processResult = await processFullResponseActions(
      messageToApprove.content,
      chatId,
      { chatSummary: chatSummary ?? undefined } // Pass summary if found
    );

    if (processResult.error) {
      console.error(
        `Error processing actions for message ${messageId}:`,
        processResult.error
      );
      // Optionally: Update message state to 'error' or similar?
      // For now, just return error to frontend
      return {
        success: false,
        error: `Action processing failed: ${processResult.error}`,
      };
    }

    // 3. Update the message's approval state to 'approved'
    await db
      .update(messages)
      .set({ approvalState: "approved" })
      .where(eq(messages.id, messageId));

    console.log(`Message ${messageId} marked as approved.`);
    return { success: true };
  } catch (error) {
    console.error(
      `Error approving proposal for messageId ${messageId}:`,
      error
    );
    return {
      success: false,
      error: (error as Error)?.message || "Unknown error",
    };
  }
};

// Handler to reject a proposal (just update message state)
const rejectProposalHandler = async (
  _event: IpcMainInvokeEvent,
  { chatId, messageId }: { chatId: number; messageId: number }
): Promise<{ success: boolean; error?: string }> => {
  console.log(
    `IPC: reject-proposal called for chatId: ${chatId}, messageId: ${messageId}`
  );

  try {
    // 1. Verify the message exists and is an assistant message
    const messageToReject = await db.query.messages.findFirst({
      where: and(
        eq(messages.id, messageId),
        eq(messages.chatId, chatId),
        eq(messages.role, "assistant")
      ),
      columns: { id: true }, // Only need to confirm existence
    });

    if (!messageToReject) {
      console.error(
        `Assistant message not found for chatId: ${chatId}, messageId: ${messageId}`
      );
      return { success: false, error: "Assistant message not found." };
    }

    // 2. Update the message's approval state to 'rejected'
    await db
      .update(messages)
      .set({ approvalState: "rejected" })
      .where(eq(messages.id, messageId));

    console.log(`Message ${messageId} marked as rejected.`);
    return { success: true };
  } catch (error) {
    console.error(
      `Error rejecting proposal for messageId ${messageId}:`,
      error
    );
    return {
      success: false,
      error: (error as Error)?.message || "Unknown error",
    };
  }
};

// Function to register proposal-related handlers
export function registerProposalHandlers() {
  ipcMain.handle("get-proposal", getProposalHandler);
  ipcMain.handle("approve-proposal", approveProposalHandler);
  ipcMain.handle("reject-proposal", rejectProposalHandler);
  console.log("Registered proposal IPC handlers (get, approve, reject)");
}
