"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { timezones } from "@/lib/timezones";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

export type TimedTriggerFormValues = {
  scheduleType: "interval" | "daily" | "weekly" | "monthly" | "cron";
  intervalHours?: number;
  intervalMinutes?: number;
  cronExpression?: string;
  timezone: string;
  enabled: boolean;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: TimedTriggerFormValues) => void;
  defaultValues?: Partial<TimedTriggerFormValues>;
}

export const TimedTriggerDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  const [scheduleType, setScheduleType] = useState<
    "interval" | "daily" | "weekly" | "monthly" | "cron"
  >(defaultValues.scheduleType || "interval");
  const [intervalHours, setIntervalHours] = useState<string>(
    defaultValues.intervalHours?.toString() || "1"
  );
  const [intervalMinutes, setIntervalMinutes] = useState<string>(
    defaultValues.intervalMinutes?.toString() || "0"
  );
  const [cronExpression, setCronExpression] = useState<string>(defaultValues.cronExpression || "");
  const [timezone, setTimezone] = useState<string>(defaultValues.timezone || "UTC");
  const [enabled, setEnabled] = useState<boolean>(
    defaultValues.enabled !== undefined ? defaultValues.enabled : true
  );

  useEffect(() => {
    if (open) {
      setScheduleType(defaultValues.scheduleType || "interval");
      setIntervalHours(defaultValues.intervalHours?.toString() || "1");
      setIntervalMinutes(defaultValues.intervalMinutes?.toString() || "0");
      setCronExpression(defaultValues.cronExpression || "");
      setTimezone(defaultValues.timezone || "UTC");
      setEnabled(defaultValues.enabled !== undefined ? defaultValues.enabled : true);
    }
  }, [open, defaultValues]);

  const handleSave = async () => {
    try {
      await Promise.resolve(
        onSubmit({
          scheduleType,
          intervalHours: scheduleType === "interval" ? parseInt(intervalHours) : undefined,
          intervalMinutes: scheduleType === "interval" ? parseInt(intervalMinutes) : undefined,
          cronExpression: scheduleType === "cron" ? cronExpression : undefined,
          timezone,
          enabled,
        })
      );
      onOpenChange(false);
      toast.success("Timed trigger configured");
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Timed Trigger</DialogTitle>
          <DialogDescription>Configure the schedule for this timed trigger.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col flex-1 min-h-0">
          <div className="space-y-4 mt-4 overflow-y-auto flex-1 pr-2 -mr-2">
            <div className="space-y-2">
              <Label htmlFor="schedule-type">Schedule Type</Label>
              <Select
                value={scheduleType}
                onValueChange={(value) => setScheduleType(value as typeof scheduleType)}
              >
                <SelectTrigger id="schedule-type">
                  <SelectValue placeholder="Select schedule type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="interval">Interval (Every X hours/minutes)</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="cron">Custom Cron Expression</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {scheduleType === "interval" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="interval-hours">Hours</Label>
                  <Input
                    id="interval-hours"
                    type="number"
                    min="0"
                    value={intervalHours}
                    onChange={(e) => setIntervalHours(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="interval-minutes">Minutes</Label>
                  <Input
                    id="interval-minutes"
                    type="number"
                    min="0"
                    max="59"
                    value={intervalMinutes}
                    onChange={(e) => setIntervalMinutes(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </>
            )}

            {scheduleType === "cron" && (
              <div className="space-y-2">
                <Label htmlFor="cron-expression">Cron Expression</Label>
                <Input
                  id="cron-expression"
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  placeholder="0 0 * * *"
                />
                <p className="text-xs text-muted-foreground">
                  Use standard cron syntax (e.g., "0 0 * * *" for daily at midnight)
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger id="timezone">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {timezones.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Select the timezone for the schedule</p>
            </div>

            <div className="flex items-center justify-between space-x-2 pt-2">
              <div className="space-y-0.5">
                <Label htmlFor="enabled">Schedule Status</Label>
                <p className="text-xs text-muted-foreground">
                  {enabled
                    ? "Schedule is active and will run automatically"
                    : "Schedule is paused and will not run"}
                </p>
              </div>
              <Switch id="enabled" checked={enabled} onCheckedChange={setEnabled} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 mt-4 border-t flex-shrink-0">
            <Button onClick={handleSave}>Save Configuration</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
