declare global {
    namespace NodeJS {
      interface ProcessEnv {
        SLACK_BOT_TOKEN: string;
        SLACK_SIGNING_SECRET: string;
        SLACK_APP_TOKEN: string;
        PORT?: string;
      }
    }
  }
  
  // Export an empty object to make this file a module
  export {};