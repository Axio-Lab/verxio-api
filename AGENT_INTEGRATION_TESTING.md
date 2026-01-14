# Verxio Agentic Copilot - Integration Testing Guide

## Overview

This document outlines how to test the newly integrated Claude Agent SDK features in Verxio.

## Prerequisites

1. **Environment Variables** - Ensure `ANTHROPIC_API_KEY` is set in your `.env` file
2. **Database** - Run `npm run db:push` in backend to apply schema changes
3. **Dependencies** - All packages installed (`@anthropic-ai/claude-code`, `zod`)

## Testing Checklist

### 1. Connections Feature

#### Test: Create MCP Server Connection
1. Navigate to `/connections`
2. Click "New Connection"
3. Select "MCP Server" type
4. Configure a test Supabase MCP connection:
   - Name: "Test Supabase DB"
   - Transport: SSE
   - Server URL: `https://your-mcp-server.com`
   - API Key: (your key)
5. Click "Create Connection"
6. Verify connection appears in the list
7. Click "Test" button to test connectivity

#### Test: Create Database Connection
1. Click "New Connection"
2. Select "Database" type
3. Configure Supabase:
   - Provider: Supabase
   - Supabase URL: `https://your-project.supabase.co`
   - Supabase Key: (your service role key)
4. Save and test the connection

#### Test: Create Documentation Connection
1. Click "New Connection"
2. Select "Documentation" type
3. Choose source type "Text"
4. Paste API documentation (OpenAPI spec or markdown)
5. Select file type "openapi" or "markdown"
6. Save the connection

### 2. Claude Agent Workflow Generation

#### Test: Autonomous Workflow Creation
1. Go to `/workflows`
2. Create a new workflow
3. Open the workflow editor
4. Click the AI generation button (Sparkles icon)
5. Enter a prompt: "Create a workflow that fetches data from an API and saves it to Google Sheets"
6. Click "Generate"
7. **Expected Behavior**:
   - Agent uses `createWorkflow` tool to create the workflow
   - Agent uses `addNode` tool to add HTTP_REQUEST node
   - Agent uses `addNode` tool to add GOOGLE_SHEETS node
   - Agent uses `connectNodes` tool to link them
   - Agent uses `configureNode` tool to set up each node
   - Agent checks for required credentials with `checkCredential`
   - If Google OAuth missing, agent uses `requestCredential` to ask user

#### Test: Workflow Generation with Connections
1. First, add a Supabase MCP connection
2. Create a new workflow
3. Prompt: "Create a workflow that reads from my Supabase database and sends a summary to Slack"
4. **Expected Behavior**:
   - Agent accesses user's Supabase connection via `getConnections` tool
   - Agent creates workflow with appropriate nodes
   - Agent configures database queries using the connection

### 3. Planning Mode

#### Test: Planning Conversation
1. Create a new workflow
2. Click the "Plan" button to open plan dialog
3. Have a conversation with the agent:
   - User: "I want to automate my daily standup reports"
   - Agent: (should ask clarifying questions about data sources, format, recipients)
   - User: "Pull data from Airtable and send to Slack"
   - Agent: (should suggest workflow structure and check credentials)
4. **Expected Behavior**:
   - Conversation is saved to `WorkflowPlan`
   - Agent uses `listNodeTypes` to explain options
   - Agent uses `checkCredential` to verify Airtable/Slack credentials
   - Agent provides helpful suggestions

### 4. Credential Management

#### Test: Missing Credential Detection
1. Create a workflow
2. Try to add an Anthropic node without having ANTHROPIC credential
3. Configure the node
4. **Expected Behavior**:
   - Agent detects missing credential via `checkCredential` tool
   - Agent uses `requestCredential` tool to inform user
   - User receives clear message with setup instructions
   - Message includes link to https://console.anthropic.com

### 5. Learning System

#### Test: Execution History
1. Execute a workflow multiple times
2. Check database for `ExecutionHistory` records
3. **Expected Behavior**:
   - Each execution creates a record with:
     - Success/failure status
     - Duration
     - Node-level metrics
     - Error context (if failed)

#### Test: Pattern Recognition
1. Create similar workflows (e.g., multiple "API to Sheets" workflows)
2. Execute them successfully
3. Check database for `WorkflowPattern` records
4. **Expected Behavior**:
   - System extracts common patterns
   - Patterns include node types and connection structure
   - `useCount` and `successRate` are tracked

### 6. Streaming SSE Endpoints

#### Test: Workflow Generation Stream
```bash
curl -X POST http://localhost:8080/workflow-generation/generate/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "prompt": "Create a workflow that sends daily reports",
    "model": "claude-sonnet-4-5-20250929"
  }'
```

**Expected Output**:
- SSE events with agent activity
- `type: "tool_use"` events showing agent using Verxio tools
- `type: "message"` events with agent thinking
- `type: "complete"` when done

#### Test: Planning Stream
```bash
curl -X POST http://localhost:8080/planning/message/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "workflowId": "YOUR_WORKFLOW_ID",
    "message": "How can I automate customer onboarding?"
  }'
```

**Expected Output**:
- Streaming agent responses
- Real-time thinking and tool usage
- Final response with suggestions

## API Endpoints Summary

