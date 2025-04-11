import type { Message } from "ai";
import type { IpcRenderer } from "electron";
import {
  type ChatSummary,
  ChatSummariesSchema,
  type UserSettings,
} from "../lib/schemas";
import type {
  App,
  AppOutput,
  Chat,
  ChatResponseEnd,
  ChatStreamParams,
  CreateAppParams,
  CreateAppResult,
  ListAppsResponse,
  Version,
} from "./ipc_types";
import { showError } from "@/lib/toast";

export interface ChatStreamCallbacks {
  onUpdate: (messages: Message[]) => void;
  onEnd: (response: ChatResponseEnd) => void;
  onError: (error: string) => void;
}

export interface AppStreamCallbacks {
  onOutput: (output: AppOutput) => void;
}

export class IpcClient {
  private static instance: IpcClient;
  private ipcRenderer: IpcRenderer;
  private chatStreams: Map<number, ChatStreamCallbacks>;
  private appStreams: Map<number, AppStreamCallbacks>;
  private constructor() {
    this.ipcRenderer = (window as any).electron.ipcRenderer as IpcRenderer;
    this.chatStreams = new Map();
    this.appStreams = new Map();
    // Set up listeners for stream events
    this.ipcRenderer.on("chat:response:chunk", (data) => {
      if (
        data &&
        typeof data === "object" &&
        "chatId" in data &&
        "messages" in data
      ) {
        const { chatId, messages } = data as {
          chatId: number;
          messages: Message[];
        };

        const callbacks = this.chatStreams.get(chatId);
        if (callbacks) {
          callbacks.onUpdate(messages);
        } else {
          console.warn(
            `[IPC] No callbacks found for chat ${chatId}`,
            this.chatStreams
          );
        }
      } else {
        showError(new Error(`[IPC] Invalid chunk data received: ${data}`));
      }
    });

    this.ipcRenderer.on("app:output", (data) => {
      if (
        data &&
        typeof data === "object" &&
        "type" in data &&
        "message" in data &&
        "appId" in data
      ) {
        const { type, message, appId } = data as AppOutput;
        const callbacks = this.appStreams.get(appId);
        if (callbacks) {
          callbacks.onOutput({ type, message, appId });
        }
      } else {
        showError(new Error(`[IPC] Invalid app output data received: ${data}`));
      }
    });

    this.ipcRenderer.on("chat:response:end", (payload) => {
      const { chatId, updatedFiles } = payload as unknown as ChatResponseEnd;
      const callbacks = this.chatStreams.get(chatId);
      if (callbacks) {
        callbacks.onEnd({ chatId, updatedFiles });
        console.debug("chat:response:end");
        this.chatStreams.delete(chatId);
      } else {
        showError(
          new Error(`[IPC] No callbacks found for chat ${chatId} on stream end`)
        );
      }
    });

    this.ipcRenderer.on("chat:response:error", (error) => {
      console.debug("chat:response:error");
      if (typeof error === "string") {
        for (const [chatId, callbacks] of this.chatStreams.entries()) {
          callbacks.onError(error);
          this.chatStreams.delete(chatId);
        }
      } else {
        console.error("[IPC] Invalid error data received:", error);
      }
    });
  }

  public static getInstance(): IpcClient {
    if (!IpcClient.instance) {
      IpcClient.instance = new IpcClient();
    }
    return IpcClient.instance;
  }

  // Create a new app with an initial chat
  public async createApp(params: CreateAppParams): Promise<CreateAppResult> {
    try {
      const result = await this.ipcRenderer.invoke("create-app", params);
      return result as CreateAppResult;
    } catch (error) {
      showError(error);
      throw error;
    }
  }

  public async getApp(appId: number): Promise<App> {
    try {
      const data = await this.ipcRenderer.invoke("get-app", appId);
      return data;
    } catch (error) {
      showError(error);
      throw error;
    }
  }

