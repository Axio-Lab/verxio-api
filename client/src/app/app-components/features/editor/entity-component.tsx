"use client";
import { Button } from "@/components/ui/button";
import {
  AlertTriangleIcon,
  Loader2Icon,
  MoreVerticalIcon,
  PackageOpenIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type EntityHeaderProps = {
  title: string;
  description?: string;
  newButtonLabel: string;
  disabled?: boolean;
  isCreating?: boolean;
  /** Optional data-tour-target for the New button (e.g. "new-workflow-button") */
  newButtonDataTourTarget?: string;
} & (
  | { onNew: () => void; newButtonRef?: never }
  | { newButtonRef: string; onNew?: never; newButtonLabel?: never }
  | { onNew?: never; newButtonRef?: never }
);

type EntityContainerProps = {
  header?: React.ReactNode;
  search?: React.ReactNode;
  pagination?: React.ReactNode;
  children: React.ReactNode;
};

type EntitySearchProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  dataTourTarget?: string;
};

type EntityPaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  itemsPerPage?: number;
  showInfo?: boolean;
};

interface StatesViewProps {
  message?: string;
}

interface LoadingViewProps extends StatesViewProps {
  entity?: string;
}

interface EmptyViewProps extends StatesViewProps {
  onNew?: () => void;
  isCreating?: boolean;
  newButtonDataTourTarget?: string;
}

interface EntityListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  getKey: (item: T, index: number) => string | number;
  emptyView?: React.ReactNode;
  className?: string;
}

export interface EntityItemDropdownItem {
  label: string;
  onClick: (e: React.MouseEvent) => void | Promise<void>;
  icon?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
}

interface EntityItemProps {
  href: string;
  title: string;
  subtitle?: React.ReactNode;
  image?: React.ReactNode;
  action?: React.ReactNode;
  onRemove?: () => void | Promise<void>;
  isRemoving?: boolean;
  /** When provided, renders these items in the dropdown instead of a single Delete. Use for Export + Delete, etc. */
  dropdownItems?: EntityItemDropdownItem[];
  className?: string;
}

