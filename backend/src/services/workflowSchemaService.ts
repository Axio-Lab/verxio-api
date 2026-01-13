import { NodeType } from "@/lib/node-types";

/**
 * Comprehensive workflow schema for Claude to reference when planning and generating workflows.
 * This schema helps Claude understand available nodes, patterns, and best practices for
 * creating workflows that completely and efficiently automate non-technical tasks.
 */

export interface NodeAction {
  name: string;
  description: string;
  useCases: string[];
  inputs: Record<string, { type: string; description: string; required: boolean }>;
  outputs: Record<string, { type: string; description: string }>;
  credentials?: string[];
}

export interface NodeSchema {
  description: string;
  category: "trigger" | "action" | "ai" | "integration" | "logic" | "communication";
  actions: NodeAction[];
  examples: string[];
  bestPractices: string[];
}

export interface WorkflowPattern {
  name: string;
  description: string;
  category: "content" | "data" | "communication" | "automation" | "reporting";
  taskType: "non-technical" | "technical" | "hybrid";
  nodes: Array<{ type: string; purpose: string }>;
  flow: string;
  useCase: string;
  example: string;
}

export interface TaskBreakdownStrategy {
  taskCategory: string;
  approach: string;
  steps: string[];
  nodeRecommendations: string[];
}

export interface WorkflowSchema {
  nodes: Record<string, NodeSchema>;
  patterns: WorkflowPattern[];
  taskBreakdown: {
    strategies: TaskBreakdownStrategy[];
  };
  bestPractices: {
    general: string[];
    nodeSelection: string[];
    dataFlow: string[];
    errorHandling: string[];
    userExperience: string[];
  };
}

/**
 * Returns comprehensive workflow schema for Claude context
 */
