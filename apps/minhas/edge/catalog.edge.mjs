// Loads the data files of one day into a database: the price list, the invoices, the labels and the records.
import { readFileSync } from "node:fs";
import { assignSkus, expandInvoices, expandLabels, expandPriceList, uniqueById } from "../src/catalog.mjs";
import { insertRows, openDatabase, runSql } from "./sqlite.edge.mjs";
/** @import { DatabaseSync } from "node:sqlite" */

/**
 * Opens a new database, in a file or in memory, with the tables of sql/schema.sql.
 * @param {string} path
 * @returns {DatabaseSync}
 * @uses runSql, openDatabase
 * @usedby buildDatabase (bin/sqlite.edge.mjs), openLoaded (test/sqlite.test.mjs)
 */
export const createDatabase = (path) => runSql(openDatabase(path), readFileSync("sql/schema.sql", "utf8"));

/**
 * @usedby readDayFiles
 */
const readJson = (folder, name) => JSON.parse(readFileSync(`${folder}/${name}.json`, "utf8"));

/**
 * Reads the six JSON files of one data folder.
 * @param {string} folder
 * @returns {object}
 * @uses readJson
 * @usedby loadDay
 */
export const readDayFiles = (folder) => ({
  pricelist: readJson(folder, "pricelist"),
  invoices: readJson(folder, "invoices"),
  retail: readJson(folder, "retail"),
  vehicles: readJson(folder, "vehicles"),
  shipments: readJson(folder, "shipments"),
  documents: readJson(folder, "documents"),
});

/**
 * Makes the rows of each table from the files of one folder, in the sequence of the references.
 * @param {object} files
 * @returns {object[]}
 * @uses expandPriceList (src/catalog.mjs), expandInvoices (src/catalog.mjs), expandLabels (src/catalog.mjs),
 *   assignSkus (src/catalog.mjs), uniqueById (src/catalog.mjs)
 * @usedby loadDay
 */
export const makeTableRows = (files) => {
  // The three sources give products and prices. The invoices also give the SKUs.
  const list = expandPriceList(files.pricelist);
  const invoices = expandInvoices(files.invoices);
  const labels = expandLabels(files.retail);
  const products = assignSkus(uniqueById([...list.products, ...invoices.products, ...labels.products]), invoices.skus);
  return [
    { table: "vehicles", rows: files.vehicles },
    { table: "shipments", rows: files.shipments },
    { table: "customers", rows: invoices.customers },
    { table: "products", rows: products },
    { table: "documents", rows: files.documents },
    { table: "invoices", rows: invoices.invoices },
    { table: "invoice_lines", rows: invoices.invoiceLines },
    { table: "prices", rows: [...list.prices, ...invoices.prices, ...labels.prices] },
  ];
};

/**
 * Loads the files of one folder into the database. The result is the count of rows for each table.
 * @standard balanced - The lines of each loaded invoice add up to its subtotal, and their deposits to its deposit.
 * @standard linked - Each loaded price and each loaded line points to a product and a document that exist.
 * @param {DatabaseSync} database
 * @param {string} folder
 * @returns {object[]}
 * @uses makeTableRows, readDayFiles, insertRows
 * @usedby buildDatabase (bin/sqlite.edge.mjs), openLoaded (test/sqlite.test.mjs)
 */
export const loadDay = (database, folder) =>
  makeTableRows(readDayFiles(folder)).map((part) => ({
    table: part.table,
    count: insertRows(database, part.table, part.rows),
  }));
