// Copyright (c) 2025, Antoine Duval
// This file is part of a source-visible project.
// See LICENSE for terms. Unauthorized use is prohibited.

//#region Imports

const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits,
} = require("discord.js"); // This library allows communication with the Discord API.

//#endregion

/**
 * This class aims to upload screenshots of weapons in all languages.
 */
class Discord {
  constructor(devMode) {
    this._devMode = devMode;
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
    });
  }

  //#region GETTERS

  /**
   * This function returns the list of servers that use the bot.
   * @returns List of servers that use the bot.
   */
  getServers() {
    return Array.from(this.client.guilds.cache).map((server) => server[1]);
  }

  /**
   * This function returns the list of rooms on a server.
   * @param {*} server - Server to analyze.
   * @returns List of rooms on a server.
   */
  getServerChannels(server) {
    if (!server) {
      console.error(
        "Error: Unable to retrieve channels. Server parameter is null or undefined."
      );
      return [];
    }

    try {
      const BOT_MEMBER = server.members.cache.get(this.client.user.id);
      if (!BOT_MEMBER) {
        console.error(`Error: Bot is not a member of server "${server.name}"`);
        return [];
      }

      // Filter channels where bot can view
      return Array.from(server.channels.cache)
        .map((channel) => channel[1])
        .filter((channel) => {
          return (
            channel
              .permissionsFor(BOT_MEMBER)
              ?.has(PermissionFlagsBits.ViewChannel) ?? false
          );
        });
    } catch (e) {
      console.error(
        `Error: Unable to retrieve channels from server "${server.name}".`,
        e
      );
      return [];
    }
  }

  /**
   * This function returns the old messages from a chat room.
   * @param {*} channel - Trade show to analyze.
   * @param {*} limit - Maximum number of messages to retrieve.
   * @returns List of messages from the chat room.
   */
  async getOldMessages(channel, limit = 100) {
    console.log(`                Trying to get old messages...`);

    // Validate channel parameter
    if (!channel) {
      console.error(
        "        Error: Unable to get messages. Channel parameter is null or undefined."
      );
      return [];
    }

    const ALL_MESSAGES = [];
    try {
      const PERMISSIONS = channel.permissionsFor(this.client.user);
      if (!PERMISSIONS) {
        console.error(
          `        Error: Unable to check permissions in channel: ${
            channel.name || channel.id
          }`
        );
        return [];
      }

      if (!PERMISSIONS.has(PermissionFlagsBits.ViewChannel)) {
        console.error(
          `        Error: Bot lacks ViewChannel permission in channel: ${
            channel.name || channel.id
          }`
        );
        return [];
      }

      if (!PERMISSIONS.has(PermissionFlagsBits.ReadMessageHistory)) {
        console.error(
          `        Error: Bot lacks ReadMessageHistory permission in channel: ${
            channel.name || channel.id
          }`
        );
        return [];
      }

      let lastMessageId = null;
      let remaining = limit;

      while (remaining > 0) {
        const FETCH_LIMIT = Math.min(remaining, 100); // Maximum 100 per request.
        const OPTIONS = { limit: FETCH_LIMIT };

        if (lastMessageId) {
          OPTIONS.before = lastMessageId;
        }

        const MESSAGES = await channel.messages.fetch(OPTIONS);

        if (MESSAGES.size === 0) {
          break; // More messages available.
        }

        const MESSAGES_ARRAY = Array.from(MESSAGES.values());
        ALL_MESSAGES.push(...MESSAGES_ARRAY);

        lastMessageId = MESSAGES_ARRAY[MESSAGES_ARRAY.length - 1].id;
        remaining -= MESSAGES.size;
      }
    } catch (e) {
      console.error(
        `        Unable to access messages (Channel: "${channel.name}").`,
        e
      );
    }

    console.log(`                Got old messages (${ALL_MESSAGES.length})`);
    return ALL_MESSAGES;
  }

  /**
   * This function returns the server to which the room belongs.
   * @param {*} channel - Channel.
   * @returns Server who owns the chat room.
   */
  _getChannelServer(channel) {
    if (!channel) {
      console.error(
        "Error: Unable to retrieve server. Channel parameter is null or undefined."
      );
      return null;
    }

    try {
      return this.client.guilds.cache.get(channel.guild.id) || null;
    } catch (e) {
      console.error(
        `Error: Unable to retrieve server for channel "${
          channel.name || channel.id
        }".`,
        e
      );
      return null;
    }
  }

  /**
   * Check the bot's permissions on a given channel against the ones required by the bot.
   * @param {*} channel - Channel to inspect.
   * @returns Array of { name, granted } entries, one per required permission.
   */
  getBotChannelPermissions(channel) {
    const REQUIRED_PERMISSIONS = [
      { name: "View Channel", flag: PermissionFlagsBits.ViewChannel },
      { name: "Send Messages", flag: PermissionFlagsBits.SendMessages },
      {
        name: "Read Message History",
        flag: PermissionFlagsBits.ReadMessageHistory,
      },
      { name: "Attach Files", flag: PermissionFlagsBits.AttachFiles },
      { name: "Embed Links", flag: PermissionFlagsBits.EmbedLinks },
      { name: "Manage Messages", flag: PermissionFlagsBits.ManageMessages },
    ];

    const PERMISSIONS = channel?.permissionsFor(this.client.user) ?? null;
    return REQUIRED_PERMISSIONS.map((permission) => ({
      name: permission.name,
      granted: PERMISSIONS?.has(permission.flag) ?? false,
    }));
  }

  //#endregion

  //#region SEND MESSAGES

  dateFormat(date) {
    const DATE = new Date(date);
    return (
      ("0" + DATE.getDate()).slice(-2) +
      "/" +
      ("0" + (DATE.getMonth() + 1)).slice(-2) +
      "/" +
      DATE.getFullYear() +
      " " +
      ("0" + DATE.getHours()).slice(-2) +
      ":" +
      ("0" + DATE.getMinutes()).slice(-2)
    );
  }

  async sendImageToTmpServer(channel, weaponName, weaponDate, imagePath) {
    const DATE_STRING = this.dateFormat(weaponDate);
    const MESSAGE = weaponName + "\n" + DATE_STRING;
    const NEW_MESSAGE = await this.sendMessage(
      channel,
      MESSAGE,
      undefined,
      imagePath
    );
    if (NEW_MESSAGE) {
      return NEW_MESSAGE.attachments.first().proxyURL;
    }
    return undefined;
  }

  /**
   * This function allows you to send a message in a chat room.
   * @param {*} channel - Message room where you can send your message.
   * @param {*} content - Content of the message to be sent in the chat room.
   * @param {*} embed - Embed linked to the message to be sent in the chat room.
   * @param {*} file - (Optional) File linked to the message to be sent in the chat room.
   * @param {Object} interaction - (Optional) The Discord message that the application received.
   */
  async sendMessage(channel, content, embed, file, interaction) {
    if (!channel) {
      console.error(
        "        Error: Unable to send message. Channel parameter is null or undefined."
      );
      return undefined;
    }

    let message = undefined;
    try {
      const PERMISSIONS = channel.permissionsFor(this.client.user);

      if (!PERMISSIONS) {
        console.error(
          `        Error: Unable to check permissions in channel: ${
            channel.name || channel.id
          }`
        );
        return undefined;
      }

      if (!PERMISSIONS.has(PermissionFlagsBits.SendMessages)) {
        const CHANNEL_NAME = channel.name || channel.id || "Unknown";
        console.error(
          `        Error: Bot lacks SendMessages permission in channel: ${CHANNEL_NAME}`
        );
        if (interaction) {
          interaction.followUp({
            content: `Error: Permission "Send Messages" is missing in channel "${CHANNEL_NAME}"!`,
            flags: 64, // MessageFlags.Ephemeral.
          });
        }
        return undefined;
      }

      if (file && !PERMISSIONS.has(PermissionFlagsBits.AttachFiles)) {
        const CHANNEL_NAME = channel.name || channel.id || "Unknown";
        console.error(
          `        Error: Bot lacks AttachFiles permission in channel: ${CHANNEL_NAME}`
        );
        if (interaction) {
          interaction.followUp({
            content: `Error: Permission "Attach Files" is missing in channel "${CHANNEL_NAME}"!`,
            flags: 64, // MessageFlags.Ephemeral.
          });
        }
        return undefined;
      }

      message = await channel.send({
        content: content,
        embeds: embed ? [embed] : undefined,
        files: file ? [file] : undefined,
      });
    } catch (e) {
      const SERVER = this._getChannelServer(channel);
      const SERVER_NAME = SERVER?.name || "Unknown";
      const CHANNEL_NAME = channel.name || channel.id || "Unknown";

      console.error(
        `        Error: Unable to send message in channel "${CHANNEL_NAME}" (Server: "${SERVER_NAME}").`,
        e
      );
    }
    return message;
  }

  //#endregion

  /**
   * Delete a Discord message.
   * @param {Object} message - The Discord message object to delete.
   * @param {Function} [callback] - Optional callback function to execute with success/failure status.
   */
  async deleteMessage(message, callback) {
    if (!message) {
      console.error(
        "Error: Unable to delete message. Message parameter is null or undefined."
      );
      if (callback) {
        callback(false);
      }
      return;
    }

    try {
      const CHANNEL = message.channel;
      if (CHANNEL) {
        const permissions = CHANNEL.permissionsFor(this.client.user);

        if (!permissions) {
          console.error(
            `Error: Unable to check permissions for message deletion in channel: ${
              CHANNEL.name || CHANNEL.id
            }`
          );
          if (callback) {
            callback(false);
          }
          return;
        }

        const isOwnMessage = message.author?.id === this.client.user.id;
        if (
          !isOwnMessage &&
          !permissions.has(PermissionFlagsBits.ManageMessages)
        ) {
          console.error(
            `Error: Bot lacks ManageMessages permission in channel: ${
              CHANNEL.name || CHANNEL.id
            }`
          );
          if (callback) {
            callback(false);
          }
          return;
        }
      }

      await message.delete();
      if (callback) {
        callback(true);
      }
    } catch (e) {
      const CHANNEL = message.channel;
      const SERVER = CHANNEL?.guild;

      const SERVER_NAME = SERVER?.name || "Unknown";
      const CHANNEL_NAME = CHANNEL?.name || CHANNEL?.id || "Unknown";

      console.error(
        `        Unable to delete the message (Server: "${SERVER_NAME}", channel: "${CHANNEL_NAME}").`,
        e
      );
      if (callback) {
        callback(false);
      }
    }
  }

  /**
   * Delete old dev messages that don't match the current date.
   * @param {Array} oldMessages - Array of old Discord messages to filter through.
   * @param {string} weaponName - The name of the weapon.
   * @param {string} weaponDate - The date of the weapon.
   * @returns {Promise<boolean>} Returns true if a new message can be created, false otherwise.
   */
  async deleteDevMessage(oldMessages, weaponName, weaponDate) {
    const A_WEAPON_OLD_MESSAGES = oldMessages.filter((message) =>
      message.content.startsWith(weaponName + "\n")
    );
    const FORMATED_DATE = this.dateFormat(weaponDate);
    if (A_WEAPON_OLD_MESSAGES.length == 0) {
      return true;
    }
    const A_WEAPON_OLD_MESSAGE = A_WEAPON_OLD_MESSAGES.find((message) =>
      message.content.endsWith("\n" + FORMATED_DATE)
    );
    let canCreate = !A_WEAPON_OLD_MESSAGE || A_WEAPON_OLD_MESSAGE.length == 0;
    for (let message of A_WEAPON_OLD_MESSAGES) {
      if (!message.content.endsWith("\n" + FORMATED_DATE)) {
        await this.deleteMessage(message);
      }
    }
    return canCreate;
  }

  /**
   * Create a new Discord channel in a server.
   * @param {Object} interaction - The Discord message that the application received.
   * @param {string} name - The name of the channel to create.
   * @param {string} topic - The topic/description of the channel.
   * @param {Function} [callback] - Optional callback function to execute with the created channel.
   */
  async createChannel(interaction, name, topic, callback) {
    try {
      const BOT_MEMBER = interaction.guild.members.cache.get(
        this.client.user.id
      );

      if (!BOT_MEMBER) {
        console.error(
          `Error: Bot is not a member of server: ${
            interaction.guild.name || interaction.guild.id
          }`
        );
        if (callback) {
          callback(null);
        }
        return;
      }

      if (!BOT_MEMBER.permissions.has(PermissionFlagsBits.ManageChannels)) {
        const SERVER_NAME =
          interaction.guild?.name || interaction.guild?.id || "Unknown";
        console.error(
          `Error: Bot lacks ManageChannels permission in server: ${SERVER_NAME}`
        );
        interaction.followUp({
          content: `Error: Permission "Manage Channels" is missing in server ${SERVER_NAME}!`,
          flags: 64, // MessageFlags.Ephemeral.
        });
        if (callback) {
          callback(null);
        }
        return;
      }

      const CHANNEL = await interaction.guild.channels.create({
        name: name,
        topic: topic,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: this.client.user.id, // Bot permissions
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
            ],
          },
          {
            id: interaction.guild.roles.everyone.id, // @everyone
            deny: [
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.CreatePublicThreads,
              PermissionFlagsBits.CreatePrivateThreads,
              PermissionFlagsBits.SendMessagesInThreads,
            ],
          },
        ],
      });
      if (callback) {
        callback(CHANNEL);
      }
    } catch (e) {
      const SERVER_NAME =
        interaction.guild?.name || interaction.guild?.id || "Unknown";
      console.error(
        `        Unable to create the room on the server "${SERVER_NAME}".`,
        e
      );
      if (callback) {
        callback(null);
      }
    }
  }

  /**
   * This function allows for waiting.
   * @param {*} time - Time in milliseconds.
   */
  async _delay(time) {
    return new Promise(function (resolve) {
      setTimeout(resolve, time);
    });
  }
}

module.exports = Discord;
