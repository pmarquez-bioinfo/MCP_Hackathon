import dotenv from "dotenv";
import bolt from "@slack/bolt";
import { spawn } from 'child_process';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
const { App } = bolt;


import {
  ConversationMessage,
  SlackMentionEvent,
  SlackMessage,
} from "./types/slack.js";

dotenv.config();

export function runUvScript() {
  const subprocess = spawn('uv', ['run', 'main.py'], { cwd: 'py_src' });

  subprocess.stdout.on('data', (data) => {
    process.stdout.write(`📤 ${data}`);
  });

  subprocess.stderr.on('data', (data) => {
    process.stderr.write(`⚠️ ${data}`);
  });

  subprocess.on('close', (code) => {
    console.log(`✅ Process exited with code ${code}`);
  });

  subprocess.on('error', (err) => {
    console.error('❌ Failed to start process:', err);
  });
}

// Store conversation history by channel+thread or DM
const conversationHistory: Record<string, ConversationMessage[]> = {};

// Function to get a unique key for each conversation context
function getConversationKey(channel: string, thread_ts?: string): string {
  return thread_ts ? `${channel}-${thread_ts}` : channel;
}

// Ensure environment variables are set
if (
  !process.env.SLACK_BOT_TOKEN ||
  !process.env.SLACK_SIGNING_SECRET ||
  !process.env.SLACK_APP_TOKEN
) {
  console.error("Missing required environment variables");
  process.exit(1);
}

// Initialize your app with your bot token and signing secret
const app = new App({
  socketMode: true,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
});

//Start the python agent service


// Listen for direct messages to the bot
app.message(async ({ message, say }) => {
  // Cast to our custom type
  const msg = message as unknown as SlackMessage;

  console.log("Received message:", msg);
  console.log("CHANNEL:", msg.channel);

  // Skip messages from the bot itself
  if (msg.subtype === "bot_message") return;

  try {
    const text = msg.text || "";
    const convKey = getConversationKey(msg.channel, msg.thread_ts);

    // Initialize history array if this is a new conversation
    if (!conversationHistory[convKey]) {
      conversationHistory[convKey] = [];
    }

    // Add the user's message to history
    conversationHistory[convKey].push({
      role: "user",
      content: text,
      timestamp: msg.ts,
    });

    // Process the user's question with context
    const answer = await processQuestionWithContext(text, convKey, {channel: msg.channel, thread_ts: msg.thread_ts});

    // Store the bot's response in history
    conversationHistory[convKey].push({
      role: "assistant",
      content: answer,
      timestamp: new Date().getTime().toString(),
    });

    // Reply to the message
    await say({
      text: answer,
      thread_ts: msg.thread_ts ? msg.thread_ts : undefined,
    });
  } catch (error) {
    console.error("Error processing message:", error);
    await say({
      text: "Sorry, I encountered an error while processing your question.",
      thread_ts: msg.thread_ts ? msg.thread_ts : undefined,
    });
  }
});

// Listen for mentions of the bot in channels
app.event("app_mention", async ({ event, say }) => {
  // Cast to our custom type
  const evt = event as unknown as SlackMentionEvent;

  console.log("Received mention:", evt);
  console.log("CHANNEL:", evt.channel);
  console.log("THREAD:", evt.thread_ts);

  try {
    // Get the bot's user ID
    const authTest = await app.client.auth.test();
    const botUserId = authTest.user_id as string;

    // Extract the question (remove the bot mention)
    const botMention = `<@${botUserId}>`;
    const question = evt.text.replace(botMention, "").trim();

    const convKey = getConversationKey(evt.channel, evt.thread_ts);

    // Initialize history array if this is a new conversation
    if (!conversationHistory[convKey]) {
      conversationHistory[convKey] = [];
    }

    // Add the user's message to history
    conversationHistory[convKey].push({
      role: "user",
      content: question,
      timestamp: evt.ts,
    });

    // Process the user's question with context
    const answer = await processQuestionWithContext(question, convKey, {channel: evt.channel, thread_ts: evt.thread_ts});

    // Store the bot's response in history
    conversationHistory[convKey].push({
      role: "assistant",
      content: answer,
      timestamp: new Date().getTime().toString(),
    });

    // Reply to the mention
    await say({
      text: answer,
      thread_ts: evt.thread_ts || evt.ts,
    });
  } catch (error) {
    console.error("Error processing mention:", error);
    await say({
      text: "Sorry, I encountered an error while processing your mention.",
      thread_ts: evt.thread_ts || evt.ts,
    });
  }
});

// Function to process questions with context and return answers
async function processQuestionWithContext(
  question: string,
  convKey: string,
  slackContext: { channel: string; thread_ts?: string }
): Promise<string> {
  console.log(question, convKey);
  // Get conversation history for this thread
  const history = conversationHistory[convKey] || [];

  // Create context string from the last N messages (adjust as needed)
  const MAX_CONTEXT_MESSAGES = 10;
  const recentMessages = history.slice(-MAX_CONTEXT_MESSAGES);

  // Build a context string to provide to the agent
  let contextPrompt = "";
  if (recentMessages.length > 0) {
    contextPrompt = "Here's our conversation so far:\n\n";

    for (const msg of recentMessages) {
      const role = msg.role === "user" ? "User" : "Assistant";
      contextPrompt += `${role}: ${msg.content}\n\n`;
    }

    contextPrompt +=
      "Please take the above conversation into account when responding.\n\n";
  }

  try {
    // Send request to Python agent service
    const response = await fetch(`${process.env.AGENT_SERVICE_URL}/process_sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question,
        conversation_key: convKey,
        conversation_history: history,
        slackContext: JSON.stringify(slackContext),
      }),
    });

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }

    const data: any = await response.json();
    return data?.response ?? "";
  } catch (error) {
    console.error("Error calling Python agent service:", error);
    return "Sorry, I'm having trouble connecting to my assistant service.";
  }
}

// Function to serve the web client
function serveWebClient() {
  const webApp = express();
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  // Serve static files from the web directory
  const webPath = path.join(__dirname, '../../web');
  webApp.use(express.static(webPath));
  
  const webPort = parseInt(process.env.WEB_PORT || "8080", 10);
  webApp.listen(webPort, () => {
    console.log(`🌐 Web client is served at http://localhost:${webPort}`);
  });
}

// Start the app
(async () => {
  // Start the Python agent service
  runUvScript();
  
  // Serve the web client
  serveWebClient();
  
  const port = parseInt(process.env.PORT || "3000", 10);
  await app.start(port);

  console.log(`⚡️ Bolt app is running at http://localhost:${port}`);
})();