export const EntityHeader = ({
  title,
  description,
  newButtonLabel,
  newButtonRef,
  disabled,
  isCreating,
  onNew,
  newButtonDataTourTarget,
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
        {onNew && !newButtonRef && (
          <Button
            {...(newButtonDataTourTarget && { "data-tour-target": newButtonDataTourTarget })}
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
        {newButtonRef && !onNew && (
          <Button size="sm" asChild>
            <Link href={newButtonRef} prefetch>
              <PlusIcon className="size-4" />
              {newButtonLabel}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
};

export const EntityContainer = ({ header, search, pagination, children }: EntityContainerProps) => {
  return (
    <div className="px-4 md:px-6 py-4 md:py-6 h-full flex flex-col">
      <div className="w-full flex flex-col gap-y-8 h-full flex-1">
        <div>
          {header}
          {search && <div className="flex justify-end mt-3">{search}</div>}
        </div>

        <div className="flex flex-col gap-4 flex-1">{children}</div>
      </div>
      {pagination && <div className="mt-auto">{pagination}</div>}
    </div>
  );
};

export const EntitySearch = ({
  value,
  onChange,
  placeholder = "Search",
  dataTourTarget,
}: EntitySearchProps) => {
  return (
    <div
      className="relative w-full sm:w-auto"
      {...(dataTourTarget && { "data-tour-target": dataTourTarget })}
    >
      <SearchIcon className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
      <Input
        className="pl-8 w-full sm:w-auto sm:min-w-[200px] sm:max-w-[300px] bg-background shadow-none border-border"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
};

export const EntityPagination = ({
  currentPage,
  totalPages,
  onPageChange,
  showInfo = true,
}: EntityPaginationProps) => {
  // Don't render if there's only one page or no pages
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-center gap-2 mt-6">
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
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
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
        ))}
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
  );
};

export const LoadingView = ({ entity = "items", message }: LoadingViewProps) => {
  return (
    <div className="flex  flex-1 flex-col items-center justify-center h-full gap-y-4">
      <Loader2Icon className="size-6 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{message || `Loading ${entity}...`}</p>
    </div>
  );
};

export const ErrorView = ({ message }: StatesViewProps) => {
  return (
    <div className="flex  flex-1 flex-col items-center justify-center h-full gap-y-4">
      <AlertTriangleIcon className="size-6 text-primary" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
};

export const EmptyView = ({
  message,
  onNew,
  isCreating,
  newButtonDataTourTarget,
}: EmptyViewProps) => {
  return (
    <Empty className="border border-dashed bg-white">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <PackageOpenIcon />
        </EmptyMedia>
      </EmptyHeader>
      <EmptyTitle>No items</EmptyTitle>
      {!!message && <EmptyDescription>{message}</EmptyDescription>}
      {!!onNew && (
        <EmptyContent>
          <Button
            {...(newButtonDataTourTarget && { "data-tour-target": newButtonDataTourTarget })}
            onClick={onNew}
            disabled={isCreating}
            className="flex items-center gap-2"
          >
            {isCreating ? (
              <>
                <Spinner className="size-4" />
                <span>Creating...</span>
              </>
            ) : (
              "Add item"
            )}
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
};

export function EntityList<T>({
  items,
  renderItem,
  getKey,
  emptyView,
  className,
}: EntityListProps<T>) {
  if (items.length === 0 && emptyView) {
    return (
      <div className="flex-1 flex justify-center items-center">
        <div className="max-w-sm mx-auto">{emptyView}</div>
      </div>
    );
  }
  return (
    <div className={cn("flex flex-col gap-y-4", className)}>
      {items.map((item, index) => (
        <div key={getKey ? getKey(item, index) : index}>{renderItem(item, index)}</div>
      ))}
    </div>
  );
}

export const EntityItem = ({
  href,
  title,
  subtitle,
  image,
  action,
  onRemove,
  isRemoving,
  dropdownItems,
  className,
}: EntityItemProps) => {
  const [open, setOpen] = useState(false);
  const hasDropdown = (dropdownItems && dropdownItems.length > 0) || onRemove;
  const items: EntityItemDropdownItem[] =
    dropdownItems && dropdownItems.length > 0
      ? dropdownItems
      : onRemove
        ? [
            {
              label: "Delete",
              onClick: async () => {
                await onRemove();
              },
              icon: <TrashIcon className="size-4" />,
              disabled: isRemoving,
              loading: isRemoving,
            },
          ]
        : [];

  const handleItemClick = async (item: EntityItemDropdownItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (item.disabled || item.loading) return;
    try {
      await item.onClick(e);
    } finally {
      setOpen(false);
    }
  };

  return (
    <Link href={href} prefetch>
      <Card
        className={cn(
          "p-4 shadow-none hover:shadow cursor-pointer",
          isRemoving && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        <CardContent className="flex flex-row items-center justify-between p-0">
          <div className="flex items-center gap-3">
            {image}
            <div>
              <CardTitle className="text-base font-medium">{title}</CardTitle>
              {!!subtitle && <CardDescription className="text-xm">{subtitle}</CardDescription>}
            </div>
          </div>
          {(action || hasDropdown) && (
            <div className="flex items-center gap-x-4">
              {action}
              {hasDropdown && (
                <DropdownMenu open={open} onOpenChange={setOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => e.stopPropagation()}
                      disabled={isRemoving}
                    >
                      <MoreVerticalIcon className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent onClick={(e) => e.stopPropagation()} align="end">
                    {items.map((item, i) => (
                      <DropdownMenuItem
                        key={i}
                        onClick={(e) => handleItemClick(item, e)}
                        disabled={item.disabled || item.loading}
                      >
                        {item.loading ? (
                          <>
                            <Spinner className="size-4" />
                            <span>{item.label}...</span>
                          </>
                        ) : (
                          <>
                            {item.icon}
                            <span>{item.label}</span>
                          </>
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
};
