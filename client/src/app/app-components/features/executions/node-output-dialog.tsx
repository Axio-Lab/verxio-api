"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface NodeOutputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  output: Record<string, unknown> | null;
}

export function NodeOutputDialog({ open, onOpenChange, output }: NodeOutputDialogProps) {
  const displayOutput = output;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Node Output</DialogTitle>
          <DialogDescription>Output data for this node from the execution</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto mt-4">
          {!displayOutput && (
            <p className="text-sm text-muted-foreground">
              No output available yet. Run the workflow to see output.
            </p>
          )}
          {displayOutput && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Output Data</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-96">
                  {JSON.stringify(displayOutput, null, 2)}
                </pre>
                <p className="text-xs text-muted-foreground mt-4">
                  Use the variable names shown above in other nodes with Handlebars templating
                  (e.g.,{" "}
                  <code className="bg-background px-1 py-0.5 rounded">
                    {"{{variableName.field}}"}
                  </code>
                  )
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
