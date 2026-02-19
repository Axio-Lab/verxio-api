"use strict";

module.exports = {
  register(/* { strapi } */) {},

  async bootstrap({ strapi }) {
    const publicRole = await strapi
      .query("plugin::users-permissions.role")
      .findOne({ where: { type: "public" } });

    if (!publicRole) return;

    const permissions = await strapi
      .query("plugin::users-permissions.permission")
      .findMany({ where: { role: publicRole.id } });

    const hasFind = permissions.some(
      (p) => p.action === "api::landing-page.landing-page.find"
    );
    const hasFindOne = permissions.some(
      (p) => p.action === "api::landing-page.landing-page.findOne"
    );

    if (!hasFind) {
      await strapi.query("plugin::users-permissions.permission").create({
        data: {
          action: "api::landing-page.landing-page.find",
          role: publicRole.id,
          enabled: true,
        },
      });
      strapi.log.info("Enabled public find for landing-page");
    }

    if (!hasFindOne) {
      await strapi.query("plugin::users-permissions.permission").create({
        data: {
          action: "api::landing-page.landing-page.findOne",
          role: publicRole.id,
          enabled: true,
        },
      });
      strapi.log.info("Enabled public findOne for landing-page");
    }
  },

  destroy(/* { strapi } */) {},
};
