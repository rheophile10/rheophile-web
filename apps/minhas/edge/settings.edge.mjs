// The settings of the command-line tools. A .env file in the project folder fills the environment.
import { existsSync } from "node:fs";

/**
 * Reads the .env file of the project into the environment, if the file exists. A set variable keeps its value.
 * @param {string} path - The path of the .env file.
 * @returns {void}
 * @usedby bin/export.edge.mjs, bin/settings.edge.mjs
 */
export const loadSettings = (path) => (existsSync(path) ? process.loadEnvFile(path) : undefined);

/**
 * Reads one setting from the environment. A missing setting gives an empty text.
 * @param {string} name
 * @returns {string}
 * @usedby connect (bin/export.edge.mjs), text (bin/settings.edge.mjs), dart (bin/settings.edge.mjs)
 */
export const readSetting = (name) => process.env[name] ?? "";
