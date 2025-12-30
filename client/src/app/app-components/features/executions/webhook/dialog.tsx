"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const WebhookDialog = ({
    open,
    onOpenChange,
}: Props) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Webhook</DialogTitle>
                    <DialogDescription>
                        Configure settings for the webhook.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <p className="text-sm text-muted-foreground">
                        Webhook Configuration
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
};

