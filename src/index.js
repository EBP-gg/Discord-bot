// Copyright (c) 2025, Antoine Duval
// This file is part of a source-visible project.
// See LICENSE for terms. Unauthorized use is prohibited.

//#region Imports

const AXIOS = require("axios"); // This library allows me to query the REST API of EBP - EVA Battle Plan.
const PATH = require("path"); // This library allows me to create OS-related access paths.
const HTTP = require("http");
const FS = require("fs");
const Discord = require("./discord");
const DatabaseService = require("./services/DatabaseService");
const ScreenshotService = require("./services/ScreenshotService");

const HeroManager = require("././managers/HeroManager");
const MapManager = require("././managers/MapManager");
const ModeManager = require("././managers/ModeManager");
const WeaponManager = require("././managers/WeaponManager");
const PACKAGE = require("../package.json");

require("dotenv").config();

console.log(`Starting EBP Discord bot v${PACKAGE.version}...`);

//#endregion

//#region Variables

const DEV_MODE = process.argv.slice(2)[0] == "true";
const EBP_DOMAIN = "https://ebp.gg";
const API_URL = EBP_DOMAIN + "/api"; // EBP REST API URL - EVA Battle Plan.

let weapons; // The list of weapons from the API will be stored here.
let weaponsUrls; // The list of URLs for the "Weapons" page will be stored here.

let modes; // The list of modes from the API will be stored here.
let modesUrls; // The list of URLs for the "Modes" page will be stored here.

let maps; // The list of maps from the API will be stored here.
let mapsUrls; // The list of URLs for the "Maps" page will be stored here.

let heroes; // The list of maps from the API will be stored here.
let heroesUrls; // The list of URLs for the "Maps" page will be stored here.

const DISCORD = new Discord(DEV_MODE);
const DATABASE = new DatabaseService(API_URL);
const SCREENSHOT_SERVICE = new ScreenshotService();
const WEAPON_MANAGER = new WeaponManager(
  DISCORD,
  DATABASE,
  SCREENSHOT_SERVICE,
  EBP_DOMAIN,
);
const MODE_MANAGER = new ModeManager(
  DISCORD,
  DATABASE,
  SCREENSHOT_SERVICE,
  EBP_DOMAIN,
);
const MAP_MANAGER = new MapManager(
  DISCORD,
  DATABASE,
  SCREENSHOT_SERVICE,
  EBP_DOMAIN,
);
const HERO_MANAGER = new HeroManager(
  DISCORD,
  DATABASE,
  SCREENSHOT_SERVICE,
  EBP_DOMAIN,
);
const WEB_PORT = DEV_MODE ? 3001 : 3000;
const I18N = JSON.parse(
  FS.readFileSync(PATH.join(__dirname, "..", "i18n.json"), "utf8"),
);
const HEYHEYCHICKEN_DISCORD_ID = "195958479394045952";
const PERMISSIONS_CHECK_DELAY = 1000 * 60 * 2; // Wait 2 minutes after the last channel update.
const PERMISSIONS_CHECK_TIMERS = new Map(); // Pending permission checks, by channel ID.
const PERMISSIONS_MESSAGES_DELAY = 1000 * 10; // Wait 10 seconds between two direct messages.
const SETUP_REMINDER_DELAY = 1000 * 60 * 60 * 24; // Give the owner 24 hours to create a channel before reminding them.
let permissionsCheckRunning = false; // True while all the servers' permissions are being checked.

//#endregion

//#region Web server

/**
 * This web server tells the user if the bot is online.
 + URL : https://discord-bot.ebp.gg/
 */
const SERVER = HTTP.createServer((req, res) => {
  if (req.url === "/") {
    const SVG_PATH = PATH.join(__dirname, "assets/online.svg");

    FS.readFile(SVG_PATH, (err, data) => {
      // If there is a problem loading the image, text is displayed.
      if (err) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("EBP's Discord weapons bot is <b>online</b>.");
        return;
      }
      // An SVG is displayed indicating that the server is online.
      res.writeHead(200, {
        "Content-Type": "image/svg+xml",
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      });
      res.end(data);
    });
  } else {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  }
});

