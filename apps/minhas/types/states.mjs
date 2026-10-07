// States: a thing that continues, shown at one moment.

/**
 * A Connection is a state that holds the address and the credentials of one Supabase project.
 * @typedef {object} Connection
 * @property {string} url - The address of the project, without a path.
 * @property {string} key - The publishable key or the secret key of the project.
 * @property {string} token - The bearer token: the session token of a user, or the key.
 * @property {string} refreshToken - The refresh token of the session, or an empty text without a session.
 * @property {string} userId - The id of the user of the session, or an empty text without a session.
 * @madeby openConnection
 * @changedby signIn, refreshSession
 * @readby 9 declarations in export, supabase
 */

/**
 * A Page is a state that holds what the browser page shows at one moment.
 * @typedef {object} Page
 * @property {Connection} connection - The connection of the user, or the base connection before the sign-in.
 * @property {object | null} user - The member of the session: id, companyId, name, role. Null before the sign-in.
 * @property {string} today - The date of today in the form YYYY-MM-DD.
 * @property {object[]} vehicles - The vehicles of the company.
 * @property {object | null} day - The row of today in the days table, with the sent time also as local text. Null before the first save.
 * @property {object[]} stops - The stops of today, with the times also as local text.
 * @property {object[]} fuelFills - The fuel fills of today.
 * @property {object[]} photos - The photos of the stops and the fuel fills of today, and of the products.
 * @property {object[]} products - The products of the company.
 * @property {object[]} customers - The customers of the company.
 * @property {{ supervisor: string, copy: string }} recipients - The addresses of the daily report.
 * @property {string} message - The last message for the user.
 * @readby makeReportLines, makeReportMail, renderPage
 */

export {};
