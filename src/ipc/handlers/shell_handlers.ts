import type { IpcMainInvokeEvent } from "electron";
import { shell } from "electron";

export async function handleShellOpenExternal(
  _event: IpcMainInvokeEvent,
  url: string
): Promise<void> {
  // Basic validation to ensure it's likely a URL
  if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
    await shell.openExternal(url);
  } else {
    console.error(`Invalid URL attempt blocked: ${url}`);
    // Optionally, you could throw an error back to the renderer
    // throw new Error("Invalid or insecure URL provided.");
  }
}
