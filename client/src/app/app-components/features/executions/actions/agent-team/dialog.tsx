"use client";

import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlusIcon, TrashIcon } from "lucide-react";

const agentSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  personality: z.string().optional(),
});

const formSchema = z.object({
  variables: z.string().min(1, "Variable name is required"),
  objective: z.string().min(1, "Objective is required"),
  strategy: z.enum(["sequential", "parallel", "supervisor"]),
  agents: z.array(agentSchema).min(1, "At least one agent is required"),
  maxRounds: z.number().min(1).max(20).optional(),
});

export type AgentTeamFormValues = z.infer<typeof formSchema>;

interface AgentTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: AgentTeamFormValues) => void;
  defaultValues?: Partial<AgentTeamFormValues>;
}

export function AgentTeamDialog({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
}: AgentTeamDialogProps) {
  const form = useForm<AgentTeamFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues?.variables ?? "agentTeam",
      objective: defaultValues?.objective ?? "",
      strategy: defaultValues?.strategy ?? "sequential",
      agents: defaultValues?.agents ?? [
        { name: "Researcher", role: "researcher", personality: "" },
      ],
      maxRounds: defaultValues?.maxRounds ?? 5,
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "agents" });

  const handleSubmit = (values: AgentTeamFormValues) => {
    onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px] w-[calc(100%-2rem)] sm:w-full sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Configure Agent Team</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex flex-col flex-1 min-h-0 gap-0"
        >
          <div className="space-y-4 mt-4 overflow-y-auto flex-1 pr-2 -mr-2">
            <div className="space-y-2">
              <Label>Variable Name</Label>
              <Input placeholder="agentTeam" {...form.register("variables")} />
            </div>

            <div className="space-y-2">
              <Label>Objective</Label>
              <Textarea
                placeholder="Research and write a blog post about AI trends..."
                {...form.register("objective")}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Strategy</Label>
                <Controller
                  name="strategy"
                  control={form.control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select strategy" />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        <SelectItem value="sequential">Sequential</SelectItem>
                        <SelectItem value="parallel">Parallel</SelectItem>
                        <SelectItem value="supervisor">Supervisor</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Rounds (supervisor mode)</Label>
                <Input type="number" {...form.register("maxRounds", { valueAsNumber: true })} />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label>Agents</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ name: "", role: "", personality: "" })}
                >
                  <PlusIcon className="mr-1 h-3 w-3" /> Add Agent
                </Button>
              </div>
              {fields.map((field, index) => (
                <div key={field.id} className="p-3 rounded-lg border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Agent {index + 1}</span>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-red-500 shrink-0"
                        onClick={() => remove(index)}
                      >
                        <TrashIcon className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      placeholder="Name (e.g. Researcher)"
                      {...form.register(`agents.${index}.name`)}
                    />
                    <Input
                      placeholder="Role (e.g. researcher)"
                      {...form.register(`agents.${index}.role`)}
                    />
                  </div>
                  <Textarea
                    placeholder="Personality / system prompt (optional)"
                    {...form.register(`agents.${index}.personality`)}
                    rows={2}
                  />
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="mt-4 shrink-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Configuration</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
