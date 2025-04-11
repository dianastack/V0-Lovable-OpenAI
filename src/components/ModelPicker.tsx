import type { LargeLanguageModel, ModelProvider } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState } from "react";
import { MODEL_OPTIONS } from "@/constants/models";

interface ModelPickerProps {
  selectedModel: LargeLanguageModel;
  onModelSelect: (model: LargeLanguageModel) => void;
}

export function ModelPicker({
  selectedModel,
  onModelSelect,
}: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const modelDisplayName = MODEL_OPTIONS[selectedModel.provider].find(
    (model) => model.name === selectedModel.name
  )?.displayName;

  // Flatten the model options into a single array with provider information
  const allModels = Object.entries(MODEL_OPTIONS).flatMap(
    ([provider, models]) =>
      models.map((model) => ({
        ...model,
        provider: provider as ModelProvider,
      }))
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2 h-8"
        >
          <span>
            <span className="text-xs text-muted-foreground">Model:</span>{" "}
            {modelDisplayName}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        <div className="grid gap-2">
          {allModels.map((model) => (
            <Tooltip key={model.name}>
              <TooltipTrigger asChild>
                <Button
                  variant={
                    selectedModel.name === model.name ? "secondary" : "ghost"
                  }
                  className="w-full justify-start font-normal"
                  onClick={() => {
                    onModelSelect({
                      name: model.name,
                      provider: model.provider,
                    });
                    setOpen(false);
                  }}
                >
                  <div className="flex justify-between items-start w-full">
                    <span className="flex flex-col items-start">
                      <span>{model.displayName}</span>
                      <span className="text-xs text-muted-foreground">
                        {model.provider}
                      </span>
                    </span>
                    {model.tag && (
                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                        {model.tag}
                      </span>
                    )}
                  </div>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{model.description}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
