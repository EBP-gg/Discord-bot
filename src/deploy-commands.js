// Copyright (c) 2025, Antoine Duval
// This file is part of a source-visible project.
// See LICENSE for terms. Unauthorized use is prohibited.

//#region Attributes

const { REST, Routes } = require("discord.js");
require("dotenv").config();

//#endregion

const COMMANDS = [
  {
    name: "ebp_refresh_server",
    description: "Refresh all information on this server.",
    default_member_permissions: 0x0000000000000008, // ADMINISTRATOR permission
  },
  {
    name: "ebp_refresh_channel",
    description: "Refresh all information on this channel.",
    default_member_permissions: 0x0000000000000008, // ADMINISTRATOR permission
  },
  {
    name: "ebp_check_channel_permissions",
    description: "Check the bot's permissions on the current channel.",
    default_member_permissions: 0x0000000000000008, // ADMINISTRATOR permission
  },
  {
    name: "ebp_create_channel",
    description: "Create a new channel.",
    default_member_permissions: 0x0000000000000008, // ADMINISTRATOR permission
    options: [
      {
        name: "mode",
        description: "Channel type",
        type: 3, // STRING type
        required: true,
        choices: [
          { name: "Weapons", value: "weapons" },
          { name: "Modes", value: "modes" },
          { name: "Maps", value: "maps" },
          { name: "Heroes", value: "heroes" },
        ],
      },
      {
        name: "language",
        description: "Channel language",
        type: 3, // STRING type
        required: true,
        choices: [
          { name: "English", value: "en" },
          { name: "Français", value: "fr" },
          { name: "Español", value: "es" },
          { name: "Deutsch", value: "de" },
          { name: "Română", value: "ro" },
        ],
      },
    ],
  },
  {
    name: "ebp_admin_list",
    description: "List all servers using the bot (EBP admin only).",
    default_member_permissions: 0x0000000000000008, // ADMINISTRATOR permission
  },
  {
    name: "ebp_admin_refresh_server",
    description: "Force refresh a specific server (EBP admin only).",
    default_member_permissions: 0x0000000000000008, // ADMINISTRATOR permission
    options: [
      {
        name: "server_id",
        description: "The ID of the server to refresh",
        type: 3, // STRING type
        required: true,
      },
    ],
  },
  {
    name: "ebp_admin_refresh_channel",
    description: "Force refresh a specific channel (EBP admin only).",
    default_member_permissions: 0x0000000000000008, // ADMINISTRATOR permission
    options: [
      {
        name: "server_id",
        description: "The ID of the server to refresh",
        type: 3, // STRING type
        required: true,
      },
      {
        name: "channel_id",
        description: "The ID of the channel to refresh",
        type: 3, // STRING type
        required: true,
      },
    ],
  },
  {
    name: "ebp_admin_check_channel_permissions",
    description:
      "Check the bot's permissions on a specific channel (EBP admin only).",
    default_member_permissions: 0x0000000000000008, // ADMINISTRATOR permission
    options: [
      {
        name: "server_id",
        description: "The ID of the server containing the channel",
        type: 3, // STRING type
        required: true,
      },
      {
        name: "channel_id",
        description: "The ID of the channel to check",
        type: 3, // STRING type
        required: true,
      },
    ],
  },
  {
    name: "ebp_admin_sync",
    description: "Force synchronization with the API (EBP admin only).",
    default_member_permissions: 0x0000000000000008, // ADMINISTRATOR permission
  },
  {
    name: "ebp_admin_refresh_all",
    description: "Force refresh all Discord servers (EBP admin only).",
    default_member_permissions: 0x0000000000000008, // ADMINISTRATOR permission
  },
  {
    name: "ebp_admin_get_server_owner",
    description: "Get the owner of a Discord server (EBP admin only).",
    default_member_permissions: 0x0000000000000008, // ADMINISTRATOR permission
    options: [
      {
        name: "server_id",
        description: "The ID of the server to check",
        type: 3, // STRING type
        required: true,
      },
    ],
  },
];

const DISCORD_REST = new REST({ version: "10" }).setToken(
  process.env.DISCORD_BOT_TOKEN,
);

// Déploiement global (fonctionne sur tous les serveurs)
(async () => {
  try {
    console.log("Refreshing of slash commands has begun...");

    await DISCORD_REST.put(
      Routes.applicationCommands(process.env.DISCORD_BOT_ID),
      {
        body: COMMANDS,
      },
    );

    console.log("Slash commands successfully reloaded!");
  } catch (error) {
    console.error(error);
  }
})();
