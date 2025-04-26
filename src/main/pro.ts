import { readSettings, writeSettings } from "./settings";

export function handleDyadProReturn({
  apiKey,
  budgetResetAt,
  maxBudget,
}: {
  apiKey: string;
  budgetResetAt: string;
  maxBudget: number;
}) {
  const settings = readSettings();
  writeSettings({
    providerSettings: {
      ...settings.providerSettings,
      auto: {
        ...settings.providerSettings.auto,
        apiKey: {
          value: apiKey,
        },
      },
    },
    dyadProBudget: {
      budgetResetAt,
      maxBudget,
    },
    enableDyadPro: true,
  });
}
