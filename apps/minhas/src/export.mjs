/** @import { ZipEntry } from "../types/results.mjs" */
import { strToU8, zipSync } from "fflate";
import { makeCsv } from "./csv.mjs";

/**
 * Makes the archive entry of one table: a CSV file with the name of the table.
 * @param {string} table
 * @param {object[]} rows
 * @returns {ZipEntry}
 * @uses makeCsv
 * @usedby readTables (edge/export.edge.mjs)
 */
export const makeCsvEntry = (table, rows) => ({ path: `${table}.csv`, bytes: strToU8(makeCsv(rows)) });

/**
 * Makes the archive entry of one photo. The path in the archive keeps the path in the bucket.
 * @param {string} path
 * @param {Uint8Array} bytes
 * @returns {ZipEntry}
 * @usedby readPhotos (edge/export.edge.mjs)
 */
export const makePhotoEntry = (path, bytes) => ({ path: `photos/${path}`, bytes });

/**
 * Makes the bytes of a ZIP archive from a list of entries.
 * @param {ZipEntry[]} entries
 * @returns {Uint8Array}
 * @standard roundtrip - The archive opens with a standard ZIP reader and gives each entry back unchanged.
 * @usedby exportAll (bin/export.edge.mjs), ACTIONS (web/app.edge.mjs)
 */
export const makeArchive = (entries) => zipSync(Object.fromEntries(entries.map((entry) => [entry.path, entry.bytes])));

/**
 * Makes the file name of an export from the date of the export.
 * @param {string} date - A date in the form YYYY-MM-DD, with or without a time after it.
 * @returns {string}
 * @standard dated - The name has the date, in the form YYYY-MM-DD, and no time.
 * @usedby exportAll (bin/export.edge.mjs), ACTIONS (web/app.edge.mjs)
 */
export const nameArchive = (date) => `minhas-export-${date.slice(0, 10)}.zip`;
