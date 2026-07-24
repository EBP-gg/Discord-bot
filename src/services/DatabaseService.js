// Copyright (c) 2025, Antoine Duval
// This file is part of a source-visible project.
// See LICENSE for terms. Unauthorized use is prohibited.

//#region Imports

const SQL_LITE = require("sqlite3").verbose();
const AXIOS = require("axios");

//#endregion

/**
 * Generalized database service for managing different types of content.
 */
class DatabaseService {
  constructor(apiURL) {
    // Base of the EBP REST API (e.g. "https://ebp.gg/api"). Each content type is
    // served at `{apiURL}/{contentType}/discord`.
    this._apiURL = apiURL;

    this.db = new SQL_LITE.Database("./data/database.db");

    this._initializeTables();
  }

  /**
   * Initializes the database tables.
   */
  _initializeTables() {
    this.db.serialize(() => {
      // General table for all content types.
      this.db.run(`CREATE TABLE IF NOT EXISTS content_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        date TEXT NOT NULL,
        UNIQUE(type, name)
      )`);

      // Table for related images.
      this.db.run(`CREATE TABLE IF NOT EXISTS content_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        language TEXT NOT NULL,
        url TEXT NOT NULL,
        UNIQUE(type, name, language)
      )`);
    });
  }

  //#region Content Items

  /**
   * Insert a new piece of content.
   * @param {string} type - The type of content item.
   * @param {string} name - The name of the content item.
   * @param {string} date - The date of the content item.
   * @param {Function} callback - Callback function to execute after insertion.
   */
  _insertContentItem(type, name, date, callback) {
    this.db.run(
      `INSERT OR REPLACE INTO content_items (type, name, date) VALUES (?, ?, ?)`,
      [type, name, date],
      function (err) {
        if (err) {
          console.error(err);
        }
        callback();
      }
    );
  }

  /**
   * Select a content item.
   * @param {string} type - The type of content item.
   * @param {string} name - The name of the content item.
   * @param {Function} callback - Callback function to execute with the result.
   */
  _selectContentItem(type, name, callback) {
    this.db.all(
      `SELECT * FROM content_items WHERE type = ? AND name = ? LIMIT 1`,
      [type, name],
      function (err, rows) {
        if (err) {
          console.error(err);
          callback(undefined);
        } else {
          callback(rows && rows.length === 1 ? rows[0] : undefined);
        }
      }
    );
  }

  /**
   * Updates or inserts a content item.
   * @param {string} type - The type of content item.
   * @param {string} name - The name of the content item.
   * @param {string} date - The date of the content item.
   * @param {Function} callback - Callback function to execute after operation.
   */
  _setContentItem(type, name, date, callback) {
    this._selectContentItem(type, name, (existing) => {
      if (existing) {
        this.db.run(
          `UPDATE content_items SET date = ? WHERE type = ? AND name = ?`,
          [date, type, name],
          function (err) {
            if (err) {
              console.error(err);
            }
            callback();
          }
        );
      } else {
        this._insertContentItem(type, name, date, callback);
      }
    });
  }

  /**
   * Retrieves new items from the API.
   * @param {string} contentType - The type of content to fetch.
   * @param {Function} callback - Callback function to execute with the fetched items.
   */
  async fetchNewContent(contentType, callback) {
    let done = 0;
    try {
      const RESPONSE = await AXIOS.get(
        this._apiURL + "/" + contentType + "/discord"
      );
      const ITEMS = RESPONSE.data;

      if (!ITEMS || ITEMS.length === 0) {
        callback([]);
        return;
      }

      for (let ITEM of ITEMS) {
        this._setContentItem(contentType, ITEM.name, ITEM.date, () => {
          this._selectContentItem(contentType, ITEM.name, () => {
            done++;
            if (ITEMS.length === done) {
              callback(ITEMS);
            }
          });
        });
      }
    } catch (error) {
      console.error(`Error fetching ${contentType} from API:`, error);
      callback([]);
    }
  }

  //#endregion

  //#region Images

  /**
   * Insert a new image.
   * @param {string} type - The type of content.
   * @param {string} name - The name of the content.
   * @param {string} language - The language of the image.
   * @param {string} url - The URL of the image.
   * @returns {Promise} Promise that resolves when insertion is complete.
   */
  async _insertImage(type, name, language, url) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO content_images (type, name, language, url) VALUES (?, ?, ?, ?)`,
        [type, name, language, url],
        function (err) {
          if (err) {
            console.error(err);
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  /**
   * Select an image.
   * @param {string} name - The name of the content.
   * @param {string} language - The language of the image.
   * @param {string} [type="weapons"] - The type of content (default: "weapons").
   * @returns {Promise} Promise that resolves with the image data or undefined.
   */
  async selectImage(name, language, type = "weapons") {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM content_images WHERE type = ? AND name = ? AND language = ? LIMIT 1`,
        [type, name, language],
        (err, rows) => {
          if (err) {
            console.error(err);
            reject(err);
          } else {
            resolve(rows && rows.length === 1 ? rows[0] : undefined);
          }
        }
      );
    });
  }

  /**
   * Updates or inserts an image.
   * @param {string} name - The name of the content.
   * @param {string} language - The language of the image.
   * @param {string} url - The URL of the image.
   * @param {string} [type="weapons"] - The type of content (default: "weapons").
   */
  async setImage(name, language, url, type = "weapons") {
    try {
      await this._insertImage(type, name, language, url);
    } catch (error) {
      console.error(`Error setting image for ${type}:`, error);
    }
  }

  //#endregion
}

module.exports = DatabaseService;
