export const daytonaConfig = {
  apiUrl: process.env.DAYTONA_API_URL || "https://app.daytona.io/api",
  apiKey: process.env.DAYTONA_API_KEY || "",
  target: process.env.DAYTONA_TARGET || "us",
  // Default sandbox settings
  defaultLanguage: "typescript" as const,
  defaultAutoStopInterval: 60, // 1 hour in minutes
  defaultAutoArchiveInterval: 60, // 1 hour in minutes
  defaultAutoDeleteInterval: 120, // 2 hours in minutes
  // Resource limits
  maxExecutionTime: 300000, // 5 minutes in milliseconds
  maxSandboxLifetime: 3600000, // 1 hour in milliseconds
};
