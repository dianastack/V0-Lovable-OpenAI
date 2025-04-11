import { useAtom } from "jotai";
import { selectedAppIdAtom } from "@/atoms/appAtoms";
import { useLoadApps } from "@/hooks/useLoadApps";
import { useRouter } from "@tanstack/react-router";

export const TitleBar = () => {
  const [selectedAppId] = useAtom(selectedAppIdAtom);
  const { apps } = useLoadApps();
  const { navigate } = useRouter();

  // Get selected app name
  const selectedApp = apps.find((app) => app.id === selectedAppId);
  const displayText = selectedApp
    ? `App: ${selectedApp.name}`
    : "(no app selected)";

  return (
    <div className="z-11 w-full h-8 bg-(--sidebar) absolute top-0 left-0 app-region-drag flex items-center">
      <div className="no-app-region-drag pl-24 text-sm font-medium">
        {displayText}
      </div>
      <div className="flex-1 text-center text-sm font-medium">Dyad</div>
    </div>
  );
};
