"use client";

import {
  EntityHeader,
  EntityContainer,
  EntitySearch,
  EntityPagination,
  LoadingView,
  ErrorView,
  EmptyView,
  EntityList,
  EntityItem,
} from "../editor/entity-component";
import { useDeleteCredential, Credential, CredentialType } from "@/hooks/useCredentials";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { KeyIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { credentialTypeOptions } from "./credential-form";

export const CredentialsHeader = ({ disabled }: { disabled?: boolean }) => {
  const router = useRouter();

  const handleNew = () => {
    router.push("/credentials/new");
  };

  return (
    <EntityHeader
      title="Credentials"
      description="Create and manage your credentials"
      newButtonLabel="New Credential"
      onNew={handleNew}
      disabled={disabled}
      newButtonDataTourTarget="new-credential-button"
    />
  );
};

export const CredentialsContainer = ({
  children,
  searchValue,
  onSearchChange,
  currentPage,
  totalPages,
  onPageChange,
  disabled,
}: {
  children: React.ReactNode;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  disabled?: boolean;
}) => {
  return (
    <EntityContainer
      header={<CredentialsHeader disabled={disabled} />}
      search={
        searchValue !== undefined && onSearchChange ? (
          <CredentialsSearch value={searchValue} onChange={onSearchChange} />
        ) : undefined
      }
      pagination={
        currentPage !== undefined && totalPages !== undefined && onPageChange ? (
          <CredentialsPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        ) : undefined
      }
    >
      {children}
    </EntityContainer>
  );
};

export const CredentialsSearch = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => {
  return <EntitySearch value={value} onChange={onChange} placeholder="Search credentials" />;
};

export const CredentialsPagination = ({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) => {
  return (
    <EntityPagination
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={onPageChange}
    />
  );
};

export const CredentialsLoadingView = () => {
  return <LoadingView entity="credentials" message="Loading credentials..." />;
};

export const CredentialsErrorView = () => {
  return <ErrorView message="Error loading credentials" />;
};

export const CredentialsEmptyView = ({
  isCreating,
  onCreateCredential,
}: {
  isCreating?: boolean;
  onCreateCredential?: () => void;
}) => {
  return (
    <EmptyView
      message="No credentials found. Create your first credential to get started."
      onNew={onCreateCredential}
      isCreating={isCreating}
    />
  );
};

export const CredentialsList = ({ credentials }: { credentials: Credential[] }) => {
  return (
    <EntityList
      items={credentials}
      renderItem={(credential) => <CredentialsItem credential={credential} />}
      getKey={(credential) => credential.id}
      emptyView={<CredentialsEmptyView />}
    />
  );
};

const getCredentialTypeOption = (type: string) => {
  return credentialTypeOptions.find(
    (option) => option.value === type || option.value.toLowerCase() === type.toLowerCase()
  );
};

export const CredentialsItem = ({ credential }: { credential: Credential }) => {
  const deleteCredential = useDeleteCredential();
  const { user } = useAuth();
  const credentialOption = getCredentialTypeOption(credential.type);
  const isShared = credential.userId !== undefined && credential.userId !== user?.id;

  const handleDelete = async () => {
    await deleteCredential.mutateAsync({ id: credential.id, name: credential.name });
  };

  return (
    <EntityItem
      href={`/credentials/${credential.id}`}
      title={credential.name}
      subtitle={
        <span className="flex items-center gap-2">
          <span>
            Updated {formatDistanceToNow(credential.updatedAt, { addSuffix: true })} &bull; Created{" "}
            {formatDistanceToNow(credential.createdAt, { addSuffix: true })}
          </span>
          {isShared && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              Shared
            </Badge>
          )}
        </span>
      }
      image={
        credentialOption && credentialOption.logo ? (
          <div className="size-8 flex items-center justify-center">
            <Image
              src={credentialOption.logo}
              alt={credentialOption.label}
              width={32}
              height={32}
              className="object-contain"
            />
          </div>
        ) : (
          <div className="size-8 flex items-center justify-center">
            <KeyIcon className="size-5 text-muted-foreground" />
          </div>
        )
      }
      onRemove={handleDelete}
      isRemoving={deleteCredential.isPending}
    />
  );
};