SERVER.listen(WEB_PORT, () => {
  console.log(`HTTP server listening on port "${WEB_PORT}".`);
});

//#endregion

function i18n(path, language) {
  if (!Object.keys(I18N).includes(language)) {
    language = "en";
  }
  return I18N[language][path];
}

function checkDataFromAPI(callback) {
  console.log("Refreshing from API...");
  console.log("    Refreshing weapons...");
  WEAPON_MANAGER.fetchDataFromAPI(async (fetchedWeapons) => {
    weapons = fetchedWeapons;
    await WEAPON_MANAGER.downloadScreenshots(
      fetchedWeapons,
      weaponsUrls,
      1920 * 0.9,
      1080 * 0.9,
    );
    console.log("    Weapons refreshed.");

    console.log("    Refreshing modes...");
    MODE_MANAGER.fetchDataFromAPI(async (fetchedModes) => {
      modes = fetchedModes;
      await MODE_MANAGER.downloadScreenshots(
        fetchedModes,
        modesUrls,
        1200,
        800,
      );
      console.log("    Modes refreshed.");

      console.log("    Refreshing maps...");
      MAP_MANAGER.fetchDataFromAPI(async (fetchedMaps) => {
        maps = fetchedMaps;
        await MAP_MANAGER.downloadScreenshots(fetchedMaps, mapsUrls, 1200, 800);
        console.log("    Maps refreshed.");

        console.log("    Refreshing heroes...");
        HERO_MANAGER.fetchDataFromAPI(async (fetchedHeroes) => {
          heroes = fetchedHeroes;
          await HERO_MANAGER.downloadScreenshots(
            fetchedHeroes,
            heroesUrls,
            1550,
            1300,
          );
          console.log("    Heroes refreshed.");

          if (callback) {
            callback();
          }
        });
      });
    });
  });
}

async function refreshServer(interaction) {
  const SERVER_ID = interaction.options.getString("server_id");

  const SERVER = DISCORD.getServers().find((server) => server.id == SERVER_ID);
  if (SERVER) {
    const CHANNELS = DISCORD.getServerChannels(SERVER).filter(
      (channel) => channel.topic && channel.topic.includes("#EBP_"),
    );
    if (CHANNELS.length > 0) {
      await interaction.followUp({
        content: `Refreshing server "${SERVER.name}"...`,
        flags: 64, // MessageFlags.Ephemeral.
      });

      console.log(`There are ${CHANNELS.length} rooms on this server.`);
      CHANNELS.forEach(async (channel) => {
        const MESSAGES = await DISCORD.getOldMessages(channel);
        for (let message of MESSAGES) {
          await DISCORD.deleteMessage(message);
        }
        WEAPON_MANAGER.refreshServer(SERVER, weapons, weaponsUrls, i18n);
        MODE_MANAGER.refreshServer(SERVER, modes, modesUrls, i18n);
        MAP_MANAGER.refreshServer(SERVER, maps, mapsUrls, i18n);
        HERO_MANAGER.refreshServer(SERVER, heroes, heroesUrls, i18n);

        await interaction.followUp({
          content: `Server "${SERVER.name}" refreshed.`,
          flags: 64, // MessageFlags.Ephemeral.
        });
      });
    } else {
      console.error('There is no "#EBP_" channel in the Discord server.');
      await interaction.followUp({
        content: `Error: No "#EBP_" lobby found on server "${SERVER.name}".`,
        flags: 64, // MessageFlags.Ephemeral.
      });
    }
  } else {
    console.error(`Error: Server ${SERVER_ID} not found.`);
    await interaction.followUp({
      content: `Error: Server ${SERVER_ID} not found.`,
      flags: 64, // MessageFlags.Ephemeral.
    });
  }
}

