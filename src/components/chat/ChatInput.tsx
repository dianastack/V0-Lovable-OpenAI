import {
  SendIcon,
  StopCircleIcon,
  X,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  AlertOctagon,
  FileText,
  Check,
} from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

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
          <ChatInputActions />
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

function ChatInputActions() {
  const [autoApprove, setAutoApprove] = useState(false);
  const [isDetailsVisible, setIsDetailsVisible] = useState(false);

  const handleApprove = () => {
    console.log("Approve clicked");
    // Add approve logic here
  };

  const handleReject = () => {
    console.log("Reject clicked");
    // Add reject logic here
  };

  // Placeholder data
  const securityRisks = [
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
  ];

  const filesChanged = [
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
  ];

  return (
    <div className="border-b border-border">
      <div className="p-2">
        {/* Row 1: Title, Expand Icon, and Security Chip */}
        <div className="flex items-center gap-2 mb-1">
          <button
            className="flex items-center text-left text-sm font-medium hover:bg-muted p-1 rounded justify-start"
            onClick={() => setIsDetailsVisible(!isDetailsVisible)}
          >
            {isDetailsVisible ? (
              <ChevronUp size={16} className="mr-1" />
            ) : (
              <ChevronDown size={16} className="mr-1" />
            )}
            Review: foo bar changes
          </button>
          {securityRisks.length > 0 && (
            <span className="bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">
              Security risks found
            </span>
          )}
        </div>

        {/* Row 2: Buttons and Toggle */}
        <div className="flex items-center justify-start space-x-2">
          <Button
            className="px-8"
            size="sm"
            variant="outline"
            onClick={handleApprove}
          >
            <Check size={16} className="mr-1" />
            Approve
          </Button>
          <Button
            className="px-8"
            size="sm"
            variant="outline"
            onClick={handleReject}
          >
            <X size={16} className="mr-1" />
            Reject
          </Button>
          <div className="flex items-center space-x-1 ml-auto">
            {/* Basic HTML checkbox styled to look like a toggle */}
            <input
              type="checkbox"
              id="auto-approve"
              checked={autoApprove}
              onChange={(e) => setAutoApprove(e.target.checked)}
              className="relative peer shrink-0 appearance-none w-8 h-4 border border-input rounded-full bg-input checked:bg-primary cursor-pointer after:absolute after:w-3 after:h-3 after:top-[1px] after:left-[2px] after:bg-background after:rounded-full after:transition-all checked:after:translate-x-4 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
            <label htmlFor="auto-approve" className="text-xs cursor-pointer">
              Auto-approve
            </label>
          </div>
        </div>
      </div>

      {isDetailsVisible && (
        <div className="p-3 border-t border-border bg-muted/50 text-sm">
          <div className="mb-3">
            <h4 className="font-semibold mb-1">Security Risks</h4>
            <ul className="space-y-1">
              {securityRisks.map((risk, index) => (
                <li key={index} className="flex items-start space-x-2">
                  {risk.type === "warning" ? (
                    <AlertTriangle
                      size={16}
                      className="text-yellow-500 mt-0.5 flex-shrink-0"
                    />
                  ) : (
                    <AlertOctagon
                      size={16}
                      className="text-red-500 mt-0.5 flex-shrink-0"
                    />
                  )}
                  <div>
                    <span className="font-medium">{risk.title}:</span>{" "}
                    <span>{risk.description}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-1">Files Changed</h4>
            <ul className="space-y-1">
              {filesChanged.map((file, index) => (
                <li key={index} className="flex items-center space-x-2">
                  <FileText
                    size={16}
                    className="text-muted-foreground flex-shrink-0"
                  />
                  <span title={file.path} className="truncate cursor-default">
                    {file.name}
                  </span>
                  <span className="text-muted-foreground text-xs truncate">
                    - {file.summary}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
