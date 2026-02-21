module.exports = ({ env }) => {
  const host = env("HOST", "0.0.0.0");
  const port = env.int("PORT", 1337);
  const publicUrl = env("STRAPI_PUBLIC_URL", "");
  return {
    host: host || "0.0.0.0",
    port,
    url: publicUrl || undefined,
    app: {
      keys: env.array("APP_KEYS"),
    },
  };
};
