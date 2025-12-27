"use client";

import { EntityHeader, EntityContainer } from "./entity-component";



export const WorkflowsHeader = ({ disabled }: { disabled?: boolean }) => {
    return (
        <>
            <EntityHeader
                title="Workflows"
                description="Create and manage workflows to automate your business processes"
                onNew={() => { }}
                newButtonLabel="New Workflow"
                disabled={disabled}
                isCreating={false}
            />
        </>
    )
}

export const WorkflowsContainer = ({ children }: { children: React.ReactNode }) => {
    return (
        <EntityContainer
            header={<WorkflowsHeader />}
            search={<></>}
            pagination={<></>}>
            {children}
        </EntityContainer>
    )
}