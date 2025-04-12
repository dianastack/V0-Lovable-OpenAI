import { SendIcon, StopCircleIcon, X } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { ModelPicker } from "@/components/ModelPicker";
import { useSettings } from "@/hooks/useSettings";
import { IpcClient } from "@/ipc/ipc_client";
import { chatInputValueAtom } from "@/atoms/chatAtoms";
import { useAtom } from "jotai";
import { useStreamChat } from "@/hooks/useStreamChat";
import { useChats } from "@/hooks/useChats";
import { selectedAppIdAtom } from "@/atoms/appAtoms";
import { useLoadApp } from "@/hooks/useLoadApp";

interface ChatInputProps {
  chatId?: number;
  onSubmit?: () => void;
}

export function ChatInput({ chatId, onSubmit }: ChatInputProps) {
  const [inputValue, setInputValue] = useAtom(chatInputValueAtom);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { settings, updateSettings, isAnyProviderSetup } = useSettings();
  const { streamMessage, isStreaming, setIsStreaming, error, setError } =
    useStreamChat();
  const [selectedAppId] = useAtom(selectedAppIdAtom);
  const [showError, setShowError] = useState(true);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "0px";
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${scrollHeight + 4}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [inputValue]);

  useEffect(() => {
    if (error) {
      setShowError(true);
    }
  }, [error]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitHandler();
    }
  };

  const handleSubmit = async () => {
    if (!inputValue.trim() || isStreaming || !chatId) {
      return;
    }

    const currentInput = inputValue;
    setInputValue("");
    await streamMessage({ prompt: currentInput, chatId });
  };
  const submitHandler = onSubmit ? onSubmit : handleSubmit;

  const handleCancel = () => {
    if (chatId) {
      IpcClient.getInstance().cancelChatStream(chatId);
    }
    setIsStreaming(false);
  };

  const dismissError = () => {
    setShowError(false);
  };

  if (!settings) {
    return null; // Or loading state
  }

  return (
    <>
      {error && showError && (
        <div className="relative mt-2 bg-red-50 border border-red-200 rounded-md shadow-sm p-2">
          <button
            onClick={dismissError}
            className="absolute top-1 left-1 p-1 hover:bg-red-100 rounded"
          >
            <X size={14} className="text-red-500" />
          </button>
          <div className="px-6 py-1 text-sm">
            <div className="text-red-700 text-wrap">{error}</div>
          </div>
        </div>
      )}
      <div className="p-4">
        <div className="flex flex-col space-y-2 border border-border rounded-lg bg-(--background-lighter) shadow-sm">
          <div className="flex items-start space-x-2 ">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask Dyad to build..."
              className="flex-1 p-2 focus:outline-none overflow-y-auto min-h-[40px] max-h-[200px]"
              style={{ resize: "none" }}
              disabled={isStreaming}
            />
            {isStreaming ? (
              <button
                onClick={handleCancel}
                className="px-2 py-2 mt-1 mr-2 hover:bg-(--background-darkest) text-(--sidebar-accent-fg) rounded-lg"
                title="Cancel generation"
              >
                <StopCircleIcon size={20} />
              </button>
            ) : (
              <button
                onClick={submitHandler}
                disabled={!inputValue.trim() || !isAnyProviderSetup()}
                className="px-2 py-2 mt-1 mr-2 hover:bg-(--background-darkest) text-(--sidebar-accent-fg) rounded-lg disabled:opacity-50"
              >
                <SendIcon size={20} />
              </button>
            )}
          </div>
          <div className="px-2 pb-2">
            <ModelPicker
              selectedModel={settings.selectedModel}
              onModelSelect={(model) =>
                updateSettings({ selectedModel: model })
              }
            />
          </div>
        </div>
      </div>
    </>
  );
}
