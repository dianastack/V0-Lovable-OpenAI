import { registerAppHandlers } from "./handlers/app_handlers";
import { registerChatHandlers } from "./handlers/chat_handlers";
import { registerChatStreamHandlers } from "./handlers/chat_stream_handlers";
import { registerSettingsHandlers } from "./handlers/settings_handlers";
import { registerShellHandlers } from "./handlers/shell_handler";
import { registerDependencyHandlers } from "./handlers/dependency_handlers";

export function registerIpcHandlers() {
  // Register all IPC handlers by category
  registerAppHandlers();
  registerChatHandlers();
  registerChatStreamHandlers();
  registerSettingsHandlers();
  registerShellHandlers();
  registerDependencyHandlers();
}
