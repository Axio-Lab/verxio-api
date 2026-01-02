import * as workflowService from './workflowService';

/**
 * Validates that a workflow contains a Google Form trigger node
 * @param workflowId - The ID of the workflow to validate
 * @returns The Google Form trigger node if found
 * @throws Error if workflow or Google Form trigger node is not found
 */
export const validateGoogleFormTrigger = async (workflowId: string) => {
  // Get workflow without user validation (webhooks are public)
  const workflow = await workflowService.getWorkflowById(workflowId);
  
  // Find the Google Form trigger node in the workflow
  const googleFormNode = workflow.nodes.find((node: any) => node.type === 'GOOGLE_FORM_TRIGGER');
  
  if (!googleFormNode) {
    throw new Error('Google Form trigger node not found in workflow');
  }
  
  return {
    workflow,
    googleFormNode,
  };
};

/**
 * Prepares Google Form payload for workflow execution
 * @param googleFormPayload - The raw payload from Google Form
 * @returns Formatted payload ready for workflow context
 */
export const prepareGoogleFormPayload = (googleFormPayload: any) => {
  return {
    formId: googleFormPayload.formId,
    formTitle: googleFormPayload.formTitle,
    responseId: googleFormPayload.responseId,
    timestamp: googleFormPayload.timestamp,
    respondentEmail: googleFormPayload.respondentEmail,
    responses: googleFormPayload.responses || {},
    raw: googleFormPayload,
  };
};