  public async getChat(chatId: number): Promise<Chat> {
    try {
      const data = await this.ipcRenderer.invoke("get-chat", chatId);
      return data;
    } catch (error) {
      showError(error);
      throw error;
    }
  }

  // Get all chats
  public async getChats(appId?: number): Promise<ChatSummary[]> {
    try {
      const data = await this.ipcRenderer.invoke("get-chats", appId);
      return ChatSummariesSchema.parse(data);
    } catch (error) {
      showError(error);
      throw error;
    }
  }

  // Get all apps
  public async listApps(): Promise<ListAppsResponse> {
    try {
      const data = await this.ipcRenderer.invoke("list-apps");
      return data;
    } catch (error) {
      showError(error);
      throw error;
    }
  }

  // Read a file from an app directory
  public async readAppFile(appId: number, filePath: string): Promise<string> {
    try {
      const content = await this.ipcRenderer.invoke("read-app-file", {
        appId,
        filePath,
      });
      return content as string;
    } catch (error) {
      showError(error);
      throw error;
    }
  }

  // Edit a file in an app directory
  public async editAppFile(
    appId: number,
    filePath: string,
    content: string
  ): Promise<{ success: boolean }> {
    try {
      const result = await this.ipcRenderer.invoke("edit-app-file", {
        appId,
        filePath,
        content,
      });
      return result as { success: boolean };
    } catch (error) {
      showError(error);
      throw error;
    }
  }

  // New method for streaming responses
  public streamMessage(
    prompt: string,
    options: {
      chatId: number;
      redo?: boolean;
      onUpdate: (messages: Message[]) => void;
      onEnd: (response: ChatResponseEnd) => void;
      onError: (error: string) => void;
    }
  ): void {
    const { chatId, onUpdate, onEnd, onError, redo } = options;
    this.chatStreams.set(chatId, { onUpdate, onEnd, onError });

    // Use invoke to start the stream and pass the chatId
    this.ipcRenderer
      .invoke("chat:stream", {
        prompt,
        chatId,
        redo,
      } satisfies ChatStreamParams)
      .catch((err) => {
        showError(err);
        onError(String(err));
        this.chatStreams.delete(chatId);
      });
  }

  // Method to cancel an ongoing stream
  public cancelChatStream(chatId: number): void {
    this.ipcRenderer.invoke("chat:cancel", chatId);
    const callbacks = this.chatStreams.get(chatId);
    if (callbacks) {
      this.chatStreams.delete(chatId);
    } else {
      showError(new Error("Tried canceling chat that doesn't exist"));
    }
  }

  // Create a new chat for an app
  public async createChat(appId: number): Promise<number> {
    try {
      const chatId = await this.ipcRenderer.invoke("create-chat", appId);
      return chatId;
    } catch (error) {
      showError(error);
      throw error;
    }
  }

