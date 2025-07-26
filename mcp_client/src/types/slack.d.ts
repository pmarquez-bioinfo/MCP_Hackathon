
export interface SlackBlock {
    type: string;
    block_id: string;
    elements: any[];
  }
  
  export interface SlackMessage {
    user: string;
    type: string;
    ts: string;
    client_msg_id?: string;
    text: string;
    team: string;
    blocks?: SlackBlock[];
    channel: string;
    event_ts: string;
    channel_type: string;
    subtype?: string;
    thread_ts?: string;
  }
  
  export interface SlackMentionEvent {
    user: string;
    type: string; // Will be 'app_mention'
    ts: string;
    client_msg_id: string;
    text: string;
    team: string;
    blocks: SlackBlock[];
    channel: string;
    event_ts: string;
    thread_ts?: string;
    subtype?: string;
    bot_id?: string; // Bot ID if it's a bot message
  }
  
  // Message history store
  export interface ConversationMessage {
    role: "user" | "assistant";
    content: string;
    timestamp: string;
  }