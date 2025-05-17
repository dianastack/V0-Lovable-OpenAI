import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Sparkles, Info } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";

export function ProModeSelector() {
  const { settings, updateSettings } = useSettings();

  const toggleSaverMode = () => {
    updateSettings({ enableProSaverMode: !settings?.enableProSaverMode });
  };

  const toggleLazyEdits = () => {
    updateSettings({
      enableProLazyEditsMode: !settings?.enableProLazyEditsMode,
    });
  };

  const toggleSmartContext = () => {
    updateSettings({
      enableProSmartFilesContextMode: !settings?.enableProSmartFilesContextMode,
    });
  };

  if (!settings?.enableDyadPro) {
    return null;
  }

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2 h-8 border-primary/50 bg-primary/10 hover:bg-primary/20 font-medium shadow-sm shadow-primary/10 transition-all hover:shadow-md hover:shadow-primary/15"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-primary font-medium">Pro</span>
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Configure Dyad Pro settings</TooltipContent>
      </Tooltip>
      <PopoverContent className="w-80 border-primary/20">
        <div className="space-y-4">
          <div className="space-y-1">
            <h4 className="font-medium flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-primary font-medium">Dyad Pro</span>
            </h4>
            <div className="h-px bg-gradient-to-r from-primary/50 via-primary/20 to-transparent" />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Label htmlFor="saver-mode">Saver Mode</Label>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-72">
                    Note: using the free Gemini API lets Google use your data to
                    improve their models.
                  </TooltipContent>
                </Tooltip>
                <p className="text-xs text-muted-foreground max-w-55">
                  Uses your free Gemini API quota before consuming Dyad Pro AI
                  credits
                </p>
              </div>
            </div>
            <Switch
              id="saver-mode"
              checked={Boolean(settings?.enableProSaverMode)}
              onCheckedChange={toggleSaverMode}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Label htmlFor="lazy-edits">Turbo Edits</Label>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-72">
                    Edits files faster.
                  </TooltipContent>
                </Tooltip>
                <p className="text-xs text-muted-foreground max-w-55">
                  Makes editing files faster and cheaper.
                </p>
              </div>
            </div>
            <Switch
              id="lazy-edits"
              checked={Boolean(settings?.enableProLazyEditsMode)}
              onCheckedChange={toggleLazyEdits}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Label htmlFor="smart-context">Smart Context</Label>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-72">
                    Improve efficiency and save credits working on large
                    codebases.
                  </TooltipContent>
                </Tooltip>
                <p className="text-xs text-muted-foreground max-w-55">
                  Automatically detects the most relevant files for your chat
                </p>
              </div>
            </div>
            <Switch
              id="smart-context"
              checked={Boolean(settings?.enableProSmartFilesContextMode)}
              onCheckedChange={toggleSmartContext}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
