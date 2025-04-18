import { useSettings } from "@/hooks/useSettings";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function AutoApproveSwitch() {
  const { settings, updateSettings } = useSettings();
  return (
    <div className="flex items-center space-x-2">
      <Switch
        id="auto-approve"
        checked={settings?.autoApproveChanges}
        onCheckedChange={() =>
          updateSettings({ autoApproveChanges: !settings?.autoApproveChanges })
        }
      />
      <Label htmlFor="auto-approve">Auto-approve</Label>
    </div>
  );
}
