// NodeType enum matching backend schema
export const NodeType = {
  INITIAL: 'INITIAL',
  MANUAL_TRIGGER: 'MANUAL_TRIGGER',
  HTTP_REQUEST: 'HTTP_REQUEST',
  WEBHOOK: 'WEBHOOK',
} as const;

export type NodeTypeValue = typeof NodeType[keyof typeof NodeType];

