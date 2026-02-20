"use strict";

const PUBLIC_PERMISSIONS = [
  "api::landing-page.landing-page.find",
  "api::landing-page.landing-page.findOne",
  "api::website.website.find",
  "api::website.website.findOne",
  "api::page.page.find",
  "api::page.page.findOne",
  "api::blog-post.blog-post.find",
  "api::blog-post.blog-post.findOne",
];

module.exports = {
  register(/* { strapi } */) {},

  async bootstrap({ strapi }) {
    const publicRole = await strapi
      .query("plugin::users-permissions.role")
      .findOne({ where: { type: "public" } });

    if (!publicRole) return;

    const existing = await strapi
      .query("plugin::users-permissions.permission")
      .findMany({ where: { role: publicRole.id } });

    const existingActions = new Set(existing.map((p) => p.action));

    for (const action of PUBLIC_PERMISSIONS) {
      if (!existingActions.has(action)) {
        await strapi.query("plugin::users-permissions.permission").create({
          data: { action, role: publicRole.id, enabled: true },
        });
        strapi.log.info(`Enabled public ${action}`);
      }
    }
  },

  destroy(/* { strapi } */) {},
};