async function refreshChannel(interaction) {
  const SERVER_ID_TO_REFRESH = interaction.options.getString("server_id");
  const CHANNEL_ID_TO_REFRESH = interaction.options.getString("channel_id");

  const SERVER_TO_REFRESH = DISCORD.getServers().find(
    (server) => server.id == SERVER_ID_TO_REFRESH,
  );
  if (SERVER_TO_REFRESH) {
    const CHANNELS = DISCORD.getServerChannels(SERVER_TO_REFRESH).filter(
      (channel) => channel.id == CHANNEL_ID_TO_REFRESH,
    );
    if (CHANNELS.length == 1) {
      console.log(`There are ${CHANNELS.length} rooms on this server.`);
      const MESSAGES = await DISCORD.getOldMessages(CHANNELS[0]);
      for (let message of MESSAGES) {
        await DISCORD.deleteMessage(message);
      }

      WEAPON_MANAGER.refreshChannel(
        CHANNELS[0],
        weapons,
        weaponsUrls,
        i18n,
        interaction,
        () => {
          MODE_MANAGER.refreshChannel(
            CHANNELS[0],
            modes,
            modesUrls,
            i18n,
            interaction,
            () => {
              MAP_MANAGER.refreshChannel(
                CHANNELS[0],
                maps,
                mapsUrls,
                i18n,
                interaction,
                () => {
                  HERO_MANAGER.refreshChannel(
                    CHANNELS[0],
                    heroes,
                    heroesUrls,
                    i18n,
                    interaction,
                    () => {
                      interaction.followUp({
                        content: "Refreshed!",
                        flags: 64, // MessageFlags.Ephemeral.
                      });
                    },
                  );
                },
              );
            },
          );
        },
      );
    } else {
      console.error('There is no "#EBP_" channel in the Discord server.');
      await interaction.followUp({
        content: `Error: No "#EBP_" lobby found on server "${SERVER_TO_REFRESH.name}".`,
        flags: 64, // MessageFlags.Ephemeral.
      });
    }
  } else {
    console.error(`Error: Server ${SERVER_ID_TO_REFRESH} not found.`);
    await interaction.followUp({
      content: `Error: Server ${SERVER_ID_TO_REFRESH} not found.`,
      flags: 64, // MessageFlags.Ephemeral.
    });
  }
}

async function checkChannelPermissions(interaction) {
  const SERVER_ID = interaction.options.getString("server_id");
  const CHANNEL_ID = interaction.options.getString("channel_id");

  const SERVER = DISCORD.getServers().find((server) => server.id == SERVER_ID);
  if (!SERVER) {
    console.error(`Error: Server ${SERVER_ID} not found.`);
    await interaction.followUp({
      content: `Error: Server ${SERVER_ID} not found.`,
      flags: 64, // MessageFlags.Ephemeral.
    });
    return;
  }

  const CHANNEL = SERVER.channels.cache.get(CHANNEL_ID);
  if (!CHANNEL) {
    console.error(
      `Error: Channel ${CHANNEL_ID} not found on server "${SERVER.name}".`,
    );
    await interaction.followUp({
      content: `Error: Channel ${CHANNEL_ID} not found on server "${SERVER.name}".`,
      flags: 64, // MessageFlags.Ephemeral.
    });
    return;
  }

  const PERMISSIONS = DISCORD.getBotChannelPermissions(CHANNEL);
  const LINES = PERMISSIONS.map(
    (permission) => `${permission.granted ? "🟢" : "🔴"} ${permission.name}`,
  );

  await interaction.followUp({
    content: `Bot permissions on channel "${CHANNEL.name}" (server "${SERVER.name}"):\n${LINES.join("\n")}`,
    flags: 64, // MessageFlags.Ephemeral.
  });
}

/**
 * Returns the language of a channel managed by the bot.
 * @param {*} channel - Channel to analyze.
 * @returns The channel language, or undefined if the channel isn't managed by the bot.
 */
