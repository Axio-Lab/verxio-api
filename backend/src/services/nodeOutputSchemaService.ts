import { NodeType } from "@/lib/node-types";

/**
 * Expected output structure for each node type
 * Used to help Claude understand what data is available from previous nodes
 */
export interface NodeOutputSchema {
  nodeType: string;
  outputStructure: {
    [variableName: string]: {
      type: string;
      description: string;
      example?: unknown;
    };
  };
  exampleOutput?: Record<string, unknown>;
}

/**
 * Registry of known node output schemas
 */
const outputSchemas: Map<string, NodeOutputSchema> = new Map();

// OpenAI node output
outputSchemas.set(NodeType.OPENAI, {
  nodeType: NodeType.OPENAI,
  outputStructure: {
    [NodeType.OPENAI.toLowerCase()]: {
      type: "object",
      description: "OpenAI response containing generated text",
      example: { text: "Generated text response" },
    },
  },
  exampleOutput: {
    openai: {
      text: "This is the generated text from OpenAI",
    },
  },
});

// Anthropic node output
outputSchemas.set(NodeType.ANTHROPIC, {
  nodeType: NodeType.ANTHROPIC,
  outputStructure: {
    anthropic: {
      type: "object",
      description: "Anthropic response containing generated text",
      example: { text: "Generated text response" },
    },
  },
  exampleOutput: {
    anthropic: {
      text: "This is the generated text from Claude",
    },
  },
});

// Gemini node output
outputSchemas.set(NodeType.GEMINI, {
  nodeType: NodeType.GEMINI,
  outputStructure: {
    gemini: {
      type: "object",
      description: "Gemini response containing generated text",
      example: { text: "Generated text response" },
    },
  },
  exampleOutput: {
    gemini: {
      text: "This is the generated text from Gemini",
    },
  },
});

// HTTP Request node output
outputSchemas.set(NodeType.HTTP_REQUEST, {
  nodeType: NodeType.HTTP_REQUEST,
  outputStructure: {
    httpRequest: {
      type: "object",
      description: "HTTP response with status, headers, and body",
      example: {
        status: 200,
        headers: {},
        body: {},
      },
    },
  },
  exampleOutput: {
    httpRequest: {
      status: 200,
      headers: { "content-type": "application/json" },
      body: { data: "response data" },
    },
  },
});

// Gmail node output
outputSchemas.set(NodeType.GMAIL, {
  nodeType: NodeType.GMAIL,
  outputStructure: {
    gmail: {
      type: "object",
      description: "Gmail operation result (email sent, email retrieved, etc.)",
      example: {
        messageId: "message-id",
        threadId: "thread-id",
      },
    },
  },
  exampleOutput: {
    gmail: {
      messageId: "18c1234567890abcdef",
      threadId: "18c1234567890abcdef",
    },
  },
});

// Airtable node output
outputSchemas.set(NodeType.AIRTABLE, {
  nodeType: NodeType.AIRTABLE,
  outputStructure: {
    airtable: {
      type: "object",
      description: "Airtable operation result (records, bases, etc.)",
      example: {
        records: [],
        bases: [],
      },
    },
  },
  exampleOutput: {
    airtable: {
      records: [
        {
          id: "rec123",
          fields: { Name: "Example", Status: "Active" },
        },
      ],
    },
  },
});

// Firecrawl node output
outputSchemas.set(NodeType.FIRECRAWL, {
  nodeType: NodeType.FIRECRAWL,
  outputStructure: {
    firecrawl: {
      type: "object",
      description: "Firecrawl operation result (scraped content, search results, etc.)",
      example: {
        data: [],
        content: "",
      },
    },
  },
  exampleOutput: {
    firecrawl: {
      data: [{ url: "https://example.com", content: "Scraped content" }],
    },
  },
});

// Apify node output
outputSchemas.set(NodeType.APIFY, {
  nodeType: NodeType.APIFY,
  outputStructure: {
    apify: {
      type: "object",
      description: "Apify operation result (actors, runs, datasets, etc.)",
      example: {
        actors: [],
        run: {},
        dataset: {},
      },
    },
  },
  exampleOutput: {
    apify: {
      actors: [{ id: "actor-id", name: "Actor Name" }],
    },
  },
});

// CODE_BLOCK node output (variable, depends on code)
outputSchemas.set(NodeType.CODE_BLOCK, {
  nodeType: NodeType.CODE_BLOCK,
  outputStructure: {
    result: {
      type: "object",
      description: "Custom code execution result (structure depends on code)",
      example: {},
    },
  },
  exampleOutput: {
    result: {},
  },
});

/**
 * Get output schema for a node type
 */
export function getOutputSchema(nodeType: string): NodeOutputSchema | undefined {
  return outputSchemas.get(nodeType);
}

/**
 * Get all output schemas
 */
export function getAllOutputSchemas(): NodeOutputSchema[] {
  return Array.from(outputSchemas.values());
}

/**
 * Register or update an output schema
 */
export function registerOutputSchema(schema: NodeOutputSchema): void {
  outputSchemas.set(schema.nodeType, schema);
}