export const getWorkflowSchema = (): WorkflowSchema => {
  return {
    nodes: {
      [NodeType.MANUAL_TRIGGER]: {
        description: "Manual trigger that starts workflow execution when user clicks a button",
        category: "trigger",
        actions: [
          {
            name: "trigger",
            description: "Manually trigger workflow execution",
            useCases: ["Testing workflows", "On-demand execution", "User-initiated tasks"],
            inputs: {},
            outputs: {
              trigger: { type: "object", description: "Trigger event data" },
            },
            credentials: [],
          },
        ],
        examples: [
          "Start a content generation workflow",
          "Trigger a report generation",
          "Initiate a data sync process",
        ],
        bestPractices: [
          "Use as the starting point for workflows that need user initiation",
          "Good for testing and on-demand automation",
        ],
      },
      [NodeType.MANUAL_INPUT]: {
        description: "Collect user input during workflow execution",
        category: "trigger",
        actions: [
          {
            name: "collect",
            description: "Collect input from user during workflow execution",
            useCases: [
              "Gathering user preferences",
              "Collecting form data",
              "Getting approval or confirmation",
            ],
            inputs: {
              prompt: {
                type: "string",
                description: "Prompt/question to show user",
                required: true,
              },
              inputType: {
                type: "string",
                description: "Type of input (text, number, email, etc.)",
                required: false,
              },
            },
            outputs: {
              userInput: { type: "string", description: "User-provided input value" },
            },
            credentials: [],
          },
        ],
        examples: [
          "Ask user for approval before sending email",
          "Collect email address for newsletter signup",
          "Get user preference for content style",
        ],
        bestPractices: [
          "Use clear, concise prompts",
          "Specify input type for validation",
          "Place early in workflow if input is needed for subsequent steps",
        ],
      },
      [NodeType.TIMED_TRIGGER]: {
        description: "Trigger workflow on a schedule (cron, daily, weekly, etc.)",
        category: "trigger",
        actions: [
          {
            name: "schedule",
            description: "Schedule workflow to run automatically",
            useCases: [
              "Daily reports",
              "Weekly data sync",
              "Scheduled content posting",
              "Regular backups",
            ],
            inputs: {
              schedule: {
                type: "string",
                description: "Cron expression or preset (daily, weekly, etc.)",
                required: true,
              },
            },
            outputs: {
              trigger: { type: "object", description: "Scheduled trigger event" },
            },
            credentials: [],
          },
        ],
        examples: [
          "Send daily sales report every morning",
          "Post social media content every 3 hours",
          "Backup data weekly on Sundays",
        ],
        bestPractices: [
          "Use appropriate schedule frequency",
          "Consider timezone for user-facing workflows",
          "Test schedule before deploying",
        ],
      },
      [NodeType.HTTP_REQUEST]: {
        description: "Make HTTP requests to any API endpoint",
        category: "integration",
        actions: [
          {
            name: "request",
            description: "Make HTTP request (GET, POST, PUT, DELETE, etc.)",
            useCases: [
              "Call external APIs",
              "Fetch data from web services",
              "Send data to webhooks",
              "Integrate with custom services",
            ],
            inputs: {
              url: { type: "string", description: "API endpoint URL", required: true },
              method: {
                type: "string",
                description: "HTTP method (GET, POST, PUT, DELETE, PATCH)",
                required: true,
              },
              headers: {
                type: "object",
                description: "HTTP headers (including Authorization)",
                required: false,
              },
              body: {
                type: "string",
                description: "Request body (JSON string)",
                required: false,
              },
            },
            outputs: {
              httpResponse: {
                type: "object",
                description: "Response with data, status, statusText",
              },
            },
            credentials: ["custom"],
          },
        ],
        examples: [
          "Fetch data from REST API",
          "Send webhook notifications",
          "Call third-party service APIs",
        ],
        bestPractices: [
          "Use templating for dynamic URLs and data",
          "Handle errors with proper status codes",
          "Store API keys in custom credentials",
        ],
      },
      [NodeType.GOOGLE_SHEETS]: {
        description: "Read, write, and manage Google Sheets data",
        category: "integration",
        actions: [
          {
            name: "readRange",
            description: "Read data from a specific range in a sheet",
            useCases: ["Read spreadsheet data", "Get cell values", "Extract table data"],
            inputs: {
              spreadsheetId: { type: "string", description: "Google Sheets ID", required: true },
              range: { type: "string", description: "Range (e.g., A1:B10)", required: true },
            },
            outputs: {
              data: { type: "array", description: "Array of row arrays with cell values" },
            },
            credentials: ["google_oauth"],
          },
          {
            name: "writeRange",
            description: "Write data to a specific range in a sheet",
            useCases: ["Update spreadsheet", "Add new rows", "Modify cell values"],
            inputs: {
              spreadsheetId: { type: "string", description: "Google Sheets ID", required: true },
              range: { type: "string", description: "Range to write to", required: true },
              values: {
                type: "string",
                description: "JSON array of arrays (rows and columns)",
                required: true,
              },
            },
            outputs: {
              updatedRange: { type: "string", description: "Range that was updated" },
              updatedCells: { type: "number", description: "Number of cells updated" },
            },
            credentials: ["google_oauth"],
          },
          {
            name: "appendRow",
            description: "Append a new row to a sheet",
            useCases: ["Add new records", "Log entries", "Append data"],
            inputs: {
              spreadsheetId: { type: "string", description: "Google Sheets ID", required: true },
              range: { type: "string", description: "Sheet and starting cell", required: true },
              values: {
                type: "string",
                description: "JSON array representing row data",
                required: true,
              },
            },
            outputs: {
              updatedRange: { type: "string", description: "Range where row was added" },
            },
            credentials: ["google_oauth"],
          },
          {
            name: "createSpreadsheet",
            description: "Create a new Google Spreadsheet",
            useCases: ["Create new sheets", "Initialize data storage"],
            inputs: {
              title: { type: "string", description: "Spreadsheet title", required: true },
            },
            outputs: {
              spreadsheetId: { type: "string", description: "ID of created spreadsheet" },
              title: { type: "string", description: "Spreadsheet title" },
            },
            credentials: ["google_oauth"],
          },
        ],
        examples: [
          "Read customer data from spreadsheet",
          "Log workflow results to a sheet",
          "Create weekly report spreadsheet",
        ],
        bestPractices: [
          "Use templating for dynamic ranges",
          "Format data as JSON array of arrays",
          "Handle large datasets efficiently",
        ],
      },
      [NodeType.GOOGLE_DOCS]: {
        description: "Create, read, and update Google Docs documents",
        category: "integration",
        actions: [
          {
            name: "createDocument",
            description: "Create a new Google Doc",
            useCases: ["Generate documents", "Create reports", "Initialize content"],
            inputs: {
              title: { type: "string", description: "Document title", required: true },
            },
            outputs: {
              documentId: { type: "string", description: "ID of created document" },
              title: { type: "string", description: "Document title" },
              webViewLink: { type: "string", description: "URL to view document" },
            },
            credentials: ["google_oauth"],
          },
          {
            name: "readDocument",
            description: "Read content from a Google Doc",
            useCases: ["Extract document text", "Read existing content"],
            inputs: {
              documentId: { type: "string", description: "Google Docs ID", required: true },
            },
            outputs: {
              content: { type: "string", description: "Extracted text content" },
              documentId: { type: "string", description: "Document ID" },
            },
            credentials: ["google_oauth"],
          },
          {
            name: "insertText",
            description: "Insert text into a Google Doc at a specific position",
            useCases: ["Add content to document", "Insert generated text"],
            inputs: {
              documentId: { type: "string", description: "Google Docs ID", required: true },
              text: { type: "string", description: "Text to insert", required: true },
              index: {
                type: "number",
                description: "Character position to insert at",
                required: false,
              },
            },
            outputs: {
              documentId: { type: "string", description: "Document ID" },
            },
            credentials: ["google_oauth"],
          },
          {
            name: "updateText",
            description: "Update/replace text in a Google Doc",
            useCases: ["Modify existing content", "Replace placeholders"],
            inputs: {
              documentId: { type: "string", description: "Google Docs ID", required: true },
              text: { type: "string", description: "New text content", required: true },
              index: {
                type: "number",
                description: "Start position for update",
                required: true,
              },
            },
            outputs: {
              documentId: { type: "string", description: "Document ID" },
            },
            credentials: ["google_oauth"],
          },
        ],
        examples: [
          "Generate blog post document",
          "Create formatted reports",
          "Update document templates with data",
        ],
        bestPractices: [
          "Use templating for dynamic content",
          "Format text properly before inserting",
          "Handle special characters correctly",
        ],
      },
      [NodeType.GOOGLE_SLIDES]: {
        description: "Create and update Google Slides presentations",
        category: "integration",
        actions: [
          {
            name: "createPresentation",
            description: "Create a new Google Slides presentation",
            useCases: ["Generate presentations", "Create slide decks"],
            inputs: {
              title: { type: "string", description: "Presentation title", required: true },
            },
            outputs: {
              presentationId: { type: "string", description: "ID of created presentation" },
            },
            credentials: ["google_oauth"],
          },
          {
            name: "insertText",
            description: "Insert text into a slide",
            useCases: ["Add text to slides", "Insert content"],
            inputs: {
              presentationId: {
                type: "string",
                description: "Google Slides ID",
                required: true,
              },
              text: { type: "string", description: "Text to insert", required: true },
              slideIndex: {
                type: "number",
                description: "Slide index (0-based)",
                required: false,
              },
            },
            outputs: {
              presentationId: { type: "string", description: "Presentation ID" },
              slideId: { type: "string", description: "Slide ID" },
            },
            credentials: ["google_oauth"],
          },
          {
            name: "replaceText",
            description: "Replace text in presentation",
            useCases: ["Update slide content", "Replace placeholders"],
            inputs: {
              presentationId: {
                type: "string",
                description: "Google Slides ID",
                required: true,
              },
              oldText: { type: "string", description: "Text to replace", required: true },
              newText: { type: "string", description: "Replacement text", required: true },
            },
            outputs: {
              presentationId: { type: "string", description: "Presentation ID" },
              occurrencesChanged: {
                type: "number",
                description: "Number of replacements made",
              },
            },
            credentials: ["google_oauth"],
          },
        ],
        examples: [
          "Generate presentation from data",
          "Create automated slide decks",
          "Update presentation templates",
        ],
        bestPractices: [
          "Use templating for dynamic content",
          "Position text appropriately on slides",
          "Keep text concise for readability",
        ],
      },
      [NodeType.GMAIL]: {
        description: "Send emails and interact with Gmail",
        category: "communication",
        actions: [
          {
            name: "sendEmail",
            description: "Send an email via Gmail",
            useCases: [
              "Send notifications",
              "Email reports",
              "Send automated messages",
              "Distribute content",
            ],
            inputs: {
              to: { type: "string", description: "Recipient email address", required: true },
              subject: { type: "string", description: "Email subject", required: true },
              body: { type: "string", description: "Email body (HTML or text)", required: true },
              cc: { type: "string", description: "CC recipients", required: false },
              bcc: { type: "string", description: "BCC recipients", required: false },
            },
            outputs: {
              messageId: { type: "string", description: "Gmail message ID" },
              threadId: { type: "string", description: "Gmail thread ID" },
            },
            credentials: ["google_oauth"],
          },
        ],
        examples: [
          "Send daily reports via email",
          "Email newsletter to subscribers",
          "Send notification emails",
        ],
        bestPractices: [
          "Use templating for personalized content",
          "Format HTML emails properly",
          "Include clear subject lines",
        ],
      },
      [NodeType.ANTHROPIC]: {
        description: "Generate text using Claude AI models (Anthropic)",
        category: "ai",
        actions: [
          {
            name: "generate",
            description: "Generate text using Claude models",
            useCases: [
              "Content generation",
              "Text summarization",
              "Writing assistance",
              "Analysis and insights",
            ],
            inputs: {
              systemPrompt: {
                type: "string",
                description: "System prompt defining AI role",
                required: false,
              },
              userPrompt: {
                type: "string",
                description: "User prompt/instruction",
                required: true,
              },
              model: {
                type: "string",
                description: "Claude model (claude-sonnet-4-5-20250929, etc.)",
                required: false,
              },
            },
            outputs: {
              text: { type: "string", description: "Generated text content" },
            },
            credentials: [],
          },
        ],
        examples: [
          "Generate blog post content",
          "Create social media captions",
          "Summarize long documents",
        ],
        bestPractices: [
          "Provide clear, specific prompts",
          "Use system prompts to define AI role",
          "Include context from previous nodes",
        ],
      },
      [NodeType.GEMINI]: {
        description: "Generate text using Google Gemini AI models",
        category: "ai",
        actions: [
          {
            name: "generate",
            description: "Generate text using Gemini models",
            useCases: [
              "Content generation",
              "Text analysis",
              "Writing assistance",
              "Creative tasks",
            ],
            inputs: {
              systemPrompt: {
                type: "string",
                description: "System prompt defining AI role",
                required: false,
              },
              userPrompt: {
                type: "string",
                description: "User prompt/instruction",
                required: true,
              },
              model: {
                type: "string",
                description: "Gemini model",
                required: false,
              },
            },
            outputs: {
              text: { type: "string", description: "Generated text content" },
            },
            credentials: [],
          },
        ],
        examples: ["Generate marketing copy", "Create product descriptions", "Write email content"],
        bestPractices: [
          "Use templating to include context",
          "Specify tone and style in prompts",
          "Iterate on prompts for better results",
        ],
      },
      [NodeType.OPENAI]: {
        description: "Generate text using OpenAI GPT models",
        category: "ai",
        actions: [
          {
            name: "generate",
            description: "Generate text using GPT models",
            useCases: ["Content creation", "Text completion", "Writing assistance", "Analysis"],
            inputs: {
              systemPrompt: {
                type: "string",
                description: "System prompt defining AI role",
                required: false,
              },
              userPrompt: {
                type: "string",
                description: "User prompt/instruction",
                required: true,
              },
              model: {
                type: "string",
                description: "GPT model (gpt-4, gpt-3.5-turbo, etc.)",
                required: false,
              },
            },
            outputs: {
              text: { type: "string", description: "Generated text content" },
            },
            credentials: ["openai"],
          },
        ],
        examples: [
          "Generate article content",
          "Create social media posts",
          "Write product descriptions",
        ],
        bestPractices: [
          "Choose appropriate model for task",
          "Use system prompts effectively",
          "Include relevant context",
        ],
      },
      [NodeType.TELEGRAM]: {
        description: "Send messages and interact with Telegram",
        category: "communication",
        actions: [
          {
            name: "sendMessage",
            description: "Send a message to a Telegram chat",
            useCases: [
              "Send notifications",
              "Distribute updates",
              "Automated messaging",
              "Alerts and reminders",
            ],
            inputs: {
              chatId: {
                type: "string",
                description: "Telegram chat ID",
                required: true,
              },
              message: {
                type: "string",
                description: "Message text",
                required: true,
              },
            },
            outputs: {
              messageId: { type: "number", description: "Telegram message ID" },
              chatId: { type: "number", description: "Chat ID" },
            },
            credentials: ["telegram"],
          },
        ],
        examples: [
          "Send daily updates to Telegram channel",
          "Notify team via Telegram",
          "Distribute content automatically",
        ],
        bestPractices: [
          "Use templating for dynamic messages",
          "Format messages clearly",
          "Handle errors gracefully",
        ],
      },
      [NodeType.SLACK]: {
        description: "Send messages and interact with Slack",
        category: "communication",
        actions: [
          {
            name: "sendMessage",
            description: "Send a message to a Slack channel",
            useCases: [
              "Team notifications",
              "Channel updates",
              "Automated alerts",
              "Report distribution",
            ],
            inputs: {
              webhookUrl: {
                type: "string",
                description: "Slack webhook URL",
                required: true,
              },
              message: {
                type: "string",
                description: "Message text",
                required: true,
              },
            },
            outputs: {
              success: { type: "boolean", description: "Whether message was sent" },
            },
            credentials: ["slack"],
          },
        ],
        examples: [
          "Send daily reports to Slack",
          "Notify team of events",
          "Post updates to channels",
        ],
        bestPractices: [
          "Use Slack formatting for rich messages",
          "Include relevant context",
          "Use appropriate channels",
        ],
      },
      [NodeType.DISCORD]: {
        description: "Send messages to Discord channels",
        category: "communication",
        actions: [
          {
            name: "sendMessage",
            description: "Send a message to a Discord channel",
            useCases: ["Community notifications", "Channel updates", "Automated messaging"],
            inputs: {
              webhookUrl: {
                type: "string",
                description: "Discord webhook URL",
                required: true,
              },
              message: {
                type: "string",
                description: "Message text",
                required: true,
              },
            },
            outputs: {
              success: { type: "boolean", description: "Whether message was sent" },
            },
            credentials: ["discord"],
          },
        ],
        examples: [
          "Post updates to Discord server",
          "Send notifications to community",
          "Distribute announcements",
        ],
        bestPractices: [
          "Format messages for Discord",
          "Use embeds for rich content",
          "Respect rate limits",
        ],
      },
      [NodeType.AIRTABLE]: {
        description: "Create, read, update, and delete Airtable records",
        category: "integration",
        actions: [
          {
            name: "getRecords",
            description: "Get records from an Airtable base",
            useCases: ["Read data", "Query records", "Extract information"],
            inputs: {
              baseId: { type: "string", description: "Airtable base ID", required: true },
              tableName: {
                type: "string",
                description: "Table name",
                required: true,
              },
              view: { type: "string", description: "View name", required: false },
            },
            outputs: {
              records: { type: "array", description: "Array of Airtable records" },
            },
            credentials: ["airtable"],
          },
          {
            name: "createRecord",
            description: "Create a new record in Airtable",
            useCases: ["Add new entries", "Log data", "Create records"],
            inputs: {
              baseId: { type: "string", description: "Airtable base ID", required: true },
              tableName: {
                type: "string",
                description: "Table name",
                required: true,
              },
              fields: {
                type: "object",
                description: "Record fields as object",
                required: true,
              },
            },
            outputs: {
              record: { type: "object", description: "Created record" },
            },
            credentials: ["airtable"],
          },
        ],
        examples: [
          "Sync data to Airtable",
          "Create records from workflow results",
          "Read customer data from Airtable",
        ],
        bestPractices: [
          "Use templating for dynamic field values",
          "Handle field types correctly",
          "Batch operations when possible",
        ],
      },
      [NodeType.FIRECRAWL]: {
        description: "Scrape, crawl, and extract data from websites",
        category: "integration",
        actions: [
          {
            name: "scrape",
            description: "Scrape content from a single webpage",
            useCases: [
              "Extract article content",
              "Get product information",
              "Scrape data from pages",
            ],
            inputs: {
              url: { type: "string", description: "URL to scrape", required: true },
              formats: {
                type: "array",
                description: "Output formats (markdown, html, etc.)",
                required: false,
              },
            },
            outputs: {
              data: { type: "object", description: "Scraped content in requested formats" },
            },
            credentials: ["firecrawl"],
          },
          {
            name: "crawl",
            description: "Crawl multiple pages from a website",
            useCases: ["Crawl entire sites", "Extract data from multiple pages", "Site mapping"],
            inputs: {
              url: { type: "string", description: "Starting URL", required: true },
              maxDepth: {
                type: "number",
                description: "Maximum crawl depth",
                required: false,
              },
            },
            outputs: {
              data: { type: "array", description: "Array of scraped pages" },
            },
            credentials: ["firecrawl"],
          },
        ],
        examples: [
          "Scrape competitor pricing",
          "Extract blog content",
          "Crawl documentation sites",
        ],
        bestPractices: [
          "Respect robots.txt",
          "Use appropriate crawl limits",
          "Handle errors gracefully",
        ],
      },
      [NodeType.APIFY]: {
        description: "Run Apify actors for web scraping and automation",
        category: "integration",
        actions: [
          {
            name: "runActor",
            description: "Run an Apify actor with input parameters",
            useCases: [
              "Scrape social media",
              "Extract data from platforms",
              "Run automation scripts",
            ],
            inputs: {
              actorId: { type: "string", description: "Apify actor ID", required: true },
              input: {
                type: "string",
                description: "JSON string of actor input parameters",
                required: false,
              },
            },
            outputs: {
              runId: { type: "string", description: "Apify run ID" },
              status: { type: "string", description: "Run status" },
            },
            credentials: ["apify"],
          },
          {
            name: "getActorDetail",
            description: "Get details about an Apify actor",
            useCases: ["Discover actors", "Get actor information"],
            inputs: {
              actorId: { type: "string", description: "Apify actor ID", required: true },
            },
            outputs: {
              actor: { type: "object", description: "Actor details and schema" },
            },
            credentials: ["apify"],
          },
        ],
        examples: ["Scrape TikTok videos", "Extract LinkedIn data", "Run custom automation actors"],
        bestPractices: [
          "Check actor input schema first",
          "Provide correct input parameters",
          "Monitor run status",
        ],
      },
      [NodeType.CODE_BLOCK]: {
        description: "Execute custom TypeScript, JavaScript, or Python code",
        category: "action",
        actions: [
          {
            name: "execute",
            description: "Execute custom code in isolated sandbox",
            useCases: [
              "Custom data transformations",
              "Complex business logic",
              "Custom API integrations",
              "Data processing",
            ],
            inputs: {
              code: { type: "string", description: "Code to execute", required: true },
              language: {
                type: "string",
                description: "Language (typescript, javascript, python)",
                required: false,
              },
              dependencies: {
                type: "array",
                description: "npm/pip packages to install",
                required: false,
              },
            },
            outputs: {
              result: {
                type: "object",
                description: "Return value from execute function",
              },
            },
            credentials: ["custom"],
          },
        ],
        examples: [
          "Format data from previous nodes",
          "Call custom APIs",
          "Perform complex calculations",
        ],
        bestPractices: [
          "Use inputs. prefix to access previous node data",
          "Handle errors properly",
          "Return structured data",
        ],
      },
      [NodeType.DECIDER]: {
        description: "Conditional logic and branching in workflows",
        category: "logic",
        actions: [
          {
            name: "decide",
            description: "Evaluate condition and route to different paths",
            useCases: ["Conditional workflows", "Branching logic", "Decision points"],
            inputs: {
              condition: {
                type: "string",
                description: "Condition expression (e.g., {{value}} > 10)",
                required: true,
              },
            },
            outputs: {
              result: { type: "boolean", description: "Condition evaluation result" },
            },
            credentials: [],
          },
        ],
        examples: [
          "Route based on data values",
          "Conditional notifications",
          "Branch workflows by conditions",
        ],
        bestPractices: [
          "Use clear condition expressions",
          "Test conditions thoroughly",
          "Handle edge cases",
        ],
      },
      [NodeType.GOOGLE_DRIVE]: {
        description: "Upload, download, and manage files in Google Drive",
        category: "integration",
        actions: [
          {
            name: "upload",
            description: "Upload a file to Google Drive",
            useCases: ["Store files", "Backup documents", "Save generated content"],
            inputs: {
              fileName: { type: "string", description: "File name", required: true },
              fileContent: {
                type: "string",
                description: "File content (base64 or text)",
                required: true,
              },
              mimeType: { type: "string", description: "File MIME type", required: false },
              parentFolderId: {
                type: "string",
                description: "Parent folder ID",
                required: false,
              },
            },
            outputs: {
              fileId: { type: "string", description: "Uploaded file ID" },
              webViewLink: { type: "string", description: "URL to view file" },
            },
            credentials: ["google_oauth"],
          },
          {
            name: "download",
            description: "Download a file from Google Drive",
            useCases: ["Retrieve files", "Get document content"],
            inputs: {
              fileId: { type: "string", description: "Google Drive file ID", required: true },
            },
            outputs: {
              fileContent: { type: "string", description: "File content" },
              fileName: { type: "string", description: "File name" },
            },
            credentials: ["google_oauth"],
          },
        ],
        examples: [
          "Upload generated reports to Drive",
          "Download templates for processing",
          "Backup workflow outputs",
        ],
        bestPractices: [
          "Use appropriate MIME types",
          "Organize files in folders",
          "Handle large files efficiently",
        ],
      },
      [NodeType.GOOGLE_CALENDAR]: {
        description: "Create, update, and manage Google Calendar events",
        category: "integration",
        actions: [
          {
            name: "createEvent",
            description: "Create a new calendar event",
            useCases: ["Schedule meetings", "Create appointments", "Set reminders"],
            inputs: {
              calendarId: {
                type: "string",
                description: "Calendar ID",
                required: false,
              },
              summary: { type: "string", description: "Event title", required: true },
              description: { type: "string", description: "Event description", required: false },
              startDateTime: {
                type: "string",
                description: "Start date/time (ISO format)",
                required: true,
              },
              endDateTime: {
                type: "string",
                description: "End date/time (ISO format)",
                required: true,
              },
              attendees: {
                type: "string",
                description: "JSON array of email addresses",
                required: false,
              },
            },
            outputs: {
              eventId: { type: "string", description: "Created event ID" },
              htmlLink: { type: "string", description: "Event URL" },
            },
            credentials: ["google_oauth"],
          },
          {
            name: "listEvents",
            description: "List events from a calendar",
            useCases: ["Check availability", "List upcoming events"],
            inputs: {
              calendarId: {
                type: "string",
                description: "Calendar ID",
                required: false,
              },
              timeMin: {
                type: "string",
                description: "Start time for query",
                required: false,
              },
              timeMax: {
                type: "string",
                description: "End time for query",
                required: false,
              },
            },
            outputs: {
              events: { type: "array", description: "Array of calendar events" },
            },
            credentials: ["google_oauth"],
          },
        ],
        examples: [
          "Schedule meetings from workflow",
          "Create calendar reminders",
          "Check calendar availability",
        ],
        bestPractices: [
          "Use proper date/time formats",
          "Include timezone information",
          "Handle recurring events appropriately",
        ],
      },
      [NodeType.ELEVENLABS]: {
        description: "Generate speech from text and convert speech to text",
        category: "ai",
        actions: [
          {
            name: "textToSpeech",
            description: "Convert text to speech audio",
            useCases: ["Generate voiceovers", "Create audio content", "Text-to-speech conversion"],
            inputs: {
              text: { type: "string", description: "Text to convert", required: true },
              voiceId: {
                type: "string",
                description: "ElevenLabs voice ID",
                required: true,
              },
              model: {
                type: "string",
                description: "Model (eleven_multilingual_v2, etc.)",
                required: false,
              },
            },
            outputs: {
              audioUrl: { type: "string", description: "URL to generated audio" },
            },
            credentials: ["elevenlabs"],
          },
          {
            name: "speechToText",
            description: "Convert speech/audio to text",
            useCases: [
              "Transcribe audio",
              "Extract text from recordings",
              "Voice note transcription",
            ],
            inputs: {
              audioUrl: {
                type: "string",
                description: "URL to audio file",
                required: true,
              },
            },
            outputs: {
              text: { type: "string", description: "Transcribed text" },
            },
            credentials: ["elevenlabs"],
          },
        ],
        examples: [
          "Generate voiceover for content",
          "Transcribe meeting recordings",
          "Create audio versions of text",
        ],
        bestPractices: [
          "Choose appropriate voice for content",
          "Handle audio file formats correctly",
          "Consider audio quality for transcription",
        ],
      },
      [NodeType.WHATSAPP]: {
        description: "Send messages via WhatsApp",
        category: "communication",
        actions: [
          {
            name: "sendMessage",
            description: "Send a WhatsApp message",
            useCases: ["Send notifications", "Distribute updates", "Automated messaging"],
            inputs: {
              phoneNumber: {
                type: "string",
                description: "Recipient phone number",
                required: true,
              },
              message: {
                type: "string",
                description: "Message text",
                required: true,
              },
            },
            outputs: {
              messageId: { type: "string", description: "WhatsApp message ID" },
            },
            credentials: ["whatsapp"],
          },
        ],
        examples: [
          "Send daily updates via WhatsApp",
          "Notify customers via WhatsApp",
          "Distribute alerts",
        ],
        bestPractices: [
          "Use proper phone number format",
          "Keep messages concise",
          "Respect messaging limits",
        ],
      },
    },
    patterns: [
      {
        name: "Content Creation Workflow",
        description: "Generate content using AI and distribute it across multiple channels",
        category: "content",
        taskType: "non-technical",
        nodes: [
          { type: NodeType.MANUAL_TRIGGER, purpose: "Start workflow" },
          { type: NodeType.ANTHROPIC, purpose: "Generate content" },
          { type: NodeType.GOOGLE_DOCS, purpose: "Save to document" },
          { type: NodeType.GMAIL, purpose: "Email content" },
          { type: NodeType.TELEGRAM, purpose: "Post to Telegram" },
        ],
        flow: "Trigger → Generate content → Save to doc → Email → Post to Telegram",
        useCase: "Automate content creation and distribution",
        example:
          "Generate daily blog post, save to Google Doc, email to subscribers, post to Telegram channel",
      },
      {
        name: "Data Sync and Integration",
        description: "Sync data between different services and platforms",
        category: "automation",
        taskType: "non-technical",
        nodes: [
          { type: NodeType.TIMED_TRIGGER, purpose: "Schedule sync" },
          { type: NodeType.AIRTABLE, purpose: "Read source data" },
          { type: NodeType.CODE_BLOCK, purpose: "Transform data format" },
          { type: NodeType.GOOGLE_SHEETS, purpose: "Write to destination" },
        ],
        flow: "Schedule → Read → Transform → Write",
        useCase: "Automate data synchronization between platforms",
        example: "Daily: read customer data from Airtable, transform format, sync to Google Sheets",
      },
      {
        name: "Content Research and Curation",
        description: "Research topics and curate content automatically",
        category: "content",
        taskType: "non-technical",
        nodes: [
          { type: NodeType.MANUAL_TRIGGER, purpose: "Start research" },
          { type: NodeType.FIRECRAWL, purpose: "Scrape research sources" },
          { type: NodeType.ANTHROPIC, purpose: "Analyze and summarize" },
          { type: NodeType.GOOGLE_DOCS, purpose: "Save research document" },
        ],
        flow: "Trigger → Scrape → Analyze → Save",
        useCase: "Automate content research and curation",
        example: "Research topic, scrape relevant articles, summarize findings, save to document",
      },
      {
        name: "Data Collection and Reporting",
        description: "Collect data from multiple sources and generate reports",
        category: "data",
        taskType: "non-technical",
        nodes: [
          { type: NodeType.TIMED_TRIGGER, purpose: "Schedule daily run" },
          { type: NodeType.HTTP_REQUEST, purpose: "Fetch API data" },
          { type: NodeType.AIRTABLE, purpose: "Read existing records" },
          { type: NodeType.CODE_BLOCK, purpose: "Process and format data" },
          { type: NodeType.GOOGLE_SHEETS, purpose: "Write to spreadsheet" },
          { type: NodeType.GMAIL, purpose: "Email report" },
        ],
        flow: "Schedule → Fetch data → Read records → Process → Write to sheet → Email report",
        useCase: "Automate daily data collection and reporting",
        example:
          "Daily: fetch sales data, combine with Airtable records, format, save to Google Sheets, email summary",
      },
      {
        name: "Notification and Alert System",
        description: "Monitor conditions and send notifications when triggered",
        category: "communication",
        taskType: "non-technical",
        nodes: [
          { type: NodeType.TIMED_TRIGGER, purpose: "Check periodically" },
          { type: NodeType.HTTP_REQUEST, purpose: "Check status/API" },
          { type: NodeType.DECIDER, purpose: "Evaluate condition" },
          { type: NodeType.SLACK, purpose: "Send Slack alert" },
          { type: NodeType.TELEGRAM, purpose: "Send Telegram alert" },
        ],
        flow: "Schedule → Check → Decide → Notify (if condition met)",
        useCase: "Automated monitoring and alerting",
        example: "Every hour: check API status, if down, send alerts to Slack and Telegram",
      },
      {
        name: "Social Media Content Automation",
        description: "Generate and post content to social media platforms",
        category: "content",
        taskType: "non-technical",
        nodes: [
          { type: NodeType.TIMED_TRIGGER, purpose: "Schedule posts" },
          { type: NodeType.GEMINI, purpose: "Generate social media content" },
          { type: NodeType.CODE_BLOCK, purpose: "Format for platform" },
          { type: NodeType.TELEGRAM, purpose: "Post to Telegram" },
        ],
        flow: "Schedule → Generate → Format → Post",
        useCase: "Automate social media posting",
        example: "Every 3 hours: generate engaging post, format it, post to Telegram channel",
      },
      {
        name: "Document Generation and Distribution",
        description: "Generate documents and distribute them automatically",
        category: "content",
        taskType: "non-technical",
        nodes: [
          { type: NodeType.MANUAL_TRIGGER, purpose: "Start generation" },
          { type: NodeType.ANTHROPIC, purpose: "Generate document content" },
          { type: NodeType.GOOGLE_DOCS, purpose: "Create document" },
          { type: NodeType.GOOGLE_DOCS, purpose: "Insert formatted content" },
          { type: NodeType.GMAIL, purpose: "Email document link" },
        ],
        flow: "Trigger → Generate → Create doc → Insert content → Email",
        useCase: "Automate document creation and sharing",
        example: "Generate report document, format it, create Google Doc, email link to team",
      },
    ],
    taskBreakdown: {
      strategies: [
        {
          taskCategory: "Content Creation",
          approach:
            "Break down into: idea generation → content writing → formatting → distribution",
          steps: [
            "Identify content type and requirements",
            "Generate content using AI node",
            "Format content appropriately",
            "Save to storage (Docs/Sheets)",
            "Distribute via communication channels",
          ],
          nodeRecommendations: [
            NodeType.ANTHROPIC,
            NodeType.GEMINI,
            NodeType.GOOGLE_DOCS,
            NodeType.GMAIL,
            NodeType.TELEGRAM,
          ],
        },
        {
          taskCategory: "Data Collection",
          approach: "Identify data sources → fetch data → process → store → report",
          steps: [
            "List all data sources (APIs, databases, files)",
            "Fetch data from each source",
            "Transform and combine data",
            "Store in appropriate format (Sheets, Airtable)",
            "Generate and distribute reports",
          ],
          nodeRecommendations: [
            NodeType.HTTP_REQUEST,
            NodeType.AIRTABLE,
            NodeType.CODE_BLOCK,
            NodeType.GOOGLE_SHEETS,
          ],
        },
        {
          taskCategory: "Notification and Alerts",
          approach: "Monitor → evaluate → notify",
          steps: [
            "Set up trigger (scheduled or event-based)",
            "Check condition or status",
            "Evaluate if notification needed",
            "Send to appropriate channels",
          ],
          nodeRecommendations: [
            NodeType.TIMED_TRIGGER,
            NodeType.HTTP_REQUEST,
            NodeType.DECIDER,
            NodeType.SLACK,
            NodeType.TELEGRAM,
            NodeType.GMAIL,
          ],
        },
        {
          taskCategory: "Automation and Integration",
          approach: "Connect services → sync data → automate actions",
          steps: [
            "Identify services to connect",
            "Set up data flow between services",
            "Transform data as needed",
            "Automate actions based on triggers",
          ],
          nodeRecommendations: [
            NodeType.HTTP_REQUEST,
            NodeType.CODE_BLOCK,
            NodeType.AIRTABLE,
            NodeType.GOOGLE_SHEETS,
          ],
        },
      ],
    },
    bestPractices: {
      general: [
        "Keep workflows focused on a single task or related tasks",
        "Use clear, descriptive variable names for node outputs",
        "Test workflows with sample data before production use",
        "Handle errors gracefully with proper error handling",
        "Document complex workflows with comments or descriptions",
        "Use appropriate triggers for the use case",
        "Minimize the number of nodes when possible",
        "Ensure data flows logically from one node to the next",
      ],
      nodeSelection: [
        "Choose the most specific node type for the task",
        "Use existing nodes when functionality matches",
        "Use CODE_BLOCK for custom logic or unsupported integrations",
        "Prefer specialized nodes (e.g., GMAIL) over generic ones (HTTP_REQUEST) when available",
        "Consider node limitations and capabilities",
      ],
      dataFlow: [
        "Use templating ({{variableName}}) to pass data between nodes",
        "Access HTTP node data via: {{nodeName.httpResponse.data}}",
        "Access AI node data via: {{nodeName.text}}",
        "Use optional chaining in templates for safety",
        "Validate data structure before using in subsequent nodes",
        "Use descriptive variable names that indicate data source",
      ],
      errorHandling: [
        "Test workflows with various input scenarios",
        "Handle missing or null data gracefully",
        "Use DECIDER nodes for conditional error handling",
        "Provide meaningful error messages",
        "Consider fallback actions when operations fail",
      ],
      userExperience: [
        "Make workflows intuitive and easy to understand",
        "Use clear node labels that describe their purpose",
        "Provide helpful descriptions in node configurations",
        "Ensure workflows complete in reasonable time",
        "Give users control over when workflows run (use MANUAL_TRIGGER when appropriate)",
        "Provide feedback on workflow execution status",
      ],
    },
  };
};
