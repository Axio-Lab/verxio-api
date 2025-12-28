import { Button } from "@/components/ui/button";
import { PlusIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";

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

type EntitySearchProps = {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

type EntityPaginationProps = {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalItems?: number;
    itemsPerPage?: number;
    showInfo?: boolean;
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
        <div className="flex flex-row items-start justify-between gap-x-4">
            <div className="flex flex-col">
                <h1 className="text-lg md:text-xl font-semibold">{title}</h1>
                {description && <p className="text-xs md:text-sm text-muted-foreground">{description}</p>}
            </div>
            <div className="flex flex-col items-end gap-3">
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
                    )
                }
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
                    )
                }
            </div>
        </div>
    )
}

export const EntityContainer = ({ header, search, pagination, children }: EntityContainerProps) => {
    return (
        <div className="px-4 md:px-6 py-4 md:py-6 h-full flex flex-col">
            <div className="w-full flex flex-col gap-y-8 h-full flex-1">
                <div>
                    {header}
                    {search && (
                        <div className="flex justify-end mt-3">
                            {search}
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-4 flex-1">
                    {children}
                </div>
            </div>
            {pagination && (
                <div className="mt-auto">
                    {pagination}
                </div>
            )}
        </div>
    )
}

export const EntitySearch = ({ value, onChange, placeholder = "Search" }: EntitySearchProps) => {
    return (
        <div className="relative w-full sm:w-auto">
            <SearchIcon className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
            <Input
                className="pl-8 w-full sm:w-auto sm:min-w-[200px] sm:max-w-[300px] bg-background shadow-none border-border"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
            />
        </div>
    )
}

export const EntityPagination = ({
    currentPage,
    totalPages,
    onPageChange,
    totalItems,
    itemsPerPage = 10,
    showInfo = true,
}: EntityPaginationProps) => {
    // Don't render if there's only one page or no pages
    if (totalPages <= 1) {
        return null;
    }

    // Calculate page range to show
    const getPageNumbers = () => {
        const pages: (number | "ellipsis")[] = [];
        const maxVisible = 5; // Show max 5 page numbers

        if (totalPages <= maxVisible) {
            // Show all pages if total is less than max
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            // Always show first page
            pages.push(1);

            if (currentPage <= 3) {
                // Show first 4 pages and ellipsis
                for (let i = 2; i <= 4; i++) {
                    pages.push(i);
                }
                pages.push("ellipsis");
                pages.push(totalPages);
            } else if (currentPage >= totalPages - 2) {
                // Show ellipsis and last 4 pages
                pages.push("ellipsis");
                for (let i = totalPages - 3; i <= totalPages; i++) {
                    pages.push(i);
                }
            } else {
                // Show ellipsis, current page range, and ellipsis
                pages.push("ellipsis");
                for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                    pages.push(i);
                }
                pages.push("ellipsis");
                pages.push(totalPages);
            }
        }

        return pages;
    };

    const pageNumbers = getPageNumbers();

    // Calculate item range for info display
    const startItem = totalItems ? (currentPage - 1) * itemsPerPage + 1 : 0;
    const endItem = totalItems
        ? Math.min(currentPage * itemsPerPage, totalItems)
        : 0;

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
            {showInfo && (
                <div className="text-sm text-textSecondary">
                    Page <span className="font-semibold text-textPrimary">{currentPage}</span> of{" "}
                    <span className="font-semibold text-textPrimary">{totalPages}</span>
                </div>
            )}
            <div className="flex items-center justify-center gap-2">
                <button
                    onClick={() => {
                        if (currentPage > 1) {
                            onPageChange(currentPage - 1);
                        }
                    }}
                    disabled={currentPage === 1}
                    className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-textPrimary transition-colors hover:border-primary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Previous
                </button>
                
                <div className="flex items-center gap-1">
                    {pageNumbers.map((page, index) => {
                        if (page === "ellipsis") {
                            return (
                                <span
                                    key={`ellipsis-${index}`}
                                    className="flex h-9 w-9 items-center justify-center text-textSecondary"
                                >
                                    ...
                                </span>
                            );
                        }

                        return (
                            <button
                                key={page}
                                onClick={() => onPageChange(page)}
                                className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                                    currentPage === page
                                        ? "bg-primary text-white"
                                        : "border border-gray-200 bg-white text-textPrimary hover:border-primary hover:text-primary"
                                }`}
                            >
                                {page}
                            </button>
                        );
                    })}
                </div>
                
                <button
                    onClick={() => {
                        if (currentPage < totalPages) {
                            onPageChange(currentPage + 1);
                        }
                    }}
                    disabled={currentPage === totalPages}
                    className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-textPrimary transition-colors hover:border-primary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Next
                </button>
            </div>
        </div>
    );
};