import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { IpcClient } from "@/ipc/ipc_client";
import { showSuccess } from "@/lib/toast";
import {
  Smartphone,
  TabletSmartphone,
  Loader2,
  ExternalLink,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface CapacitorControlsProps {
  appId: number;
}

export function CapacitorControls({ appId }: CapacitorControlsProps) {
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorDetails, setErrorDetails] = useState<{
    title: string;
    message: string;
  } | null>(null);

  // Check if Capacitor is installed
  const { data: isCapacitor, isLoading } = useQuery({
    queryKey: ["is-capacitor", appId],
    queryFn: () => IpcClient.getInstance().isCapacitor({ appId }),
    enabled: !!appId,
  });

  const showErrorDialog = (title: string, error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    setErrorDetails({ title, message: errorMessage });
    setErrorDialogOpen(true);
  };

  // Sync and open iOS mutation
  const syncAndOpenIosMutation = useMutation({
    mutationFn: async () => {
      // First sync
      await IpcClient.getInstance().syncCapacitor({ appId });
      // Then open iOS
      await IpcClient.getInstance().openIos({ appId });
    },
    onSuccess: () => {
      showSuccess("Synced and opened iOS project in Xcode");
    },
    onError: (error) => {
      showErrorDialog("Failed to sync and open iOS project", error);
    },
  });

  // Sync and open Android mutation
  const syncAndOpenAndroidMutation = useMutation({
    mutationFn: async () => {
      // First sync
      await IpcClient.getInstance().syncCapacitor({ appId });
      // Then open Android
      await IpcClient.getInstance().openAndroid({ appId });
    },
    onSuccess: () => {
      showSuccess("Synced and opened Android project in Android Studio");
    },
    onError: (error) => {
      showErrorDialog("Failed to sync and open Android project", error);
    },
  });

  // Don't render anything if loading or if Capacitor is not installed
  if (isLoading || !isCapacitor) {
    return null;
  }

  return (
    <>
      <Card className="mt-1">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Mobile Development
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // TODO: Add actual help link
                IpcClient.getInstance().openExternalUrl(
                  "https://dyad.sh/docs/guides/mobile-app#troubleshooting",
                );
              }}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1"
            >
              Need help?
              <ExternalLink className="h-3 w-3" />
            </Button>
          </CardTitle>
          <CardDescription>
            Sync and open your Capacitor mobile projects
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => syncAndOpenIosMutation.mutate()}
              disabled={syncAndOpenIosMutation.isPending}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 h-10"
            >
              {syncAndOpenIosMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Smartphone className="h-4 w-4" />
              )}
              <div className="text-left">
                <div className="text-xs font-medium">Sync & Open iOS</div>
                <div className="text-xs text-gray-500">Xcode</div>
              </div>
            </Button>

            <Button
              onClick={() => syncAndOpenAndroidMutation.mutate()}
              disabled={syncAndOpenAndroidMutation.isPending}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 h-10"
            >
              {syncAndOpenAndroidMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <TabletSmartphone className="h-4 w-4" />
              )}
              <div className="text-left">
                <div className="text-xs font-medium">Sync & Open Android</div>
                <div className="text-xs text-gray-500">Android Studio</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error Dialog */}
      <Dialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-red-600 dark:text-red-400">
              {errorDetails?.title}
            </DialogTitle>
            <DialogDescription>
              An error occurred while running the Capacitor command. See details
              below:
            </DialogDescription>
          </DialogHeader>

          {errorDetails && (
            <div className="max-h-96 w-full rounded border p-4 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
              <pre className="text-xs whitespace-pre-wrap font-mono">
                {errorDetails.message}
              </pre>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={() => setErrorDialogOpen(false)}
              variant="outline"
              size="sm"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
