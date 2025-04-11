import { ipcMain, shell } from "electron";

export function registerShellHandlers() {
  ipcMain.handle("open-external-url", async (_event, url: string) => {
    try {
      // Basic validation to ensure it's a http/https url
      if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
        await shell.openExternal(url);
        return { success: true };
      }
        console.error("Attempted to open invalid or non-http URL:", url);
        return {
          success: false,
          error: "Invalid URL provided. Only http/https URLs are allowed.",
        };
    } catch (error) {
      console.error(`Failed to open external URL ${url}:`, error);
      return { success: false, error: (error as Error).message };
    }
  });
}
