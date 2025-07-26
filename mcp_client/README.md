# Octavio - AI-Powered Slack Assistant

Octavio is an intelligent Slack bot built with TypeScript and Python that integrates with Jira and Slack to provide contextual assistance. It uses OpenAI's GPT-4 model and MCP (Model Context Protocol) servers to interact with various services.

## Features

- **Slack Integration**: Responds to direct messages and @mentions in channels
- **Conversation Context**: Maintains conversation history for contextual responses
- **Jira Integration**: Access and interact with Jira tickets and information
- **MCP Architecture**: Uses Model Context Protocol servers for extensible integrations
- **Dual-Service Architecture**: TypeScript bot handles Slack events, Python service processes AI requests

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   Slack API     │────▶│  TypeScript Bot │
└─────────────────┘     └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │  Python Agent   │
                        │    Service      │
                        └────────┬────────┘
                                 │
                        ┌────────┴────────┐
                        ▼                 ▼
                ┌─────────────┐   ┌─────────────┐
                │ Jira MCP    │   │ Slack MCP   │
                │   Server    │   │   Server    │
                └─────────────┘   └─────────────┘
```

## Prerequisites

- Node.js (v18+)
- Python 3.8+
- pnpm (for package management)
- uv (for Python dependency management)
- Docker (for Jira MCP server)
- Slack workspace with bot permissions
- Jira instance with API access

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd octavio
```

2. Install Node.js dependencies:
```bash
pnpm install
```

3. Install Python dependencies:
```bash
cd py_src
uv sync
cd ..
```

4. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
- `SLACK_BOT_TOKEN`: Your Slack bot OAuth token
- `SLACK_SIGNING_SECRET`: Slack app signing secret
- `SLACK_APP_TOKEN`: Slack app-level token for Socket Mode
- `SLACK_TEAM_ID`: Your Slack workspace team ID
- `OPENAI_API_KEY`: OpenAI API key for GPT-4
- `JIRA_URL`: Your Jira instance URL
- `JIRA_USERNAME`: Jira username
- `JIRA_API_TOKEN`: Jira API token
- `AGENT_SERVICE_URL`: Python service URL (default: http://localhost:5005)
- `PYTHON_SERVICE_PORT`: Python service port (default: 5005)
- `PORT`: TypeScript bot port (default: 4040)

## Slack App Setup

1. Create a new Slack app at https://api.slack.com/apps
2. Enable Socket Mode in your app settings
3. Add Bot Token Scopes:
   - `app_mentions:read` - Read messages that mention your app
   - `channels:history` - View messages in public channels
   - `chat:write` - Send messages
   - `im:history` - View direct messages
   - `im:read` - View basic info about direct messages
   - `im:write` - Send direct messages
4. Subscribe to bot events:
   - `app_mention` - Subscribe to mentions
   - `message.im` - Subscribe to direct messages
5. Install the app to your workspace

## Running the Application

### Development Mode

Start both services with hot-reload:

```bash
# Terminal 1 - Start TypeScript bot
pnpm dev

# Terminal 2 - Start Python agent service (manually)
cd py_src
uv run main.py
```

### Production Mode

Build and run:

```bash
# Build TypeScript
pnpm build

# Start the application (launches both services)
pnpm start
```

## Usage

### Direct Messages
Send a direct message to the bot, and it will respond with context-aware assistance.

### Channel Mentions
Mention the bot in any channel where it's been added:
```
@Octavio Can you help me find ticket DEV-1234?
```

### Supported Commands

The bot understands natural language and can:
- Look up Jira tickets (e.g., "Show me DEV-1234")
- Search for Slack messages and conversations
- Provide contextual assistance based on conversation history
- Answer questions about your projects and workflows

## Development

### Project Structure

```
octavio/
├── src/                    # TypeScript source code
│   ├── main.ts            # Main bot application
│   └── types/             # TypeScript type definitions
├── py_src/                # Python agent service
│   ├── main.py           # Flask API server
│   └── pyproject.toml    # Python dependencies
├── dist/                  # Compiled TypeScript output
├── package.json          # Node.js dependencies
└── tsconfig.json         # TypeScript configuration
```

### Available Scripts

- `pnpm build` - Compile TypeScript to JavaScript
- `pnpm start` - Run production build
- `pnpm dev` - Run in development mode with hot-reload
- `pnpm watch` - Watch TypeScript files for changes

## Troubleshooting

### Bot not responding
- Check that all environment variables are set correctly
- Verify the bot is installed in your workspace
- Ensure Socket Mode is enabled
- Check logs for connection errors

### Python service errors
- Ensure Docker is running (for Jira MCP server)
- Verify Python dependencies are installed with `uv sync`
- Check that the AGENT_SERVICE_URL matches the Python service address

### MCP Server issues
- Jira MCP requires Docker to be running
- Slack MCP needs valid bot token and team ID
- Check server initialization logs for specific errors

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

ISC License - see package.json for details
