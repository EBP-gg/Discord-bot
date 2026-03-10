// Copyright (c) 2025, Antoine Duval
// This file is part of a source-visible project.
// See LICENSE for terms. Unauthorized use is prohibited.

//#region Imports

const PUPPETEER = require("puppeteer");
const PATH = require("path");
require("dotenv").config();

//#endregion

/**
 * A service for managing screenshots with Puppeteer.
 */
class ScreenshotService {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  /**
   * Initializes the Puppeteer browser.
   * @param {number} width - Image width.
   * @param {number} height - Image height.
   */
  async initBrowser(width, height) {
    if (this.browser) return;

    this.browser = await PUPPETEER.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: "shell",
      defaultViewport: null,
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: width, height: height });
  }

  /**
   * Close the browser.
   */
  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  /**
   * Waiting time.
   * @param {number} time - Time in milliseconds.
   */
  async _delay(time) {
    return new Promise(function (resolve) {
      setTimeout(resolve, time);
    });
  }

  /**
   * Download the screenshots for a list of URLs.
   * @param {Array} items - List of elements (weapons, heroes, etc.)
   * @param {Array} urls - List of [file_path, url] to capture.
   * @param {string} contentType - Content type (weapons, heroes, etc.)
   * @param {Object} discord - Discord Instance.
   * @param {Object} database - Instance Database.
   * @param {number} width - Image width.
   * @param {number} height - Image height.
   */
  async downloadScreenshots(
    items,
    urls,
    contentType,
    discord,
    database,
    width,
    height
  ) {
    const DISCORD_SERVER = discord
      .getServers()
      .find((server) => server.id == process.env.DISCORD_SERVER_ID);

    if (!DISCORD_SERVER) {
      console.error("Discord server not found for screenshots upload");
      return;
    }

    const DISCORD_CHANNEL = discord
      .getServerChannels(DISCORD_SERVER)
      .find((channel) => channel.id == process.env.DISCORD_IMAGE_CHANNEL_ID);

    if (!DISCORD_CHANNEL) {
      console.error("Discord channel not found for screenshots upload");
      return;
    }

    const OLD_DEV_MESSAGES = await discord.getOldMessages(DISCORD_CHANNEL, 400);

    await this.initBrowser(width, height);

    for (let i = 0; i < urls.length; i++) {
      const [filePath, url] = urls[i];

      // Extract information from the filename.
      const FILE_NAME = PATH.basename(filePath, ".png");
      const FILE_INFO = FILE_NAME.split("_");
      const LANGUAGE = FILE_INFO[0].toLowerCase();
      const ITEM_NAME = FILE_INFO.slice(1).join("_");

      // Find the corresponding element.
      const ITEM = items.find(
        (item) => item.name.toUpperCase() === ITEM_NAME.toUpperCase()
      );

      if (!ITEM) {
        console.warn(`Item not found for ${ITEM_NAME}`);
        continue;
      }

      const FORMATTED_DATE = discord.dateFormat(ITEM.date);
      const OLD_DEV_MESSAGE = OLD_DEV_MESSAGES.find(
        (message) => message.content === FILE_NAME + "\n" + FORMATTED_DATE
      );

      // Check if capture is necessary.
      if (
        !OLD_DEV_MESSAGE ||
        (OLD_DEV_MESSAGE &&
          OLD_DEV_MESSAGE.content.split("\n").at(-1) !== FORMATTED_DATE)
      ) {
        console.log(
          `        (${("0" + (i + 1)).slice(-2)}/${("0" + urls.length).slice(
            -2
          )}) Downloading: ${url}`
        );

        // Capture page.
        await this.page.goto(url, { waitUntil: "networkidle2" });
        await this._delay(1000); // As a safety precaution, we wait until the loader has left.
        await this.page.screenshot({
          path: filePath,
          fullPage: false,
        });

        // Manage the upload to Discord.
        if (
          await discord.deleteDevMessage(OLD_DEV_MESSAGES, FILE_NAME, ITEM.date)
        ) {
          const IMAGE_URL = await discord.sendImageToTmpServer(
            DISCORD_CHANNEL,
            FILE_NAME,
            ITEM.date,
            filePath
          );
          await database.setImage(
            ITEM.name.toLowerCase(),
            LANGUAGE,
            IMAGE_URL,
            contentType
          );
        } else {
          const OLD_MESSAGE = OLD_DEV_MESSAGES.find(
            (message) => message.content === FILE_NAME + "\n" + FORMATTED_DATE
          );
          if (OLD_MESSAGE && OLD_MESSAGE.attachments.first()) {
            await database.setImage(
              ITEM.name.toLowerCase(),
              LANGUAGE,
              OLD_MESSAGE.attachments.first().proxyURL,
              contentType
            );
          }
        }
      } else if (
        OLD_DEV_MESSAGE &&
        OLD_DEV_MESSAGE.content.split("\n").at(-1) === FORMATTED_DATE
      ) {
        // Use the existing image.
        if (OLD_DEV_MESSAGE.attachments.first()) {
          await database.setImage(
            ITEM.name.toLowerCase(),
            LANGUAGE,
            OLD_DEV_MESSAGE.attachments.first().proxyURL,
            contentType
          );
        }
      }
    }

    await this.closeBrowser();
  }
}

module.exports = ScreenshotService;
