import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs/promises";
import { CreateMessageResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { Db } from "./db/db";
import "dotenv/config";
import { Users } from "./db/schemas/users";
import { Backgrounds } from "./db/schemas/backgrounds";
import { date } from "zod/v4";
import { Spotify } from "./spotify/spotify";
import { GPTClient } from "./gpt";

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

/**
 * Interface for D&D 5e API monster data
 */
interface MonsterData {
  index: string;
  name: string;
  size: string;
  type: string;
  alignment: string;
  armor_class: Array<{ type: string; value: number }>;
  hit_points: number;
  challenge_rating: number;
  image?: string;
  special_abilities?: Array<{ name: string; desc: string }>;
  actions?: Array<{ name: string; desc: string }>;
}

Db.init(); // Initialize the database connection
Users.insertOne({
  name: "User2",
});

// create a function that saves backgrounds to the database
async function saveBackgroundToDb(imgUrl: string, name?: string) {
  if (!imgUrl || typeof imgUrl !== "string") {
    Backgrounds.insertOne({
      imgUrl,
      name,
    })
      .then((result) => {
        return result._id.toString();
      })
      .catch((error) => {
        console.error("Error saving background image:", error);
        throw new Error("Failed to save background image");
      });
  }
}

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
  "ttrpgmcp_search_in_spotify",
  "Search for a track in Spotify",
  {
    q: z.string().min(1, "Search query is required"),
    type: z
      .array(
        z.enum([
          "album",
          "artist",
          "playlist",
          "track",
          "show",
          "episode",
          "audiobook",
        ])
      )
      .optional()
      .default(["track"]),
    market: z.string().length(2).optional().or(z.literal("from_token")),
    limit: z.number().int().min(1).max(50).optional().default(20),
    offset: z.number().int().min(0).optional().default(0),
    include_external: z.literal("audio").optional(),
  },
  {
    title: "Search in Spotify",
    description:
      'Search for a track in Spotify, by title or description. This could be used to search for ambiance music: "dark tense music"',
    readOnlyHint: true,
    openWorldHint: true,
  },
  async (params) => ({
    content: [
      {
        type: "text",
        mimeType: "application/json",
        text: JSON.stringify(await Spotify.search(params)),
      },
    ],
  })
);

server.tool(
  "ttrpgmcp_play_in_spotify",
  "Play a track in Spotify",
  {
    context_uri: z.string().optional(),
    uris: z.array(z.string()).optional(),
    offset: z
      .object({
        position: z.number().int().min(0).optional(),
        uri: z.string().optional(),
      })
      .optional(),
    position_ms: z.number().int().min(0).optional(),
  },
  {
    title: "Play in Spotify",
    description:
      "Play a track in Spotify by its uri, or an artist/genere/album by its context uri.",
    readOnlyHint: true,
    openWorldHint: true,
  },
  async (params) => {
    if (!params.uris && !params.context_uri) {
      throw new Error('Either "uris" or "context_uri" must be provided.');
    }
    await Spotify.playTrack(params);
    return {
      content: [
        {
          type: "text",
          text: "Playing!",
        },
      ],
    };
  }
);

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
  "ttrpgmcp_create_logs_summary",
  "Create a summary of the last campaign logs",
  {
    title: "Create Logs Summary",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  async () => {
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

    // Get the last 1 logs
    const recentLogs = logs.slice(-1);
    // Parse to string
    const recentLogsString = recentLogs
      .map(
        (log) =>
          `Title: ${log.title}\nContent: ${log.content}\nDate: ${log.date}\nCreated At: ${log.createdAt}`
      )
      .join("\n\n");

    try {
      const gptClient = new GPTClient(process.env.OPENAI_API_KEY as string);

      const summary = await gptClient.generateText(
        `Generate a summary of the last 3 campaign logs:\n\n${recentLogsString}\n\nProvide a concise overview of the key events and themes in these logs. Write a cohesive, third-person narrative summary of the last three TTRPG campaign sessions. Blend the events from each log into a single flowing story, maintaining a fantasy-adventure tone. Highlight character actions, important dialogue or moments (even if invented to enrich the summary), and build tension where appropriate. Focus on immersive storytelling rather than exposition or analysis. The summary should be engaging and suitable for sharing with players to recap the recent campaign events. Aim for a length of around 100 words.`
      );

      return {
        content: [
          {
            type: "text",
            text: `Summary of the last 3 campaign logs:\n\n${summary}`,
          },
        ],
      };
    } catch {
      return {
        content: [{ type: "text", text: "Failed to generate user data" }],
      };
    }
  }
);

