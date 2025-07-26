import {
  McpServer,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'fs/promises';
import { CreateMessageResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { Db } from './db/db';
import 'dotenv/config';
import { Users } from './db/schemas/users';
import { date } from "zod/v4";

/**
 * Interface for campaign log entries
 */
interface CampaignLogEntry {
  id: number;
  title: string;
  content: string;
  date: string; // ISO 8601 format
  createdAt: string; // ISO 8601 format
}

/**
 * Interface for user objects
 */
interface User {
  id: number;
  name: string;
  email: string;
  address: string;
  phonenumber: string;
}

Db.init(); // Initialize the database connection
Users.insertOne({
  name: "User2",
});

const server = new McpServer({
  name: "role-playing-campaign-assistant",
  description:
    "A role-playing campaign assistant that helps track campaigns, characters, and events. Creates ambient music and sound effects. Generates images for encounters.",
  version: "0.1.0",
  capabilities: {
    resources: {},
    tools: {},
    promts: {},
  },
});

server.tool(
  "ttrpgmcp_create_campaign_log",
  "Create a new campaign log entry",
  {
    title: z.string(),
    content: z.string(),
    date: z.string().optional(),
  },
  {
    title: "Create Campaign Log",
    description: "Creates a new campaign log entry with the provided details.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  async (params) => {
    try {
      // Validate date if provided
      let logDate = new Date();
      if (params.date) {
        const parsedDate = new Date(params.date);
        if (isNaN(parsedDate.getTime())) {
          return {
            content: [
              {
                type: "text",
                text: "Invalid date format. Please use ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)",
              },
            ],
          };
        }
        logDate = parsedDate;
      }

      // Read existing logs
      const logs = await fs
        .readFile("./src/data/campaign_logs.json", "utf8")
        .then((data) => JSON.parse(data))
        .catch(() => []); // If file doesn't exist, start with an empty array

      // Generate unique ID
      const id =
        logs.length > 0
          ? Math.max(...logs.map((log: any) => log.id || 0)) + 1
          : 1;

      const logEntry = {
        id,
        title: params.title,
        content: params.content,
        date: logDate.toISOString(),
        createdAt: new Date().toISOString(),
      };

      // Add new log entry
      logs.push(logEntry);

      // Write updated logs back to file
      await fs.writeFile(
        "./src/data/campaign_logs.json",
        JSON.stringify(logs, null, 2),
        "utf8"
      );

      return {
        content: [
          {
            type: "text",
            text: `Campaign log entry created successfully with ID: ${id} and title: "${params.title}"`,
          },
        ],
      };
    } catch (error) {
      console.error("Error creating campaign log entry:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          {
            type: "text",
            text: `Failed to create campaign log entry: ${errorMessage}`,
          },
        ],
      };
    }
  }
);

server.tool(
  "ttrpgmcp_get_last_campaign_log",
  "Get the last campaign log entry",
  {},
  {
    title: "Get Last Campaign Log",
    description: "Retrieves the most recent campaign log entry.",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  async () => {
    try {
      const data = await fs.readFile("./src/data/campaign_logs.json", "utf8");
      const logs = JSON.parse(data) as CampaignLogEntry[];
      if (logs.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No campaign logs found.",
            },
          ],
        };
      }
      const lastLog = logs[logs.length - 1];
      return {
        content: [
          {
            type: "text",
            text: `Last campaign log entry:\n\nTitle: ${lastLog.title}\nContent: ${lastLog.content}\nDate: ${lastLog.date}\nCreated At: ${lastLog.createdAt}`,
          },
        ],
      };
    } catch (error) {
      console.error("Error reading campaign logs:", error);
      return {
        content: [
          {
            type: "text",
            text: "Failed to read campaign logs. Please ensure the file exists.",
          },
        ],
      };
    }
  }
);

server.tool(
  "ttrpgmcp_get_n_campaign_logs",
  "Get the last N campaign log entries",
  {
    count: z.number().min(1).max(100).default(5),
  },
  {
    title: "Get Last N Campaign Logs",
    description: "Retrieves the last N campaign log entries.",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  async (params) => {
    try {
      const data = await fs.readFile("./src/data/campaign_logs.json", "utf8");
      const logs = JSON.parse(data) as CampaignLogEntry[];
      if (logs.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No campaign logs found.",
            },
          ],
        };
      }
      // Get the last N entries
      const recentLogs = logs.slice(-params.count);
      return {
        content: [
          {
            type: "text",
            text: `Last ${params.count} campaign log entries:\n\n${recentLogs
              .map(
                (log) =>
                  `Title: ${log.title}\nContent: ${log.content}\nDate: ${log.date}\nCreated At: ${log.createdAt}\n`
              )
              .join("\n")}`,
          },
        ],
      };
    } catch (error) {
      console.error("Error reading campaign logs:", error);
      return {
        content: [
          {
            type: "text",
            text: "Failed to read campaign logs. Please ensure the file exists.",
          },
        ],
      };
    }
  }
);

server.resource(
  "campaign-logs",
  "campaign-logs://all",
  {
    description: "Get all campaign logs",
    title: "Get All Campaign Logs",
    mimeType: "application/json",
  },
  async (uri) => {
    try {
      const data = await fs.readFile("./src/data/campaign_logs.json", "utf8");
      const logs = JSON.parse(data) as CampaignLogEntry[];
      return {
        contents: [
          {
            uri: uri.href,
            type: "text",
            text: JSON.stringify(logs, null, 2),
            mimeType: "application/json",
          },
        ],
      };
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        // If file doesn't exist, return an empty array
        return {
          contents: [
            {
              uri: uri.href,
              type: "text",
              text: JSON.stringify([]),
              mimeType: "application/json",
            },
          ],
        };
      }
      console.error("Error reading campaign logs:", error);
      return {
        contents: [
          {
            uri: uri.href,
            type: "text",
            text: JSON.stringify({ error: "Failed to read campaign logs" }),
            mimeType: "application/json",
          },
        ],
      };
    }
  }
);

