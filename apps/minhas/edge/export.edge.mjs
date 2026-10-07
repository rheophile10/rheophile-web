// The reads of the export: each table as a CSV entry, and each photo as an entry.
/** @import { Connection } from "../types/states.mjs" */
/** @import { ZipEntry } from "../types/results.mjs" */
import { makeCsvEntry, makePhotoEntry } from "../src/export.mjs";
import { TABLES } from "../src/tables.mjs";
import { downloadPhoto, readTable } from "./supabase.edge.mjs";

/**
 * @uses TABLES (src/tables.mjs), readTable, makeCsvEntry (src/export.mjs)
 * @usedby readExportEntries
 */
const readTables = (connection) =>
  Promise.all(TABLES.map((table) => readTable(connection, table).then((rows) => makeCsvEntry(table, rows))));

/**
 * @uses readTable, downloadPhoto, makePhotoEntry (src/export.mjs)
 * @usedby readExportEntries
 */
const readPhotos = (connection) =>
  readTable(connection, "photos").then((rows) =>
    Promise.all(rows.map((row) => downloadPhoto(connection, row.path).then((bytes) => makePhotoEntry(row.path, bytes)))),
  );

/**
 * Reads all tables and all photos that the connection permits, as the entries of one archive.
 * @param {Connection} connection
 * @returns {Promise<ZipEntry[]>}
 * @uses readTables, readPhotos
 * @usedby exportAll (bin/export.edge.mjs), ACTIONS (web/app.edge.mjs)
 */
export const readExportEntries = (connection) =>
  Promise.all([readTables(connection), readPhotos(connection)]).then(([tables, photos]) => [...tables, ...photos]);