### Connections
- `GET /connections` - List connections
- `POST /connections` - Create connection
- `GET /connections/:id` - Get connection
- `PUT /connections/:id` - Update connection
- `DELETE /connections/:id` - Delete connection
- `POST /connections/:id/test` - Test connection
- `POST /connections/:id/toggle` - Toggle active status

### Workflow Generation
- `POST /workflow-generation/generate` - Generate workflow (non-streaming)
- `POST /workflow-generation/generate/stream` - Generate workflow (SSE streaming)
- `GET /workflow-generation/:id` - Get generation status
- `POST /workflow-generation/:id/approve` - Approve and get nodes
- `POST /workflow-generation/:id/test` - Test code blocks

### Planning
- `GET /planning/workflow/:workflowId` - Get plan
- `POST /planning/message` - Send message (non-streaming)
- `POST /planning/message/stream` - Send message (SSE streaming)
- `POST /planning/generate-prompt` - Generate final prompt
- `POST /planning/upload` - Upload files
- `DELETE /planning/workflow/:workflowId/clear` - Clear conversation

## Database Verification

### Check New Models

```sql
-- Check UserConnection table
SELECT * FROM user_connections LIMIT 5;

-- Check ExecutionHistory table
SELECT * FROM execution_history LIMIT 5;

-- Check WorkflowPattern table
SELECT * FROM workflow_patterns LIMIT 5;
```

## Agent Tool Usage Verification

The Claude Agent should have access to these tools:

1. **listNodeTypes** - List all available Verxio nodes
2. **createWorkflow** - Create new workflows
3. **getWorkflow** - Get workflow details
4. **addNode** - Add nodes to workflows
5. **configureNode** - Configure node settings
6. **connectNodes** - Connect nodes together
7. **executeWorkflow** - Trigger workflow execution
8. **getCredentials** - List user credentials
9. **checkCredential** - Check if credential exists
10. **requestCredential** - Request missing credentials
11. **getConnections** - Get user's MCP/database connections
12. **searchDocumentation** - Search documentation connections
13. **generateCode** - Generate TypeScript for CODE_BLOCK nodes
14. **deleteNode** - Remove nodes from workflow
15. **listWorkflows** - List user's workflows

## Expected Agent Behavior

### Scenario 1: Simple Workflow
**User**: "Create a workflow that sends me a daily email summary"

**Agent should**:
1. Use `createWorkflow` to create new workflow named "Daily Email Summary"
2. Use `addNode` to add TIMED_TRIGGER (with cron: "0 9 * * *")
3. Use `addNode` to add ANTHROPIC node (to generate summary)
4. Use `addNode` to add GMAIL node (to send email)
5. Use `connectNodes` to link: TIMED_TRIGGER -> ANTHROPIC -> GMAIL
6. Use `configureNode` to set prompts and email details
7. Use `checkCredential` to verify ANTHROPIC credential exists
8. Use `checkCredential` to verify Google OAuth exists
9. If missing, use `requestCredential` to ask user to add them

### Scenario 2: Database Integration
**User**: "Create a workflow that reads from Supabase and updates a spreadsheet"

**Agent should**:
1. Use `getConnections` to find Supabase MCP connection
2. Create workflow with appropriate nodes
3. Configure nodes to use the MCP connection
4. Check for Google OAuth
5. Provide complete working workflow

### Scenario 3: Missing Credentials
**User**: "Send a message to Telegram when form is submitted"

**Agent should**:
1. Check for TELEGRAM credential
2. If missing, use `requestCredential` with clear instructions:
   - "Open Telegram and search for @BotFather"
   - "Send /newbot and follow instructions"
   - "Copy the bot token"
   - "Add it at /credentials/new"
3. Continue building workflow structure even without credential

## Common Issues & Solutions

### Issue: Agent doesn't have access to tools
**Solution**: Verify MCP server is created correctly in `claudeAgentService.ts`

### Issue: Streaming doesn't work
**Solution**: Check SSE headers are set correctly, ensure client supports EventSource

### Issue: Database connection test fails
**Solution**: Verify credentials are correct, check network access to database

### Issue: Agent can't find user connections
**Solution**: Ensure connections are marked as `isActive: true` in database

## Success Criteria

- [ ] Can create connections via UI
- [ ] Connections are tested and marked active
- [ ] Agent can generate workflows autonomously
- [ ] Agent uses Verxio tools to create/configure nodes
- [ ] Agent detects missing credentials
- [ ] Agent requests credentials with clear instructions
- [ ] Agent accesses user's MCP connections
- [ ] Streaming endpoints work for real-time updates
- [ ] Execution history is recorded
- [ ] Patterns are learned from successful executions
- [ ] Frontend shows all connection types correctly
- [ ] All TypeScript compiles without errors

## Next Steps After Testing

1. **Enhance Streaming UI**: Update frontend panels to show real-time agent activity
2. **Add Agent Activity Log**: Show which tools the agent is using
3. **Improve Pattern Matching**: Use embeddings for better workflow suggestions
4. **Add Auto-Recovery**: Implement automatic error recovery workflows
5. **Create Workflow Templates**: Pre-built templates from learned patterns
6. **Add Monitoring**: Track agent performance and costs
7. **Implement Rate Limiting**: Prevent abuse of agent queries
