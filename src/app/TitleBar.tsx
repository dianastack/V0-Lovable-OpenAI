import { useAtom } from "jotai";
import { selectedAppIdAtom } from "@/atoms/appAtoms";
import { useLoadApps } from "@/hooks/useLoadApps";
import { useRouter } from "@tanstack/react-router";
import { useSettings } from "@/hooks/useSettings";
import { RuntimeMode } from "@/lib/schemas";

function formatRuntimeMode(runtimeMode: RuntimeMode | undefined) {
  switch (runtimeMode) {
    case "web-sandbox":
      return "Sandbox";
    case "local-node":
      return "Local";
    default:
      return runtimeMode;
  }
}

export const TitleBar = () => {
  const [selectedAppId] = useAtom(selectedAppIdAtom);
  const { apps } = useLoadApps();
  const { navigate } = useRouter();
  const { settings } = useSettings();

  // Get selected app name
  const selectedApp = apps.find((app) => app.id === selectedAppId);
  const displayText = selectedApp
    ? `App: ${selectedApp.name}`
    : "(no app selected)";

  return (
    <div className="@container z-11 w-full h-8 bg-(--sidebar) absolute top-0 left-0 app-region-drag flex items-center">
      <div className="pl-24"></div>
      <div className="hidden @md:block text-sm font-medium">{displayText}</div>
      <div className="text-sm font-medium pl-4">
        {formatRuntimeMode(settings?.runtimeMode)} runtime
      </div>
      <div className="flex-1 text-center text-sm font-medium">Dyad</div>
    </div>
  );
};