function getBotChannelLanguage(channel) {
  const MATCH = channel?.topic?.match(/#EBP_[A-Z]+_BOT\((\w{2})\)/);
  return MATCH ? MATCH[1].toLowerCase() : undefined;
}

/**
 * Check the bot's permissions on the given channels of a server, and warn the
 * server owner by direct message if at least one permission is missing.
 * @param {*} server - Server to check.
 * @param {Array} channels - Channels to check (channels not managed by the bot are ignored).
 * @returns {Promise<boolean>} True if a direct message has been sent to the server owner.
 */
async function checkServerPermissions(server, channels) {
  if (DEV_MODE && server.name != "EBP - EVA Battle Plan") {
    return false;
  }

  const REPORTS = [];
  for (const CHANNEL of channels) {
    const LANGUAGE = getBotChannelLanguage(CHANNEL);
    if (!LANGUAGE) {
      continue;
    }

    const MISSING_PERMISSIONS = DISCORD.getBotChannelPermissions(CHANNEL)
      .filter((permission) => !permission.granted)
      .map((permission) => `"${permission.name}"`);
    if (MISSING_PERMISSIONS.length > 0) {
      REPORTS.push({
        channel: CHANNEL,
        language: LANGUAGE,
        missingPermissions: MISSING_PERMISSIONS,
      });
    }
  }

  if (REPORTS.length === 0) {
    return false;
  }

  console.log(
    `Missing permissions on "${REPORTS.length}" channel(s) of the server "${server.name}".`,
  );

  const LANGUAGE = REPORTS[0].language;
  const LINES = REPORTS.map(
    (report) =>
      `- ${i18n("missing_permissions_channel", LANGUAGE)
        .replace("{channel}", () => `<#${report.channel.id}>`)
        .replace("{permissions}", () => report.missingPermissions.join(", "))}`,
  );
  return await DISCORD.sendMessageToServerOwner(
    server,
    `${i18n("missing_permissions", LANGUAGE).replace("{server}", () => server.name)}\n${LINES.join("\n")}\n\n${i18n("missing_permissions_fix", LANGUAGE)}`,
  );
}

/**
 * Remind the server owner by direct message how to create a channel, if the bot
 * has been added to the server but doesn't manage any channel there. The
 * reminder is only sent once per server.
 * @param {*} server - Server to check.
 * @returns {Promise<boolean>} True if a direct message has been sent to the server owner.
 */
async function checkServerSetup(server) {
  if (DEV_MODE && server.name != "EBP - EVA Battle Plan") {
    return false;
  }

  // Channels the bot can no longer view must be counted too.
  const HAS_BOT_CHANNEL = Array.from(server.channels.cache.values()).some(
    (channel) => getBotChannelLanguage(channel),
  );
  if (
    HAS_BOT_CHANNEL ||
    Date.now() - server.joinedTimestamp < SETUP_REMINDER_DELAY
  ) {
    return false;
  }

  try {
    if (await DATABASE.hasSetupReminder(server.id)) {
      return false;
    }
  } catch (e) {
    return false;
  }

  console.log(`No channel created on the server "${server.name}".`);

  // The server locale looks like "fr" or "en-US".
  const LANGUAGE = server.preferredLocale?.split("-")[0];
  const SENT = await DISCORD.sendMessageToServerOwner(
    server,
    i18n("setup_reminder", LANGUAGE).replace("{server}", () => server.name),
  );
  if (SENT) {
    try {
      await DATABASE.setSetupReminder(server.id);
    } catch (e) {
      // The error is already logged by the database service.
    }
  }
  return SENT;
}

/**
 * Check the bot's permissions on all the channels it manages, and remind the
 * owners of the servers without any channel how to create one. The servers are
 * checked one by one, with a delay after each direct message, so that the bot
 * doesn't send a burst of direct messages (Discord could flag it as spam).
 * @returns {Promise<number>} Number of direct messages sent, or -1 if a check is already running.
 */
async function checkAllServersPermissions() {
  if (permissionsCheckRunning) {
    console.log("A permissions check is already running.");
    return -1;
  }
  permissionsCheckRunning = true;

  console.log("Checking permissions...");
  let nbMessagesSent = 0;
  try {
    for (const SERVER of DISCORD.getServers()) {
      // Channels the bot can no longer view must be checked too.
      if (
        (await checkServerPermissions(
          SERVER,
          Array.from(SERVER.channels.cache.values()),
        )) ||
        (await checkServerSetup(SERVER))
      ) {
        nbMessagesSent++;
        await DISCORD._delay(PERMISSIONS_MESSAGES_DELAY);
      }
    }
  } finally {
    permissionsCheckRunning = false;
  }
  console.log(
    `Permissions checked ("${nbMessagesSent}" direct message(s) sent).`,
  );
  return nbMessagesSent;
}

/**
 * Main function.
 */
async function loop() {
  console.log("Loop start...");
  checkDataFromAPI(() => {
    // We're looping through the Discord servers using the bot.
    const SERVERS = DISCORD.getServers();
    console.log(`    There are "${SERVERS.length}" servers using this bot.`);
    for (const SERVER of SERVERS) {
      if (!DEV_MODE || (DEV_MODE && SERVER.name == "EBP - EVA Battle Plan")) {
        WEAPON_MANAGER.refreshServer(SERVER, weapons, weaponsUrls, i18n);
        MODE_MANAGER.refreshServer(SERVER, modes, modesUrls, i18n);
        MAP_MANAGER.refreshServer(SERVER, maps, mapsUrls, i18n);
        HERO_MANAGER.refreshServer(SERVER, heroes, heroesUrls, i18n);
      }
    }
    console.log("Loop end.");
  });
}

// Listen to interactions (slash commands)
DISCORD.client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  switch (interaction.commandName) {
    case "ebp_refresh_server":
      // Check administrator permissions.
      if (!interaction.member.permissions.has("ADMINISTRATOR")) {
        await interaction.reply({
          content:
            "You must have administrator permissions to use this command.",
          flags: 64, // MessageFlags.Ephemeral.
        });
        return;
      }

      const SERVER = DISCORD.getServers().find(
        (x) => x.id == interaction.guildId,
      );

      if (SERVER) {
        console.log(
          `"${interaction.user.globalName}" asked for a manual refresh for the: "${SERVER.name}" server.`,
        );

        await interaction.reply({
          content: "Refreshing...",
          flags: 64, // MessageFlags.Ephemeral.
        });

        WEAPON_MANAGER.refreshServer(
          SERVER,
          weapons,
          weaponsUrls,
          i18n,
          interaction,
        );
        MODE_MANAGER.refreshServer(SERVER, modes, modesUrls, i18n, interaction);
        MAP_MANAGER.refreshServer(SERVER, maps, mapsUrls, i18n, interaction);
        HERO_MANAGER.refreshServer(
          SERVER,
          heroes,
          heroesUrls,
          i18n,
          interaction,
        );
      } else {
        await interaction.reply({
          content: "Error: Server not found.",
          flags: 64, // MessageFlags.Ephemeral.
        });
      }
      break;
    case "ebp_create_channel":
      // Check administrator permissions.
      if (!interaction.member.permissions.has("ADMINISTRATOR")) {
        await interaction.reply({
          content:
            "You must have administrator permissions to use this command.",
          flags: 64, // MessageFlags.Ephemeral.
        });
        return;
      }

      await interaction.reply({
        content: "Creating your channel...",
        flags: 64, // MessageFlags.Ephemeral.
      });

      const MODE = interaction.options.getString("mode");
      const LANGUAGE = interaction.options.getString("language");

      let emoji = "";
      switch (MODE) {
        case "weapons":
          emoji = "🔫";
          break;
        case "modes":
          emoji = "🚩";
          break;
        case "maps":
          emoji = "🗺️";
          break;
        case "heroes":
          emoji = "🤖";
          break;
      }

      DISCORD.createChannel(
        interaction,
        `${emoji}${i18n(MODE, LANGUAGE)}`,
        `#EBP_${MODE.toUpperCase()}_BOT(${LANGUAGE})`,
        async (channel) => {
          if (channel) {
            WEAPON_MANAGER.refreshChannel(
              channel,
              weapons,
              weaponsUrls,
              i18n,
              interaction,
              () => {
                MODE_MANAGER.refreshChannel(
                  channel,
                  modes,
                  modesUrls,
                  i18n,
                  interaction,
                  () => {
                    MAP_MANAGER.refreshChannel(
                      channel,
                      maps,
                      mapsUrls,
                      i18n,
                      interaction,
                      () => {
                        HERO_MANAGER.refreshChannel(
                          channel,
                          heroes,
                          heroesUrls,
                          i18n,
                          interaction,
                          () => {
                            interaction.followUp({
                              content: `Your channel has been successfully created : ${channel.name}`,
                              flags: 64, // MessageFlags.Ephemeral.
                            });
                          },
                        );
                      },
                    );
                  },
                );
              },
            );
          }
        },
      );

      break;
    case "ebp_refresh_channel":
      // Check administrator permissions.
      if (!interaction.member.permissions.has("ADMINISTRATOR")) {
        await interaction.reply({
          content:
            "You must have administrator permissions to use this command.",
          flags: 64, // MessageFlags.Ephemeral.
        });
        return;
      }

      console.log(
        `"${interaction.user.globalName}" asked for a manual refresh for the: "${interaction.channel.name}" channel.`,
      );

      await interaction.reply({
        content: "Refreshing...",
        flags: 64, // MessageFlags.Ephemeral.
      });

      WEAPON_MANAGER.refreshChannel(
        interaction.channel,
        weapons,
        weaponsUrls,
        interaction,
        i18n,
        () => {
          MODE_MANAGER.refreshChannel(
            interaction.channel,
            modes,
            modesUrls,
            i18n,
            interaction,
            () => {
              MAP_MANAGER.refreshChannel(
                interaction.channel,
                maps,
                mapsUrls,
                i18n,
                interaction,
                () => {
                  HERO_MANAGER.refreshChannel(
                    interaction.channel,
                    heroes,
                    heroesUrls,
                    i18n,
                    interaction,
                    () => {
                      interaction.followUp({
                        content: "Refreshed!",
                        flags: 64, // MessageFlags.Ephemeral.
                      });
                    },
                  );
                },
              );
            },
          );
        },
      );
      break;
    case "ebp_check_channel_permissions": {
      // Check administrator permissions.
      if (!interaction.member.permissions.has("ADMINISTRATOR")) {
        await interaction.reply({
          content:
            "You must have administrator permissions to use this command.",
          flags: 64, // MessageFlags.Ephemeral.
        });
        return;
      }

      const PERMISSIONS = DISCORD.getBotChannelPermissions(interaction.channel);
      const LINES = PERMISSIONS.map(
        (permission) =>
          `${permission.granted ? "🟢" : "🔴"} ${permission.name}`,
      );

      await interaction.reply({
        content: `Bot permissions on channel "${interaction.channel.name}":\n${LINES.join("\n")}`,
        flags: 64, // MessageFlags.Ephemeral.
      });
      break;
    }
    case "ebp_admin_list":
      // Verify that this is the bot administrator.
      if (interaction.user.id !== HEYHEYCHICKEN_DISCORD_ID) {
        await interaction.reply({
          content:
            "This command is reserved for the bot administrator (HeyHeyChicken).",
          flags: 64, // MessageFlags.Ephemeral.
        });
        return;
      }

      const SERVERS = DISCORD.getServers().map(
        (server) => server.name + " (" + server.id + ")",
      );

      const MAX_LENGTH = 1900; // Safety margin under 2000.
      const CHUNKS = [];
      let currentChunk = "";

      for (const SERVER of SERVERS) {
        const LINE_WITH_NEW_LINE = SERVER + "\n";
        if ((currentChunk + LINE_WITH_NEW_LINE).length > MAX_LENGTH) {
          if (currentChunk) {
            CHUNKS.push(currentChunk);
            currentChunk = LINE_WITH_NEW_LINE;
          } else {
            // If a single server exceeds the limit, it is truncated.
            CHUNKS.push(SERVER.substring(0, MAX_LENGTH - 3) + "...\n");
          }
        } else {
          currentChunk += LINE_WITH_NEW_LINE;
        }
      }
      if (currentChunk) {
        CHUNKS.push(currentChunk);
      }

      // First message with reply.
      await interaction.reply({
        content: `Server List (${SERVERS.length}):\n\`\`\`${CHUNKS[0]}\`\`\``,
        flags: 64, // MessageFlags.Ephemeral.
      });

      // Subsequent messages with follow-up.
      for (let i = 1; i < CHUNKS.length; i++) {
        await interaction.followUp({
          content: `\`\`\`${CHUNKS[i]}\`\`\``,
          flags: 64, // MessageFlags.Ephemeral.
        });
      }
      break;
    case "ebp_admin_refresh_server":
      // Verify that this is the bot administrator.
      if (interaction.user.id !== HEYHEYCHICKEN_DISCORD_ID) {
        await interaction.reply({
          content:
            "This command is reserved for the bot administrator (HeyHeyChicken).",
          flags: 64, // MessageFlags.Ephemeral.
        });
        return;
      } else {
        await interaction.reply({
          content: "Order received.",
          flags: 64, // MessageFlags.Ephemeral.
        });

        refreshServer(interaction);
      }
      break;
    case "ebp_admin_refresh_channel":
      // Verify that this is the bot administrator.
      if (interaction.user.id !== HEYHEYCHICKEN_DISCORD_ID) {
        await interaction.reply({
          content:
            "This command is reserved for the bot administrator (HeyHeyChicken).",
          flags: 64, // MessageFlags.Ephemeral.
        });
        return;
      } else {
        await interaction.reply({
          content: "Order received.",
          flags: 64, // MessageFlags.Ephemeral.
        });

        refreshChannel(interaction);
      }

      break;
    case "ebp_admin_check_permissions":
      // Verify that this is the bot administrator.
      if (interaction.user.id !== HEYHEYCHICKEN_DISCORD_ID) {
        await interaction.reply({
          content:
            "This command is reserved for the bot administrator (HeyHeyChicken).",
          flags: 64, // MessageFlags.Ephemeral.
        });
        return;
      } else {
        await interaction.reply({
          content: "Checking channel permissions...",
          flags: 64, // MessageFlags.Ephemeral.
        });

        checkChannelPermissions(interaction);
      }

      break;
    case "ebp_admin_check_all_permissions":
      // Verify that this is the bot administrator.
      if (interaction.user.id !== HEYHEYCHICKEN_DISCORD_ID) {
        await interaction.reply({
          content:
            "This command is reserved for the bot administrator (HeyHeyChicken).",
          flags: 64, // MessageFlags.Ephemeral.
        });
        return;
      } else {
        await interaction.reply({
          content: "Checking the permissions of all servers...",
          flags: 64, // MessageFlags.Ephemeral.
        });

        const NB_MESSAGES_SENT = await checkAllServersPermissions();
        try {
          await interaction.followUp({
            content:
              NB_MESSAGES_SENT < 0
                ? "A permissions check is already running."
                : `Permissions checked ("${NB_MESSAGES_SENT}" direct message(s) sent to server owners).`,
            flags: 64, // MessageFlags.Ephemeral.
          });
        } catch (e) {
          // The interaction expires after 15 minutes, the result is still in the logs.
          console.error("Unable to send the permissions check result.", e);
        }
      }
      break;
    case "ebp_admin_sync":
      // Verify that this is the bot administrator.
      if (interaction.user.id !== HEYHEYCHICKEN_DISCORD_ID) {
        await interaction.reply({
          content:
            "This command is reserved for the bot administrator (HeyHeyChicken).",
          flags: 64, // MessageFlags.Ephemeral.
        });
        return;
      }

      await interaction.reply({
        content: "Synchronizing with the API...",
        flags: 64, // MessageFlags.Ephemeral.
      });

      checkDataFromAPI(() => {
        interaction.followUp({
          content: "Synchronization with the API complete.",
          flags: 64, // MessageFlags.Ephemeral.
        });
      });
      break;
    case "ebp_admin_refresh_all":
      // Verify that this is the bot administrator.
      if (interaction.user.id !== HEYHEYCHICKEN_DISCORD_ID) {
        await interaction.reply({
          content:
            "This command is reserved for the bot administrator (HeyHeyChicken).",
          flags: 64, // MessageFlags.Ephemeral.
        });
        return;
      }

      await interaction.reply({
        content: "Rafraîchissement de tous les serveurs Discord en cours...",
        flags: 64, // MessageFlags.Ephemeral.
      });

      loop();
      break;
    case "ebp_admin_get_server_owner":
      // Verify that this is the bot administrator.
      if (interaction.user.id !== HEYHEYCHICKEN_DISCORD_ID) {
        await interaction.reply({
          content:
            "This command is reserved for the bot administrator (HeyHeyChicken).",
          flags: 64, // MessageFlags.Ephemeral.
        });
        return;
      }

      const TARGET_SERVER_ID = interaction.options.getString("server_id");
      const TARGET_SERVER = DISCORD.getServers().find(
        (server) => server.id == TARGET_SERVER_ID,
      );

      if (TARGET_SERVER) {
        try {
          const OWNER = await TARGET_SERVER.fetchOwner();

          await interaction.reply({
            content: `The owner of the server "${TARGET_SERVER.name}" is: **[${OWNER.user.username}](https://discordapp.com/users/${OWNER.user.id})**.`,
            flags: 64 | 4, // MessageFlags.Ephemeral + SuppressEmbeds.
          });
        } catch (error) {
          console.error("Error retrieving server owner:", error);
          await interaction.reply({
            content: `Error retrieving server owner ${TARGET_SERVER_ID}.`,
            flags: 64, // MessageFlags.Ephemeral.
          });
        }
      } else {
        await interaction.reply({
          content: `Error: Server ${TARGET_SERVER_ID} not found.`,
          flags: 64, // MessageFlags.Ephemeral.
        });
      }
      break;
  }
});

