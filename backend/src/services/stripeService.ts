import * as workflowService from './workflowService';

/**
 * Validates that a workflow contains a Stripe trigger node
 * @param workflowId - The ID of the workflow to validate
 * @returns The Stripe trigger node if found
 * @throws Error if workflow or Stripe trigger node is not found
 */
export const validateStripeTrigger = async (workflowId: string) => {
  // Get workflow without user validation (webhooks are public)
  const workflow = await workflowService.getWorkflowById(workflowId);
  
  // Find the Stripe trigger node in the workflow
  const stripeNode = workflow.nodes.find((node: any) => node.type === 'STRIPE_TRIGGER');
  
  if (!stripeNode) {
    throw new Error('Stripe trigger node not found in workflow');
  }
  
  return {
    workflow,
    stripeNode,
  };
};

/**
 * Validates Stripe webhook signature
 * @param payload - Raw request body
 * @param signature - Stripe signature from header
 * @param secret - Webhook signing secret
 * @returns True if signature is valid
 */
export const validateStripeSignature = (
  payload: string | Buffer,
  signature: string,
  secret: string
): boolean => {
  // For now, we'll do basic validation
  // In production, you should use Stripe's SDK to verify signatures
  // This requires installing @stripe/stripe-js or stripe package
  if (!signature || !secret) {
    return false;
  }
  
  // Basic check - in production, use Stripe's webhook signature verification
  // const stripe = require('stripe')(secret);
  // return stripe.webhooks.constructEvent(payload, signature, secret);
  
  return true; // Placeholder - implement proper Stripe signature verification
};

