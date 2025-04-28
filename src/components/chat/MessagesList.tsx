import type React from "react";
import type { Message } from "@/ipc/ipc_types";
import { forwardRef } from "react";
import ChatMessage from "./ChatMessage";
import { SetupBanner } from "../SetupBanner";
import { useSettings } from "@/hooks/useSettings";
import { useStreamChat } from "@/hooks/useStreamChat";
import { selectedChatIdAtom } from "@/atoms/chatAtoms";
import { useAtom, useAtomValue } from "jotai";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MessagesListProps {
  messages: Message[];
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export const MessagesList = forwardRef<HTMLDivElement, MessagesListProps>(
  function MessagesList({ messages, messagesEndRef }, ref) {
    const { streamMessage, isStreaming, error, setError } = useStreamChat();
    const { isAnyProviderSetup } = useSettings();
    const selectedChatId = useAtomValue(selectedChatIdAtom);
    return (
      <div className="flex-1 overflow-y-auto p-4" ref={ref}>
        {messages.length > 0 ? (
          messages.map((message, index) => (
            <ChatMessage key={index} message={message} />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto">
            <div className="flex items-center justify-center h-full text-gray-500">
              No messages yet
            </div>
            {!isAnyProviderSetup() && <SetupBanner />}
          </div>
        )}
        {messages.length > 0 && !isStreaming && (
          <div className="flex max-w-3xl mx-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (!selectedChatId) {
                  console.error("No chat selected");
                  return;
                }
                // Find the last user message
                const lastUserMessage = [...messages]
                  .reverse()
                  .find((message) => message.role === "user");
                if (!lastUserMessage || !lastUserMessage.content) {
                  console.error("No user message found");
                  return;
                }
                streamMessage({
                  prompt: lastUserMessage.content,
                  chatId: selectedChatId,
                  redo: true,
                });
              }}
            >
              <RefreshCw size={16} />
              Retry
            </Button>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    );
  }
);
