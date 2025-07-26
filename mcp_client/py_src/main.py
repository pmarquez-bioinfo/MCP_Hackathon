from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import asyncio
from dotenv import load_dotenv
import json
import logging
import time
import uuid

# Import the OpenAI Agents SDK
from agents import Agent, Runner, gen_trace_id, trace
from agents.mcp import MCPServerStdio

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize MCP servers at the application level
custom_mcp_server = None

# Create an event loop for the application
loop = asyncio.new_event_loop()
asyncio.set_event_loop(loop)

async def initialize_mcp_servers():
    """Initialize all MCP servers needed for the application"""
    global custom_mcp_server
    
    logger.info("Initializing MCP servers...")
    
    logger.info("Initializing TTRPG MCP server...")
    custom_mcp_server = MCPServerStdio(
        name="TTRPG",
        params={
            "command": "npm",
            "args": ["run", "server:dev"],
            "cwd": "../../mcp_server"
        },
    )
    await custom_mcp_server.connect()
    
    logger.info("TTRPG MCP server initialized successfully")

    # List tools from each server for verification
    if custom_mcp_server:
        ttrpg_tools = await custom_mcp_server.list_tools()
        # print a formated list of tools, tools is and array not a json
        logger.info(f"TTRPG MCP server tools:")
        for tool in ttrpg_tools:
            logger.info(f" - {tool}\n")

    logger.info("All MCP servers initialized successfully")

# Initialize servers before starting Flask
try:
    logger.info("Initializing MCP servers before app start...")
    loop.run_until_complete(initialize_mcp_servers())
    logger.info("MCP servers initialized successfully")
except Exception as e:
    logger.error(f"Error initializing MCP servers: {str(e)}", exc_info=True)

# Create Flask app after servers are initialized
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Store conversation contexts
conversation_contexts = {}

@app.route("/health", methods=["GET"])
def health_check():
    """Simple health check endpoint"""
    server_status = {
        "ttrpg": custom_mcp_server is not None,
        # "slack": slack_server is not None,
    }
    return jsonify({
        "status": "healthy", 
        "timestamp": time.time(),
        "servers": server_status
    })

@app.route("/process_sync", methods=["POST"])
def process_question_sync():
    """Process a question from the Slack bot using sync with event loop"""
    try:
        data = request.json
        question = data.get("question", "")
        
        logger.info(f"Question: {question}")

        # Combine context and question
        full_prompt = f"{question}"

        logger.info(f"Full prompt: {full_prompt}")
        
        # Run the agent
        result = loop.run_until_complete(process_with_agent(full_prompt))
        
        # Extract the response
        response = result
        
        logger.info(f"Generated response: {response[:100]}...")  # Log first 100 chars
        return jsonify({"response": response})
    
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}", exc_info=True)
        return jsonify({
            "response": "I'm sorry, I encountered an error while processing your request.",
            "error": str(e)
        }), 500

async def process_with_agent(message):
    """Process a message with the Agent using multiple MCP servers"""
    global custom_mcp_server
    
    # Make sure the servers are available
    if not all([custom_mcp_server]):
        logger.warning("Some MCP servers are not initialized. Initializing now...")
        await initialize_mcp_servers()
    
    # Create the agent with all available servers
    agent = Agent(
        name="TTRPG Slack Assistant",
        instructions="""
            You are a helpful assistant for a tabletop RPG game. Use the MCP resources and tools to assist users with their questions and tasks.
            If the user asks for image generation use the MCP tools for that
            If the user asks for music or sound effects, use the Spotify API to find suitable tracks.
            
        """,
        mcp_servers=[custom_mcp_server],
        model="gpt-4o"
    )
    
    # Generate a trace ID for debugging
    trace_id = gen_trace_id()
    response = ""
    
    # Run the agent with tracing
    with trace(workflow_name="Slack Assistant", trace_id=trace_id):
        logger.info(f"View trace: https://platform.openai.com/traces/trace?trace_id={trace_id}")
        result = await Runner.run(
            starting_agent=agent,
            input=message
        )
        response = result.final_output if hasattr(result, 'final_output') else str(result)
    
    return response

if __name__ == "__main__":
    port = int(os.getenv("PYTHON_SERVICE_PORT", 5005))
    logger.info(f"Starting agent service on port {port}")
    app.run(host="0.0.0.0", port=port, debug=False)