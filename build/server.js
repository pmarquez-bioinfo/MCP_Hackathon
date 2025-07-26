"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const promises_1 = __importDefault(require("fs/promises"));
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
async function getUsers() {
    try {
        const data = await promises_1.default.readFile("./src/data/users.json", "utf8");
        return JSON.parse(data);
    }
    catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
            // If file doesn't exist, return an empty array
            return [];
        }
        throw error;
    }
}
const server = new mcp_js_1.McpServer({
    name: "user-creator-server",
    description: "A server that creates users",
    version: "0.1.0",
    capabilities: {
        resources: {},
        tools: {},
        promts: {},
    },
});
server.resource("users", "users://all", {
    description: "Get all users in the system",
    title: "Get All Users",
    mimeType: "application/json",
}, async (uri) => {
    const users = await getUsers();
    return {
        contents: [
            {
                uri: uri.href,
                type: "text",
                text: JSON.stringify(users, null, 2),
                mimeType: "application/json",
            },
        ],
    };
});
server.resource("user-details", new mcp_js_1.ResourceTemplate("users://{userId}/profile", { list: undefined }), {
    description: "Get a user's details from teh database",
    title: "User Details",
    mimeType: "application/json",
}, async (uri, { userId }) => {
    const users = await getUsers();
    const user = users.find((u) => u.id === parseInt(userId));
    if (user == null) {
        return {
            contents: [
                {
                    uri: uri.href,
                    text: JSON.stringify({ error: "User not found" }),
                    mimeType: "application/json",
                },
            ],
        };
    }
    return {
        contents: [
            {
                uri: uri.href,
                text: JSON.stringify(user),
                mimeType: "application/json",
            },
        ],
    };
});
server.tool("createUser", "Create a new unser in the system", {
    name: zod_1.z.string(),
    email: zod_1.z.string().email(),
    address: zod_1.z.string(),
    phonenumber: zod_1.z.string(),
}, {
    title: "Create User",
    description: "Creates a new user with the provided details.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
}, async (params) => {
    try {
        const id = await createUser(params);
        return {
            content: [
                {
                    type: "text",
                    text: "User created successfully with ID: " + id,
                },
            ],
        };
    }
    catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: "Failed to create user",
                },
            ],
        };
    }
});
server.tool("create-random-user", "Create a random user with fake data", {
    title: "Create Random User",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
}, async () => {
    const res = await server.server.request({
        method: "sampling/createMessage",
        params: {
            messages: [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: "Generate fake user data. The user should have a realistic name, email, address, and phone number. Return this data as a JSON object with no other text or formatter so it can be used with JSON.parse.",
                    },
                },
            ],
            maxTokens: 1024,
        },
    }, types_js_1.CreateMessageResultSchema);
    if (res.content.type !== "text") {
        return {
            content: [{ type: "text", text: "Failed to generate user data" }],
        };
    }
    try {
        const fakeUser = JSON.parse(res.content.text
            .trim()
            .replace(/^```json/, "")
            .replace(/```$/, "")
            .trim());
        const id = await createUser(fakeUser);
        return {
            content: [{ type: "text", text: `User ${id} created successfully` }],
        };
    }
    catch {
        return {
            content: [{ type: "text", text: "Failed to generate user data" }],
        };
    }
});
server.prompt("generate-fake-user", "Generate a fake user based on a given name", {
    name: zod_1.z.string(),
}, ({ name }) => {
    return {
        messages: [
            {
                role: "user",
                content: {
                    type: "text",
                    text: `Generate a fake user with the name ${name}. The user should have a realistic email, address, and phone number.`,
                },
            },
        ],
    };
});
async function createUser(user) {
    try {
        // Method 1: Read file directly with fs (more reliable)
        const users = await getUsers();
        const id = users.length + 1;
        users.push({ id, ...user });
        await promises_1.default.writeFile("./src/data/users.json", JSON.stringify(users, null, 2), "utf8");
        return id;
    }
    catch (error) {
        // If file doesn't exist, create it with initial data
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
            const users = [];
            const id = 1;
            users.push({ id, ...user });
            await promises_1.default.writeFile("./src/data/users.json", JSON.stringify(users, null, 2), "utf8");
            return id;
        }
        throw error;
    }
}
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.log("Server is running and waiting for requests...");
}
main();
