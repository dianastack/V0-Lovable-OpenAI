import { useState, useRef, useEffect } from "react";
import {
  PanelGroup,
  Panel,
  PanelResizeHandle,
  type ImperativePanelHandle,
} from "react-resizable-panels";
import { ChatPanel } from "../components/ChatPanel";
import { PreviewPanel } from "../components/preview_panel/PreviewPanel";
import { useSearch } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useAtom } from "jotai";
import { isPreviewOpenAtom } from "@/atoms/viewAtoms";

export default function ChatPage() {
  const { id } = useSearch({ from: "/chat" });
  const [isPreviewOpen, setIsPreviewOpen] = useAtom(isPreviewOpenAtom);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (isPreviewOpen) {
      ref.current?.expand();
    } else {
      ref.current?.collapse();
    }
  }, [isPreviewOpen]);
  const ref = useRef<ImperativePanelHandle>(null);

  return (
    <PanelGroup autoSaveId="persistence" direction="horizontal">
      <Panel id="chat-panel" minSize={30}>
        <div className="h-full w-full">
          <ChatPanel
            chatId={id}
            isPreviewOpen={isPreviewOpen}
            onTogglePreview={() => {
              setIsPreviewOpen(!isPreviewOpen);
              if (isPreviewOpen) {
                ref.current?.collapse();
              } else {
                ref.current?.expand();
              }
            }}
          />
        </div>
      </Panel>

      <>
        <PanelResizeHandle
          onDragging={(e) => setIsResizing(e)}
          className="w-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors cursor-col-resize"
        />
        <Panel
          collapsible
          ref={ref}
          id="preview-panel"
          minSize={20}
          className={cn(
            !isResizing && "transition-all duration-100 ease-in-out"
          )}
        >
          <PreviewPanel />
        </Panel>
      </>
    </PanelGroup>
  );
}
