import fs from "node:fs";
import path from "node:path";
import { getUserDataPath } from "../paths/paths";
import { UserSettingsSchema, type UserSettings } from "../lib/schemas";
import { safeStorage } from "electron";

const DEFAULT_SETTINGS: UserSettings = {
  selectedModel: {
    name: "auto",
    provider: "auto",
  },
  providerSettings: {},
  runtimeMode: "unset",
  githubSettings: {
    secrets: null,
  },
};

const SETTINGS_FILE = "user-settings.json";

function getSettingsFilePath(): string {
  return path.join(getUserDataPath(), SETTINGS_FILE);
}

export function readSettings(): UserSettings {
  try {
    const filePath = getSettingsFilePath();
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(DEFAULT_SETTINGS, null, 2));
      return DEFAULT_SETTINGS;
    }
    const rawSettings = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    // Validate and merge with defaults
    const validatedSettings = UserSettingsSchema.parse({
      ...DEFAULT_SETTINGS,
      ...rawSettings,
    });
    if (validatedSettings.githubSettings?.secrets) {
      const accessToken = validatedSettings.githubSettings.secrets.accessToken;

      validatedSettings.githubSettings.secrets = {
        accessToken: accessToken ? decrypt(accessToken) : null,
      };
    }
    return validatedSettings;
  } catch (error) {
    console.error("Error reading settings:", error);
    return DEFAULT_SETTINGS;
  }
}

export function writeSettings(settings: Partial<UserSettings>): void {
  try {
    const filePath = getSettingsFilePath();
    const currentSettings = readSettings();
    const newSettings = { ...currentSettings, ...settings };
    // Validate before writing
    const validatedSettings = UserSettingsSchema.parse(newSettings);
    if (validatedSettings.githubSettings?.secrets) {
      const accessToken = validatedSettings.githubSettings.secrets.accessToken;
      validatedSettings.githubSettings.secrets = {
        accessToken: accessToken ? encrypt(accessToken) : null,
      };
    }
    fs.writeFileSync(filePath, JSON.stringify(validatedSettings, null, 2));
  } catch (error) {
    console.error("Error writing settings:", error);
  }
}

export function encrypt(data: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(data).toString("base64");
  }
  return data;
}

export function decrypt(data: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.decryptString(Buffer.from(data, "base64"));
  }
  return data;
}
