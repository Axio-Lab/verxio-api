"use client";

import { useState } from "react";
import { EntityHeader, EntityContainer, EntitySearch, EntityPagination } from "./entity-component";



export const WorkflowsHeader = ({ disabled }: { disabled?: boolean }) => {
    return (
        <EntityHeader
            title="Workflows"
            description="Create and manage workflows to automate your business processes"
            onNew={() => { }}
            newButtonLabel="New Workflow"
            disabled={disabled}
            isCreating={false}
        />
    )
}

export const WorkflowsContainer = ({ children }: { children: React.ReactNode }) => {
    return (
        <EntityContainer
            header={<WorkflowsHeader />}
            search={<WorkflowsSearch />}
            pagination={<WorkflowsPagination />}>
            {children}
        </EntityContainer>
    )
}

export const WorkflowsSearch = () => {
    return (
        <EntitySearch
            value={""}
            onChange={() => {}}
            placeholder="Search workflows"
        />
    )
}

export const WorkflowsPagination = () => {
    const [currentPage, setCurrentPage] = useState(1);
    const totalPages = 2; // Replace with actual total pages from your data
    const totalItems = 10; // Replace with actual total items from your data
    const itemsPerPage = 5; // Replace with your items per page

    return (
        
        <EntityPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            showInfo={true}
        />
    )
}
