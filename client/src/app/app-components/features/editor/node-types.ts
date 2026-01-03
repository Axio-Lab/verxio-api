// NodeType enum matching backend schema
export const NodeType = {
  INITIAL: 'INITIAL',
  MANUAL_TRIGGER: 'MANUAL_TRIGGER',
  HTTP_REQUEST: 'HTTP_REQUEST',
  WEBHOOK: 'WEBHOOK',
  GOOGLE_FORM_TRIGGER: 'GOOGLE_FORM_TRIGGER',
  STRIPE_TRIGGER: 'STRIPE_TRIGGER',
  ANTHROPIC: 'ANTHROPIC',
  GEMINI: 'GEMINI',
  OPENAI: 'OPENAI',
} as const;

export type NodeTypeValue = typeof NodeType[keyof typeof NodeType];