server.tool(
  "ttrpgmcp_generate_image_from_last_log",
  "Generate an image based on the last campaign log entry",
  {},
  {
    title: "Generate Image from Last Log",
    description:
      "Creates an image prompt based on the most recent campaign log entry for TTRPG encounters.",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  async () => {
    try {
      const data = await fs.readFile("./src/data/campaign_logs.json", "utf8");
      const logs = JSON.parse(data) as CampaignLogEntry[];

      if (logs.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No campaign logs found to generate an image from.",
            },
          ],
        };
      }

      const lastLog = logs[logs.length - 1];

      // Create a detailed image prompt based on the log entry
      const imagePrompt = `Create a fantasy tabletop role-playing game scene based on this campaign log:
      
Title: "${lastLog.title}"
Content: "${lastLog.content}"

Generate a detailed, atmospheric image that captures the essence of this moment in the campaign. The scene should be suitable for a fantasy TTRPG setting with rich details, dramatic lighting, and an immersive environment that reflects the mood and events described in the log entry.`;

      return {
        content: [
          {
            type: "text",
            text: `Image generation prompt created for the last campaign log entry:

Campaign Log: "${lastLog.title}" - "${lastLog.content}"

Image Prompt:
${imagePrompt}
`,
          },
        ],
      };
    } catch (error) {
      console.error("Error generating image prompt from campaign log:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          {
            type: "text",
            text: `Failed to generate image prompt: ${errorMessage}`,
          },
        ],
      };
    }
  }
);

server.tool(
  "ttrpgmcp_generate_image_from_summary",
  "Generate an image based on a summary of recent campaign log entries",
  {
    count: z.number().min(1).max(10).default(2),
  },
  {
    title: "Generate Image from Campaign Summary",
    description:
      "Creates an image prompt based on the most recent campaign log entries for TTRPG encounters.",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  async (params) => {
    try {
      const data = await fs.readFile("./src/data/campaign_logs.json", "utf8");
      const logs = JSON.parse(data) as CampaignLogEntry[];

      if (logs.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No campaign logs found to generate an image from.",
            },
          ],
        };
      }

      // Get the last N entries based on the count parameter
      const recentLogs = logs.slice(-params.count);

      // Create a narrative summary of the recent events
      const narrativeSummary = recentLogs
        .map((log, index) => `${index + 1}. "${log.title}": ${log.content}`)
        .join("\n");

      // Create a detailed image prompt based on the summary
      const imagePrompt = `Create a fantasy tabletop role-playing game scene that captures the essence of these recent campaign events:

${narrativeSummary}

Generate a detailed, atmospheric image that tells the story of these connected moments in the campaign. The scene should be suitable for a fantasy TTRPG setting with rich details, dramatic lighting, and an immersive environment that reflects the progression and mood of the recent events. Show the aftermath or culmination of these events in a single compelling scene.`;

      return {
        content: [
          {
            type: "text",
            text: `Image generation prompt created for the last ${params.count} campaign log entries:

Recent Campaign Events:
${narrativeSummary}

Image Prompt:
${imagePrompt}
`,
          },
        ],
      };
    } catch (error) {
      console.error(
        "Error generating image prompt from campaign summary:",
        error
      );
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          {
            type: "text",
            text: `Failed to generate image prompt: ${errorMessage}`,
          },
        ],
      };
    }
  }
);

server.prompt(
  "generate_image_encounter",
  "Generate an image for an encounter based on a description",
  {
    description: z.string(),
  },
  ({ description }) => {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Generate a detailed fantasy tabletop role-playing game scene based on this description: ${description}. Create an atmospheric image with rich details, dramatic lighting, and an immersive environment suitable for a TTRPG encounter background.`,
          },
        },
      ],
    };
  }
);

server.prompt(
  "generate_log_summary_for_last_3_logs",
  "Generate a summary of the last 3 campaign logs",
  {},
  async () => {
    try {
      const data = await fs.readFile("./src/data/campaign_logs.json", "utf8");
      const logs = JSON.parse(data) as CampaignLogEntry[];
      if (logs.length === 0) {
        return {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: "No campaign logs found to summarize.",
              },
            },
          ],
        };
      }
      // Get the last 3 logs
      const recentLogs = logs.slice(-3);
      const summary = recentLogs
        .map(
          (log) =>
            `Title: ${log.title}\nContent: ${log.content}\nDate: ${log.date}\nCreated At: ${log.createdAt}`
        )
        .join("\n\n");
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Generate a summary of the last 3 campaign logs:\n\n${summary}\n\nProvide a concise overview of the key events and themes in these logs.
              Write a cohesive, third-person narrative summary of the last three TTRPG campaign sessions. Blend the events from each log into a single flowing story, maintaining a fantasy-adventure tone. Highlight character actions, important dialogue or moments (even if invented to enrich the summary), and build tension where appropriate. Focus on immersive storytelling rather than exposition or analysis. The summary should be engaging and suitable for sharing with players to recap the recent campaign events. Aim for a length of around 200-300 words.
              `,
            },
          },
        ],
      };
    } catch (error) {
      console.error("Error generating log summary:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Failed to generate log summary: ${errorMessage}`,
            },
          },
        ],
      };
    }
  }
);  

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log('Server is running and waiting for requests...');
}

main();
