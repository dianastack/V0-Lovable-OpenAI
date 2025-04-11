import { useCallback, useState } from "react";
import type { Message } from "ai";
import { useAtom, useSetAtom } from "jotai";
import {
  chatErrorAtom,
  chatMessagesAtom,
  chatStreamCountAtom,
  isStreamingAtom,
} from "@/atoms/chatAtoms";
import { IpcClient } from "@/ipc/ipc_client";
import { isPreviewOpenAtom } from "@/atoms/viewAtoms";
import type { ChatResponseEnd } from "@/ipc/ipc_types";
import { useChats } from "./useChats";
import { useLoadApp } from "./useLoadApp";
import { selectedAppIdAtom } from "@/atoms/appAtoms";
import { useLoadVersions } from "./useLoadVersions";
import { showError } from "@/lib/toast";

export function getRandomString() {
  return Math.random().toString(36).substring(2, 15);
}

export function useStreamChat() {
  const [messages, setMessages] = useAtom(chatMessagesAtom);
  const [isStreaming, setIsStreaming] = useAtom(isStreamingAtom);
  const [error, setError] = useAtom(chatErrorAtom);
  const setIsPreviewOpen = useSetAtom(isPreviewOpenAtom);
  const [selectedAppId] = useAtom(selectedAppIdAtom);
  const { refreshChats } = useChats(selectedAppId);
  const { refreshApp } = useLoadApp(selectedAppId);
  const setStreamCount = useSetAtom(chatStreamCountAtom);
  const { refreshVersions } = useLoadVersions(selectedAppId);

  const streamMessage = useCallback(
    async ({
      prompt,
      chatId,
      redo,
    }: {
      prompt: string;
      chatId: number;
      redo?: boolean;
    }) => {
      if (!prompt.trim() || !chatId) {
        return;
      }

      setError(null);
      console.log("streaming message - set messages", prompt);
      setMessages((currentMessages: Message[]) => {
        if (redo) {
          let remainingMessages = currentMessages.slice();
          if (
            currentMessages[currentMessages.length - 1].role === "assistant"
          ) {
            remainingMessages = currentMessages.slice(0, -1);
          }
          return [
            ...remainingMessages,
            {
              id: getRandomString(),
              role: "assistant",
              content: "",
            },
          ];
        }
        return [
          ...currentMessages,
          {
            id: getRandomString(),
            role: "user",
            content: prompt,
          },
          {
            id: getRandomString(),
            role: "assistant",
            content: "",
          },
        ];
      });
      setIsStreaming(true);
      setStreamCount((streamCount) => streamCount + 1);
      try {
        IpcClient.getInstance().streamMessage(prompt, {
          chatId,
          redo,
          onUpdate: (updatedMessages: Message[]) => {
            setMessages(updatedMessages);
          },
          onEnd: (response: ChatResponseEnd) => {
            if (response.updatedFiles) {
              setIsPreviewOpen(true);
            }

            // Keep the same as below
            setIsStreaming(false);
            refreshChats();
            refreshApp();
            refreshVersions();
          },
          onError: (errorMessage: string) => {
            console.error(`[CHAT] Stream error for ${chatId}:`, errorMessage);
            setError(errorMessage);

            // Keep the same as above
            setIsStreaming(false);
            refreshChats();
            refreshApp();
            refreshVersions();
          },
        });
      } catch (error) {
        console.error("[CHAT] Exception during streaming setup:", error);
        setIsStreaming(false);
        setError(error instanceof Error ? error.message : String(error));
      }
    },
    [setMessages, setIsStreaming, setIsPreviewOpen]
  );

  return {
    streamMessage,
    isStreaming,
    error,
    setError,
    setIsStreaming,
  };
}