// Check the bot's permissions when a channel it manages is updated (permissions,
// category, sync...). The check is delayed so that several updates in a row
// only trigger one check.
DISCORD.client.on("channelUpdate", (oldChannel, newChannel) => {
  if (!newChannel.guild || !getBotChannelLanguage(newChannel)) {
    return;
  }

  clearTimeout(PERMISSIONS_CHECK_TIMERS.get(newChannel.id));
  PERMISSIONS_CHECK_TIMERS.set(
    newChannel.id,
    setTimeout(() => {
      PERMISSIONS_CHECK_TIMERS.delete(newChannel.id);
      const CHANNEL = newChannel.guild.channels.cache.get(newChannel.id);
      if (CHANNEL) {
        checkServerPermissions(CHANNEL.guild, [CHANNEL]);
      }
    }, PERMISSIONS_CHECK_DELAY),
  );
});

DISCORD.client.once("clientReady", async () => {
  console.log(
    `Node.JS is connected to the bot: ${DISCORD.client.user.username}.`,
  );

  // We retrieve the URLs of the weapons.
  AXIOS.get(API_URL + "/weapons/discord-urls").then((response2) => {
    weaponsUrls = response2.data;

    // We retrieve the URLs of the modes.
    AXIOS.get(API_URL + "/modes/discord-urls").then((response3) => {
      modesUrls = response3.data;

      // We retrieve the URLs of the maps.
      AXIOS.get(API_URL + "/maps/discord-urls").then((response4) => {
        mapsUrls = response4.data;

        // We retrieve the URLs of the heroes.
        AXIOS.get(API_URL + "/heroes/discord-urls").then((response5) => {
          heroesUrls = response5.data;

          setInterval(
            () => {
              loop();
            },
            1000 * 60 * 60 * 24,
          ); // The script will run every 24 hours.
          setInterval(
            () => {
              checkAllServersPermissions();
            },
            1000 * 60 * 60 * 24 * 7,
          ); // The permissions will be checked every week.
          checkDataFromAPI();
        });
      });
    });
  });
});

DISCORD.client.login(process.env.DISCORD_BOT_TOKEN);
