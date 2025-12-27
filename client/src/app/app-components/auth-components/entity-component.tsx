import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { Spinner } from "@/components/ui/spinner";

type EntityHeaderProps = {
    title: string;
    description?: string;
    newButtonLabel: string;
    disabled?: boolean;
    isCreating?: boolean;
} & (
        | { onNew: () => void; newButtonRef?: never }
        | { newButtonRef: string; onNew?: never; newButtonLabel?: never }
        | { onNew?: never; newButtonRef?: never }
    )

type EntityContainerProps = {
    header?: React.ReactNode;
    search?: React.ReactNode;
    pagination?: React.ReactNode;
    children: React.ReactNode;
}

export const EntityHeader = ({
    title,
    description,
    newButtonLabel,
    newButtonRef,
    disabled,
    isCreating,
    onNew
}: EntityHeaderProps) => {

    const handleNew = () => {
        if (onNew) {
            onNew();
        }
    };

    return (
        <div className="flex flex-row items-center justify-between gap-x-4">
            <div className="flex flex-col">
                <h1 className="text-lg md:text-xl font-semibold">{title}</h1>
                {description && <p className="text-xs md:text-sm text-muted-foreground">{description}</p>}
            </div>
            {
                onNew && !newButtonRef && (
                    <Button
                        disabled={disabled || isCreating}
                        onClick={handleNew}
                        size="sm"
                        className="flex items-center gap-2"
                    >
                        {isCreating ? (
                            <>
                                <Spinner className="size-4" />
                                <span>Creating...</span>
                            </>
                        ) : (
                            <>
                                <PlusIcon className="size-4" />
                                {newButtonLabel}
                            </>
                        )}
                    </Button>
                )}
            {
                newButtonRef && !onNew && (
                    <Button
                        size="sm"
                        asChild>
                        <Link href={newButtonRef} prefetch >
                            <PlusIcon className="size-4" />
                            {newButtonLabel}
                        </Link>
                    </Button>

                )}
        </div>
    )
}

export const EntityContainer = ({ header, search, pagination, children }: EntityContainerProps) => {
    return (
        <div className="p-4 md:px-10 md:py-6 h-full">
            <div className="mx-auto max-w-screen-xl flex flex-col gap-y-8 h-full">
                {header}

                <div>
                    {search}
                    {children}
                </div>
                {pagination}
            </div>
        </div>
    )
}