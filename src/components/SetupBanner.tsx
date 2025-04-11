import { useNavigate } from "@tanstack/react-router";
import { ChevronRight, GiftIcon, Sparkles } from "lucide-react";
import { providerSettingsRoute } from "@/routes/settings/providers/$provider";

export function SetupBanner() {
  const navigate = useNavigate();

  const handleSetupClick = () => {
    navigate({
      to: providerSettingsRoute.id,
      params: { provider: "google" },
    });
  };

  return (
    <div
      className="w-full mb-8 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-xl shadow-sm cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
      onClick={handleSetupClick}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 dark:bg-blue-800 p-2 rounded-full">
            <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-medium text-blue-800 dark:text-blue-300">
              Setup your AI API access
            </h3>
            <p className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1">
              <GiftIcon className="w-3.5 h-3.5" />
              Use Google Gemini for free
            </p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-blue-600 dark:text-blue-400" />
      </div>
    </div>
  );
}
