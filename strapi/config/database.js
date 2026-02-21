const { parse } = require("pg-connection-string");

module.exports = ({ env }) => {
  const isProduction = env("NODE_ENV") === "production";

  if (isProduction || env("DATABASE_URL", "")) {
    const dbUrl = env("DATABASE_URL", "");
    if (dbUrl) {
      const config = parse(dbUrl);
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
