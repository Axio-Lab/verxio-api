const { parse } = require("pg-connection-string");

// Use verify-full explicitly to avoid pg-connection-string v3 / pg v9 warning
// (require/prefer/verify-ca are currently aliases for verify-full but will change)
function normalizePgUrl(url) {
  if (!url || typeof url !== "string") return url;
  return url.replace(
    /([?&])sslmode=(?:require|prefer|verify-ca)(&|$)/gi,
    "$1sslmode=verify-full$2"
  );
}

module.exports = ({ env }) => {
  const isProduction = env("NODE_ENV") === "production";

  if (isProduction || env("DATABASE_URL", "")) {
    const dbUrl = env("DATABASE_URL", "");
    if (dbUrl) {
      const config = parse(normalizePgUrl(dbUrl));
      return {
        connection: {
          client: "postgres",
          connection: {
            host: config.host,
            port: parseInt(config.port || "5432", 10),
            database: config.database,
            user: config.user,
            password: config.password,
            ssl: isProduction ? { rejectUnauthorized: false } : false,
          },
          pool: { min: 0, max: 10 },
        },
      };
    }
  }

  return {
    connection: {
      client: "sqlite",
      connection: {
        filename: env("DATABASE_FILENAME", ".tmp/data.db"),
      },
      useNullAsDefault: true,
    },
  };
};
