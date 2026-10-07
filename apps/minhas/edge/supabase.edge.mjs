// The HTTP calls to a Supabase project: sign-in, table reads and writes, and photo downloads.
/** @import { Connection } from "../types/states.mjs" */

const BUCKET = "photos";

/**
 * @usedby requestToken, readRows, writeRow, downloadPhoto, callFunction
 */
const headersOf = (connection, prefer = "return=representation") => ({
  apikey: connection.key,
  Authorization: `Bearer ${connection.token}`,
  "Content-Type": "application/json",
  Prefer: prefer,
});

/**
 * @usedby readJson, readBytes
 */
const rejectResponse = (response) =>
  response.text().then((text) => {
    throw new Error(`${response.status} from ${response.url}: ${text}`);
  });

/**
 * @uses rejectResponse
 * @usedby requestToken, readRows, writeRow, uploadPhoto, callFunction
 */
const readJson = (response) => (response.ok ? response.json() : rejectResponse(response));

/**
 * @uses rejectResponse
 * @usedby downloadPhoto
 */
const readBytes = (response) => (response.ok ? response.bytes() : rejectResponse(response));

/**
 * @usedby requestToken
 */
const sessionOf = (connection, session) => ({
  ...connection,
  token: session.access_token,
  refreshToken: session.refresh_token,
  userId: session.user.id,
});

/**
 * @uses headersOf, readJson, sessionOf
 * @usedby signIn, refreshSession
 */
const requestToken = (connection, grant, body) =>
  fetch(`${connection.url}/auth/v1/token?grant_type=${grant}`, {
    method: "POST",
    headers: headersOf(connection),
    body: JSON.stringify(body),
  })
    .then(readJson)
    .then((session) => sessionOf(connection, session));

/**
 * Makes a connection that uses the key as its token. With the secret key, the policies do not apply.
 * @param {string} url
 * @param {string} key
 * @returns {Connection}
 * @usedby connect (bin/export.edge.mjs), signInAsDriver (test/supabase.test.mjs), baseConnection (web/app.edge.mjs)
 */
export const openConnection = (url, key) => ({ url, key, token: key, refreshToken: "", userId: "" });

/**
 * Signs in with an email and a password. The result uses the session token of the user.
 * @param {Connection} connection
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Connection>}
 * @uses requestToken
 * @usedby connect (bin/export.edge.mjs), signInAsDriver (test/supabase.test.mjs), ACTIONS (web/app.edge.mjs)
 */
export const signIn = (connection, email, password) => requestToken(connection, "password", { email, password });

/**
 * Makes a new session from a refresh token, for example after the page loads again.
 * @param {Connection} connection
 * @param {string} refreshToken
 * @returns {Promise<Connection>}
 * @uses requestToken
 * @usedby start (web/app.edge.mjs)
 */
export const refreshSession = (connection, refreshToken) =>
  requestToken(connection, "refresh_token", { refresh_token: refreshToken });

/**
 * Reads the rows of a table that the policies permit and that agree with a filter.
 * @param {Connection} connection
 * @param {string} table
 * @param {string} filter - A PostgREST filter, for example "day_id=eq.<id>". An empty text gives all rows.
 * @returns {Promise<object[]>}
 * @uses headersOf, readJson
 * @usedby readTable, loadUser (web/app.edge.mjs), loadChildren (web/app.edge.mjs), loadDayRows (web/app.edge.mjs),
 *   loadDayParts (web/app.edge.mjs), loadPage (web/app.edge.mjs), makeVehicleLog (web/app.edge.mjs)
 */
export const readRows = (connection, table, filter) => {
  // The rows come in the sequence of their creation. An empty filter adds nothing.
  const query = ["select=*", "order=created_at", filter].filter((part) => part !== "").join("&");
  return fetch(`${connection.url}/rest/v1/${table}?${query}`, { headers: headersOf(connection) }).then(readJson);
};

/**
 * Reads all rows of a table that the policies permit, in the sequence of their creation.
 * @param {Connection} connection
 * @param {string} table
 * @returns {Promise<object[]>}
 * @standard isolation - A user gets only the rows of the company of the user.
 * @uses readRows
 * @usedby readTables, readPhotos
 */
export const readTable = (connection, table) => readRows(connection, table, "");

/**
 * @uses headersOf, readJson
 * @usedby insertRow, saveRow, updateRow
 */
const writeRow = (connection, request, row) =>
  fetch(`${connection.url}/rest/v1/${request.path}`, {
    method: request.method,
    headers: headersOf(connection, request.prefer),
    body: JSON.stringify(row),
  })
    .then(readJson)
    .then((rows) => rows[0]);

/**
 * Inserts one row and gives the row back with its id.
 * @param {Connection} connection
 * @param {string} table
 * @param {object} row
 * @returns {Promise<object>}
 * @uses writeRow
 * @usedby addPhoto (web/app.edge.mjs), ACTIONS (web/app.edge.mjs)
 */
export const insertRow = (connection, table, row) =>
  writeRow(connection, { path: table, method: "POST", prefer: "return=representation" }, row);

/**
 * Inserts one row, or updates the row that has the same unique key.
 * @param {Connection} connection
 * @param {{ table: string, conflict: string }} target - The table and the columns of its unique key.
 * @param {object} row
 * @returns {Promise<object>}
 * @uses writeRow
 * @usedby ACTIONS (web/app.edge.mjs)
 */
export const saveRow = (connection, target, row) =>
  writeRow(
    connection,
    { path: `${target.table}?on_conflict=${target.conflict}`, method: "POST", prefer: "resolution=merge-duplicates,return=representation" },
    row,
  );

/**
 * Updates the columns of one row. The row gives its id.
 * @param {Connection} connection
 * @param {string} table
 * @param {object} row
 * @returns {Promise<object>}
 * @uses writeRow
 * @usedby ACTIONS (web/app.edge.mjs)
 */
export const updateRow = (connection, table, row) =>
  writeRow(connection, { path: `${table}?id=eq.${row.id}`, method: "PATCH", prefer: "return=representation" }, row);

/**
 * Downloads one photo from the bucket.
 * @param {Connection} connection
 * @param {string} path - The path in the bucket. It starts with the company id.
 * @returns {Promise<Uint8Array>}
 * @uses BUCKET, headersOf, readBytes
 * @usedby readPhotos
 */
export const downloadPhoto = (connection, path) =>
  fetch(`${connection.url}/storage/v1/object/authenticated/${BUCKET}/${path}`, { headers: headersOf(connection) }).then(readBytes);

/**
 * Uploads one JPEG photo to the bucket.
 * @param {Connection} connection
 * @param {string} path - The path in the bucket. It starts with the company id.
 * @param {Blob} blob - The photo after the resize.
 * @returns {Promise<object>}
 * @uses BUCKET, readJson
 * @usedby addPhoto (web/app.edge.mjs)
 */
export const uploadPhoto = (connection, path, blob) =>
  fetch(`${connection.url}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: { apikey: connection.key, Authorization: `Bearer ${connection.token}`, "Content-Type": "image/jpeg" },
    body: blob,
  }).then(readJson);

/**
 * Calls a database function with named arguments and gives its result.
 * @param {Connection} connection
 * @param {string} name - The name of the function in the public schema.
 * @param {object} args - The arguments, by name.
 * @returns {Promise<unknown>}
 * @uses headersOf, readJson
 * @usedby ACTIONS (web/app.edge.mjs)
 */
export const callFunction = (connection, name, args) =>
  fetch(`${connection.url}/rest/v1/rpc/${name}`, { method: "POST", headers: headersOf(connection), body: JSON.stringify(args) }).then(readJson);
