// Copyright (c) 2025, Antoine Duval
// This file is part of a source-visible project.
// See LICENSE for terms. Unauthorized use is prohibited.

//#region Imports

const PATH = require("path");
const FS = require("fs");

//#endregion

/**
 * An abstract base class for managing different types of content (weapons, heroes, modes, etc.)
 */
class ContentManager {
  constructor(discord, database, screenshotService, domain, contentType) {
    if (this.constructor === ContentManager) {
      throw new Error(
        "ContentManager is an abstract class and cannot be instantiated directly."
      );
    }

    this._discord = discord;
    this._database = database;
    this._screenshotService = screenshotService;
    this._domain = domain;
    this._contentType = contentType;
    this._languages = ["en", "fr", "es", "de", "ro", "it", "pt"];

    // Create the screenshots folder for this type of content.
    this.screenshotsFolder = PATH.join(
      __dirname,
      "..",
      "screenshots",
      contentType
    );
    FS.mkdirSync(this.screenshotsFolder, { recursive: true });
  }

  /**
   * Abstract method - Prepare the screenshot URLs for the items.
   * @param {Array} items - List of elements (weapons, heroes, modes, etc.)
   * @param {Object} itemsUrls - Base URLs by language.
   * @returns {Array} List of screenshot URLs to generate.
   */
  prepareUrls(items, itemsUrls) {
    throw new Error("prepareUrls() must be implemented by the child class.");
  }

  /**
   * Abstract method - Formatting the name for the URL.
   * @param {string} name - Item name.
   * @returns {string} Name formatted for the URL.
   */
  formatNameForUrl(name) {
    throw new Error(
      "formatNameForUrl() must be implemented by the child class."
    );
  }

  /**
   * Abstract method - File name formatting.
   * @param {string} language - Language.
   * @param {string} name - Item name.
   * @returns {string} Formatted filename.
   */
  formatNameForFile(language, name) {
    throw new Error(
      "formatNameForFile() must be implemented by the child class."
    );
  }

  /**
   * Download the screenshots for all the items.
   * @param {Array} items - List of items.
   * @param {Object} baseUrls - Base URLs by language.
   * @param {number} width - Image width.
   * @param {number} height - Image height.
   */
  async downloadScreenshots(items, baseUrls, width, height) {
    console.log(`        Downloading ${this._contentType} screenshots...`);

    const URLS = this.prepareUrls(items, baseUrls);
    await this._screenshotService.downloadScreenshots(
      items,
      URLS,
      this._contentType,
      this._discord,
      this._database,
      width,
      height
    );

    console.log(`        ${this._contentType} screenshots downloaded.`);
  }

  /**
   * Retrieves data from the API.
   * @param {Function} callback - Callback function with data.
   */
  async fetchDataFromAPI(callback) {
    throw new Error(
      "fetchDataFromAPI() must be implemented by the child class."
    );
  }

  /**
   * Generates a Discord embed for an item.
   * @param {Object} item - Item (weapon, hero, mode, etc.)
   * @param {string} dateString - Formatted date.
   * @param {string} imageURL - Image URL.
   * @param {string} itemURL - URL of the element.
   * @returns {Object} Embed Discord.
   */
  createEmbed(item, dateString, imageURL, itemURL) {
    throw new Error("createEmbed() must be implemented by the child class.");
  }

  /**
   * Refreshes the content on a Discord server.
   * @param {Object} server - Discord Server.
   * @param {Array} items - List of elements.
   * @param {Object} baseUrls - Base URLs by language.
   * @param {Function} i18nFunction - Translation function.
   * @param {Object} interaction - (Optionnal) The Discord message that the application received.
   */
  async refreshServer(server, items, baseUrls, i18nFunction, interaction) {
    throw new Error("refreshServer() must be implemented by the child class.");
  }

  /**
   * Refreshes the content on a Discord channel
   * @param {Object} channel - Discord channel.
   * @param {Array} items - List of items.
   * @param {Object} baseUrls - Base URLs by language.
   * @param {Function} i18nFunction - Translation function.
   * @param {Object} interaction - The Discord message that the application received.
   * @param {Function} callback - Callback function.
   */
  async refreshChannel(
    channel,
    items,
    baseUrls,
    i18nFunction,
    interaction,
    callback
  ) {
    throw new Error("refreshChannel() must be implemented by the child class.");
  }

  /**
   * Returns the channel tag for this type of content.
   * @returns {string} Channel tag.
   */
  getChannelTag() {
    throw new Error("getChannelTag() must be implemented by the child class.");
  }
}

module.exports = ContentManager;
