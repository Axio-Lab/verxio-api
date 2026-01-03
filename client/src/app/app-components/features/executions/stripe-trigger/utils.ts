// Stripe trigger doesn't need a script generator like Google Forms
// The webhook is configured directly in Stripe Dashboard
// This file is kept for consistency but can be used for future utilities

export const getStripeWebhookUrl = (workflowId: string): string => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL;
    return `${baseUrl}/api/webhooks/stripe?workflowId=${workflowId}`;
};
