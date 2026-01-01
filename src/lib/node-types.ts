/**
 * Node type constants matching the Prisma NodeType enum (schema.prisma lines 325-330)
 * Use these constants throughout the codebase to ensure consistency and avoid node type errors
 */
export const NodeType = {
    MANUAL_TRIGGER: "MANUAL_TRIGGER",
    HTTP_REQUEST: "HTTP_REQUEST",
    WEBHOOK: "WEBHOOK",
    INITIAL: "INITIAL",
} as const;