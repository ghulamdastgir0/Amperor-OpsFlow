export default () => ({
  port: parseInt(process.env.PORT ?? '4000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  appUrl: process.env.APP_URL ?? 'http://localhost:4000',
  database: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'change-me',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  },
  slack: {
    // Fallback bot token for local/dev use before a tenant has completed the
    // OAuth install below (which stores its own token on Tenant.slackBotToken).
    botToken: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    clientId: process.env.SLACK_CLIENT_ID,
    clientSecret: process.env.SLACK_CLIENT_SECRET,
  },
  llm: {
    apiKey: process.env.LLM_API_KEY,
    model: process.env.LLM_MODEL ?? 'gemini-2.5-flash',
    // Embeddings run locally via EmbeddingService (Xenova/all-MiniLM-L6-v2, transformers.js) —
    // not Gemini. No API key or config needed there.
  },
});
