// The SQLite database: open, run SQL, insert rows and query rows.
import { DatabaseSync } from "node:sqlite";

/**
 * Opens a database file, or a database in memory with the path ":memory:". The foreign keys are on.
 * @param {string} path
 * @returns {DatabaseSync}
 * @standard keys - A row that points to a parent row that does not exist is refused.
 * @usedby createDatabase
 */
export const openDatabase = (path) => {
  // SQLite checks a foreign key only after this pragma.
  const database = new DatabaseSync(path);
  database.exec("pragma foreign_keys = on");
  return database;
};

/**
 * Runs one or more SQL statements and gives the database back, for a chain.
 * @param {DatabaseSync} database
 * @param {string} sql
 * @returns {DatabaseSync}
 * @usedby createDatabase
 */
export const runSql = (database, sql) => {
  database.exec(sql);
  return database;
};

/**
 * @usedby insertRows
 */
const makeInsert = (table, columns) =>
  `insert into ${table} (${columns.join(", ")}) values (${columns.map(() => "?").join(", ")})`;

/**
 * Inserts rows into a table. The keys of the first row are the columns. A missing value is null.
 * @param {DatabaseSync} database
 * @param {string} table
 * @param {object[]} rows
 * @returns {number}
 * @standard count - The result is the number of rows that the table received.
 * @uses makeInsert
 * @usedby loadDay
 */
export const insertRows = (database, table, rows) => {
  // No rows means nothing to prepare.
  if (rows.length === 0) return 0;
  // One statement serves all rows.
  const columns = Object.keys(rows[0]);
  const statement = database.prepare(makeInsert(table, columns));
  rows.forEach((row) => statement.run(...columns.map((column) => row[column] ?? null)));
  return rows.length;
};

/**
 * Gives the rows of a query as objects.
 * @param {DatabaseSync} database
 * @param {string} sql
 * @returns {object[]}
 */
export const queryRows = (database, sql) => database.prepare(sql).all();