  // Open an external URL using the default browser
  public async openExternalUrl(
    url: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.ipcRenderer.invoke("open-external-url", url);
      return result as { success: boolean; error?: string };
    } catch (error) {
      showError(error);
      // Ensure a consistent return type even on invoke error
      return { success: false, error: (error as Error).message };
    }
  }

  // Run an app
  public async runApp(
    appId: number,
    onOutput: (output: AppOutput) => void
  ): Promise<{ success: boolean }> {
    try {
      const result = await this.ipcRenderer.invoke("run-app", { appId });
      this.appStreams.set(appId, { onOutput });
      return result;
    } catch (error) {
      showError(error);
      throw error;
    }
  }

  // Stop a running app
  public async stopApp(appId: number): Promise<{ success: boolean }> {
    try {
      const result = await this.ipcRenderer.invoke("stop-app", { appId });
      return result;
    } catch (error) {
      showError(error);
      throw error;
    }
  }

  // Restart a running app
  public async restartApp(
    appId: number,
    onOutput: (output: AppOutput) => void
  ): Promise<{ success: boolean }> {
    try {
      const result = await this.ipcRenderer.invoke("restart-app", { appId });
      this.appStreams.set(appId, { onOutput });
      return result;
    } catch (error) {
      showError(error);
      throw error;
    }
  }

  // Get allow-listed environment variables
  public async getEnvVars(): Promise<Record<string, string | undefined>> {
    try {
      const envVars = await this.ipcRenderer.invoke("get-env-vars");
      return envVars as Record<string, string | undefined>;
    } catch (error) {
      showError(error);
      throw error;
    }
  }

  // List all versions (commits) of an app
  public async listVersions({ appId }: { appId: number }): Promise<Version[]> {
    try {
      const versions = await this.ipcRenderer.invoke("list-versions", {
        appId,
      });
      return versions;
    } catch (error) {
      showError(error);
      throw error;
    }
  }

  // Revert to a specific version
  public async revertVersion({
    appId,
    previousVersionId,
  }: {
    appId: number;
    previousVersionId: string;
  }): Promise<{ success: boolean }> {
    try {
      const result = await this.ipcRenderer.invoke("revert-version", {
        appId,
        previousVersionId,
      });
      return result;
    } catch (error) {
      showError(error);
      throw error;
    }
  }

  // Checkout a specific version without creating a revert commit
  public async checkoutVersion({
    appId,
    versionId,
  }: {
    appId: number;
    versionId: string;
  }): Promise<{ success: boolean }> {
    try {
      const result = await this.ipcRenderer.invoke("checkout-version", {
        appId,
        versionId,
      });
      return result;
    } catch (error) {
      showError(error);
      throw error;
    }
  }

  // Get user settings
  public async getUserSettings(): Promise<UserSettings> {
    try {
      const settings = await this.ipcRenderer.invoke("get-user-settings");
      return settings;
    } catch (error) {
      showError(error);
      throw error;
    }
  }

  // Update user settings
  public async setUserSettings(
    settings: Partial<UserSettings>
  ): Promise<UserSettings> {
    try {
      const updatedSettings = await this.ipcRenderer.invoke(
        "set-user-settings",
        settings
      );
      return updatedSettings;
    } catch (error) {
      showError(error);
      throw error;
    }
  }

  // Extract codebase information for a given app
  public async extractCodebase(appId: number, maxFiles = 30): Promise<string> {
    try {
      const codebaseInfo = await this.ipcRenderer.invoke("extract-codebase", {
        appId,
        maxFiles,
      });
      return codebaseInfo as string;
    } catch (error) {
      showError(error);
      throw error;
    }
  }

  // Delete an app and all its files
  public async deleteApp(appId: number): Promise<{ success: boolean }> {
    try {
      const result = await this.ipcRenderer.invoke("delete-app", { appId });
      return result as { success: boolean };
    } catch (error) {
      showError(error);
      throw error;
    }
  }

  // Rename an app (update name and path)
  public async renameApp({
    appId,
    appName,
    appPath,
  }: {
    appId: number;
    appName: string;
    appPath: string;
  }): Promise<{ success: boolean; app: App }> {
    try {
      const result = await this.ipcRenderer.invoke("rename-app", {
        appId,
        appName,
        appPath,
      });
      return result as { success: boolean; app: App };
    } catch (error) {
      showError(error);
      throw error;
    }
  }

  // Reset all - removes all app files, settings, and drops the database
  public async resetAll(): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.ipcRenderer.invoke("reset-all");
      return result as { success: boolean; message: string };
    } catch (error) {
      showError(error);
      throw error;
    }
  }

  public async addDependency({
    chatId,
    packages,
  }: {
    chatId: number;
    packages: string[];
  }): Promise<void> {
    try {
      await this.ipcRenderer.invoke("chat:add-dep", {
        chatId,
        packages,
      });
    } catch (error) {
      showError(error);
      throw error;
    }
  }
}
