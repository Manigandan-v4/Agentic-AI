import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

import { developerAgent } from "./agents/developerAgent.js";
import { releaseAgent } from "./agents/releaseAgent.js";

const server = new Server(
  {
    name: "salesforce-mcp",
    version: "3.0.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

server.setRequestHandler(
  ListToolsRequestSchema,
  async () => ({
    tools: [
      {
        name: "developerAgent",
        description:
          "Create Salesforce components and automatically perform branch, commit, push and PR workflow",
        inputSchema: {
          type: "object",
          properties: {
            objectName: {
              type: "string"
            },
            fieldName: {
              type: "string"
            },
            fieldType: {
              type: "string"
            }
          },
          required: [
            "objectName",
            "fieldName",
            "fieldType"
          ]
        }
      },
      {
        name: "releaseAgent",
        description:
          "Promote latest changes to dev, test or prod environments",
        inputSchema: {
          type: "object",
          properties: {
            environment: {
              type: "string",
              enum: [
                "dev",
                "test",
                "prod"
              ]
            }
          },
          required: [
            "environment"
          ]
        }
      }
    ]
  })
);

server.setRequestHandler(
  CallToolRequestSchema,
  async (request) => {
    const toolName = request.params.name;
    const args =
      request.params.arguments || {};

    if (toolName === "developerAgent") {
      return await developerAgent(
        args.objectName,
        args.fieldName,
        args.fieldType
      );
    }

    if (toolName === "releaseAgent") {
      return await releaseAgent(
        args.environment
      );
    }

    throw new Error(
      `Unknown tool: ${toolName}`
    );
  }
);

const transport =
  new StdioServerTransport();

await server.connect(transport);

console.error(
  "Salesforce MCP Server Started"
);