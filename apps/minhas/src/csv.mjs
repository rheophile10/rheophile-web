const SPECIAL = /[",\r\n]/;

/**
 * @usedby quoteCell
 */
const stringify = (value) => (typeof value === "object" ? JSON.stringify(value) : String(value));

/**
 * Makes the text of one cell. A cell with a comma, a quote or a line break gets quotes.
 * @param {unknown} value
 * @returns {string}
 * @uses stringify, SPECIAL
 * @usedby makeCsv
 */
const quoteCell = (value) => {
  // An empty cell for null. JSON for an object. The text of all other values.
  const text = value === null || value === undefined ? "" : stringify(value);
  // Quotes only when the text has a special character. A quote in the text is doubled.
  return SPECIAL.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

/**
 * Collects the column names of a list of rows, in the sequence of their first use.
 * @param {object[]} rows
 * @returns {string[]}
 * @standard union - A column that only some rows have is in the result one time.
 * @usedby makeCsv
 */
export const collectColumns = (rows) =>
  rows.reduce((columns, row) => [...columns, ...Object.keys(row).filter((name) => !columns.includes(name))], []);

/**
 * Makes the CSV text of a list of rows, with a header line.
 * @param {object[]} rows
 * @returns {string}
 * @standard header - The first line has the column names. A list with no rows gives an empty text.
 * @standard quoting - A cell with a comma, a quote or a line break is in quotes, as RFC 4180 says.
 * @standard empty - A null value and a missing column give an empty cell.
 * @uses collectColumns, quoteCell
 * @usedby makeCsvEntry
 */
export const makeCsv = (rows) => {
  // The columns come from all rows, because a row can have a column that an earlier row does not have.
  const columns = collectColumns(rows);
  // Each line has one cell for each column. The lines end with CRLF, as RFC 4180 says.
  const lines = rows.map((row) => columns.map((name) => quoteCell(row[name])).join(","));
  return rows.length === 0 ? "" : [columns.join(","), ...lines, ""].join("\r\n");
};