server.tool(
  "ttrpgmcp_create_background_image",
  "Used for image creation, creates a background image for a campaign based on a description",
  {
    description: z.string().optional(),
  },
  {
    title: "Create Background Image",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  async (params) => {
    const basePrompt =
      "Generate a background image for a fantasy tabletop role-playing game campaign. The image should be atmospheric, with rich details and dramatic lighting, suitable for a TTRPG setting.";
    const customDescription = params.description
      ? ` ${params.description}`
      : "";
    const fullPrompt = `${basePrompt}${customDescription} Return this data as a JSON object with no other text or formatter so it can be used with JSON.parse. Return the image URL in a field called 'imageUrl'.`;
    try {
      const gptClient = await new GPTClient(
        process.env.OPENAI_API_KEY as string
      );

      const imageUrl = await gptClient.generateImage(fullPrompt);

      return {
        content: [
          {
            type: "text",
            text: `Background image created successfully: ${imageUrl}`,
          },
        ],
      };
    } catch {
      return {
        content: [{ type: "text", text: "Failed to generate user data" }],
      };
    }
  }
);

server.tool(
  "ttrpgmcp_create_character_image",
  "Create a character image for a TTRPG campaign",
  {
    description: z.string(),
    style: z
      .enum(["portrait", "full-body", "token"])
      .optional()
      .default("portrait"),
    artStyle: z
      .enum(["realistic", "fantasy-art", "anime", "cartoon", "medieval"])
      .optional()
      .default("fantasy-art"),
  },
  {
    title: "Create Character Image",
    description:
      "Generates a character image based on description, style, and art style for TTRPG use.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  async (params) => {
    try {
      const basePrompt =
        "Generate a detailed character image for a fantasy tabletop role-playing game.";
      const stylePrompt =
        params.style === "portrait"
          ? "Show a portrait view from chest up with clear facial features."
          : params.style === "full-body"
          ? "Show the full character from head to toe in a standing pose."
          : "Create a character token suitable for use on a battle map, clear and recognizable.";

      const artStylePrompt =
        params.artStyle === "realistic"
          ? "Use realistic, lifelike art style with detailed textures."
          : params.artStyle === "anime"
          ? "Use anime/manga art style with expressive features."
          : params.artStyle === "cartoon"
          ? "Use cartoon/stylized art style with simplified features."
          : params.artStyle === "medieval"
          ? "Use medieval manuscript art style with rich colors and decorative elements."
          : "Use fantasy art style with dramatic lighting and magical atmosphere.";

      const fullPrompt = `${basePrompt} ${params.description} ${stylePrompt} ${artStylePrompt} The image should be high quality, detailed, and suitable for use in a TTRPG campaign. Return this data as a JSON object with no other text or formatter so it can be used with JSON.parse. Return the image URL in a field called 'imageUrl'.`;

      const gptClient = await new GPTClient(
        process.env.OPENAI_API_KEY as string
      );

      const imageUrl = await gptClient.generateImage(fullPrompt);

      return {
        content: [
          {
            type: "text",
            text: `Character image created successfully: ${imageUrl}`,
          },
        ],
      };
    } catch (error) {
      console.error("Error creating character image:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          {
            type: "text",
            text: `Failed to create character image: ${errorMessage}`,
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

async function getUsers() {
  try {
    const data = await fs.readFile("./src/data/users.json", "utf8");
    return JSON.parse(data);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      // If file doesn't exist, return an empty array
      return [];
    }
    throw error;
  }
}

async function createUser(user: {
  name: string;
  email: string;
  address: string;
  phonenumber: string;
}) {
  try {
    // Method 1: Read file directly with fs (more reliable)
    const users = await getUsers();

    const id = users.length + 1;
    users.push({ id, ...user });

    await fs.writeFile(
      "./src/data/users.json",
      JSON.stringify(users, null, 2),
      "utf8"
    );

    return id;
  } catch (error) {
    // If file doesn't exist, create it with initial data
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      const users = [];
      const id = 1;
      users.push({ id, ...user });

      await fs.writeFile(
        "./src/data/users.json",
        JSON.stringify(users, null, 2),
        "utf8"
      );
      return id;
    }
    throw error;
  }
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // console.log('Server is running and waiting for requests...');
}

main();

server.tool(
  "ttrpgmcp_get_monster_and_create_image",
  "Get monster data from D&D 5e API and create an image",
  {
    monsterIndex: z.string().min(1, "Monster index is required"),
    imageStyle: z
      .enum(["realistic", "fantasy-art", "dark", "heroic"])
      .optional()
      .default("fantasy-art"),
  },
  {
    title: "Get Monster and Create Image",
    description:
      "Fetches monster data from D&D 5e API and generates an image based on the monster description.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  async (params) => {
    try {
      // Fetch monster data from D&D 5e API
      const apiUrl = `https://www.dnd5eapi.co/api/2014/monsters/${params.monsterIndex}`;
      const response = await fetch(apiUrl);

      if (!response.ok) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to fetch monster data: ${response.status} ${response.statusText}`,
            },
          ],
        };
      }

      const monsterData = (await response.json()) as MonsterData;

      // Create a detailed description for image generation
      const sizeDescriptor = monsterData.size.toLowerCase();
      const typeDescriptor = monsterData.type.toLowerCase();
      const alignmentDescriptor = monsterData.alignment.toLowerCase();

      // Extract key abilities for description
      const abilities =
        monsterData.special_abilities
          ?.slice(0, 2)
          .map((ability) => ability.name)
          .join(", ") || "";
      const notableActions =
        monsterData.actions
          ?.slice(0, 2)
          .map((action) => action.name)
          .join(", ") || "";

      const imageDescription = `A ${sizeDescriptor} ${typeDescriptor} creature that is ${alignmentDescriptor}. ${
        monsterData.name
      } with ${
        abilities
          ? `special abilities including ${abilities}`
          : "formidable powers"
      }. ${
        notableActions
          ? `Known for attacks like ${notableActions}`
          : "A dangerous adversary"
      }. Challenge rating ${monsterData.challenge_rating}.`;

      // Generate image based on monster description
      const stylePrompt =
        params.imageStyle === "realistic"
          ? "Use photorealistic style with detailed textures and lighting."
          : params.imageStyle === "dark"
          ? "Use dark, ominous atmosphere with dramatic shadows and menacing presence."
          : params.imageStyle === "heroic"
          ? "Use heroic fantasy style with dramatic poses and epic lighting."
          : "Use fantasy art style with rich colors and magical atmosphere.";

      const fullPrompt = `Generate a detailed image of ${monsterData.name}: ${imageDescription} ${stylePrompt} The image should be suitable for use in a D&D campaign, showing the creature in its natural environment or combat stance. Return this data as a JSON object with no other text or formatter so it can be used with JSON.parse. Return the image URL in a field called 'imageUrl'.`;

      const gptClient = await new GPTClient(
        process.env.OPENAI_API_KEY as string
      );

      const imageUrl = await gptClient.generateImage(fullPrompt);

      // Return both monster data and generated image
      const result = {
        monster: {
          name: monsterData.name,
          size: monsterData.size,
          type: monsterData.type,
          alignment: monsterData.alignment,
          armorClass: monsterData.armor_class[0]?.value || "Unknown",
          hitPoints: monsterData.hit_points,
          challengeRating: monsterData.challenge_rating,
          specialAbilities:
            monsterData.special_abilities?.slice(0, 3).map((ability) => ({
              name: ability.name,
              description: ability.desc,
            })) || [],
          actions:
            monsterData.actions?.slice(0, 3).map((action) => ({
              name: action.name,
              description: action.desc,
            })) || [],
        },
        generatedImageUrl: imageUrl,
        apiImageUrl: monsterData.image
          ? `https://www.dnd5eapi.co${monsterData.image}`
          : null,
      };

      return {
        content: [
          {
            type: "text",
            mimeType: "application/json",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error("Error fetching monster data or creating image:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          {
            type: "text",
            text: `Failed to fetch monster data or create image: ${errorMessage}`,
          },
        ],
      };
    }
  }
);

server.tool(
  "ttrpgmcp_get_monster_description",
  "Get monster description and stats from D&D 5e API",
  {
    monsterIndex: z.string().min(1, "Monster index is required"),
  },
  {
    title: "Get Monster Description",
    description:
      "Fetches only the monster description and basic stats from D&D 5e API without generating images.",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  async (params) => {
    try {
      // Fetch monster data from D&D 5e API
      const apiUrl = `https://www.dnd5eapi.co/api/2014/monsters/${params.monsterIndex}`;
      const response = await fetch(apiUrl);

      if (!response.ok) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to fetch monster data: ${response.status} ${response.statusText}`,
            },
          ],
        };
      }

      const monsterData = (await response.json()) as MonsterData;

      // Create a comprehensive description
      const description = {
        name: monsterData.name,
        size: monsterData.size,
        type: monsterData.type,
        alignment: monsterData.alignment,
        armorClass: monsterData.armor_class[0]?.value || "Unknown",
        hitPoints: monsterData.hit_points,
        challengeRating: monsterData.challenge_rating,
        specialAbilities:
          monsterData.special_abilities?.map((ability) => ({
            name: ability.name,
            description: ability.desc,
          })) || [],
        actions:
          monsterData.actions?.map((action) => ({
            name: action.name,
            description: action.desc,
          })) || [],
        summary: `The ${
          monsterData.name
        } is a ${monsterData.size.toLowerCase()} ${monsterData.type.toLowerCase()} creature with ${monsterData.alignment.toLowerCase()} alignment. It has ${
          monsterData.hit_points
        } hit points, an armor class of ${
          monsterData.armor_class[0]?.value || "unknown"
        }, and a challenge rating of ${monsterData.challenge_rating}.`,
      };

      return {
        content: [
          {
            type: "text",
            mimeType: "application/json",
            text: JSON.stringify(description, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error("Error fetching monster description:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          {
            type: "text",
            text: `Failed to fetch monster description: ${errorMessage}`,
          },
        ],
      };
    }
  }
);

server.tool(
  "ttrpgmcp_get_monster_image",
  "Get monster image from D&D 5e API",
  {
    monsterIndex: z.string().min(1, "Monster index is required"),
  },
  {
    title: "Get Monster Image",
    description: "Fetches only the official monster image from D&D 5e API.",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  async (params) => {
    try {
      // Fetch monster data from D&D 5e API
      const apiUrl = `https://www.dnd5eapi.co/api/2014/monsters/${params.monsterIndex}`;
      const response = await fetch(apiUrl);

      if (!response.ok) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to fetch monster data: ${response.status} ${response.statusText}`,
            },
          ],
        };
      }

      const monsterData = (await response.json()) as MonsterData;

      if (!monsterData.image) {
        return {
          content: [
            {
              type: "text",
              text: `No official image available for ${monsterData.name}`,
            },
          ],
        };
      }

      const imageUrl = `https://www.dnd5eapi.co${monsterData.image}`;

      return {
        content: [
          {
            type: "text",
            mimeType: "application/json",
            text: JSON.stringify(
              {
                name: monsterData.name,
                imageUrl: imageUrl,
                message: `Official image for ${monsterData.name} retrieved successfully`,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      console.error("Error fetching monster image:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          {
            type: "text",
            text: `Failed to fetch monster image: ${errorMessage}`,
          },
        ],
      };
    }
  }
);
