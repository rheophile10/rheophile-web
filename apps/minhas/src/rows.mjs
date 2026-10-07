/**
 * @usedby formatLocal, makeMonthFilter
 */
const padTwo = (number) => String(number).padStart(2, "0");

/**
 * Makes a PostgREST filter from the columns that each row must agree with.
 * @param {object} conditions - Column names and the values that the rows must have.
 * @returns {string}
 * @standard encoded - A value with a space or a special character is URL-encoded.
 * @usedby loadUser (web/app.edge.mjs), loadDayRows (web/app.edge.mjs), loadPage (web/app.edge.mjs),
 *   makeVehicleLog (web/app.edge.mjs)
 */
export const makeFilter = (conditions) =>
  Object.entries(conditions)
    .map(([name, value]) => `${name}=eq.${encodeURIComponent(value)}`)
    .join("&");

/**
 * Makes a row for the database from the values of a form. An empty field is null, not an empty text.
 * @param {object} form - Field names and their text values.
 * @returns {object}
 * @standard empty - An empty text becomes null. All other values stay.
 * @usedby ACTIONS (web/app.edge.mjs)
 */
export const cleanRow = (form) =>
  Object.fromEntries(Object.entries(form).map(([name, value]) => [name, value === "" ? null : value]));

/**
 * Makes the local date and time of a Date, in the form of a datetime-local input.
 * @param {Date} date
 * @returns {string}
 * @standard local - The text has the form YYYY-MM-DDTHH:MM in the local time zone.
 * @uses padTwo
 * @usedby today (web/app.edge.mjs), timeOf (web/app.edge.mjs), describeDay (web/app.edge.mjs)
 */
export const formatLocal = (date) => {
  // The month of a Date starts at 0.
  const day = [date.getFullYear(), padTwo(date.getMonth() + 1), padTwo(date.getDate())].join("-");
  // The time has hours and minutes only.
  return `${day}T${padTwo(date.getHours())}:${padTwo(date.getMinutes())}`;
};

/**
 * Makes a PostgREST filter for the rows whose column has one of the values.
 * @param {string} name - The column.
 * @param {string[]} values
 * @returns {string}
 * @standard list - The filter has each value, in quotes, between the parentheses of "in".
 * @usedby loadChildren (web/app.edge.mjs)
 */
export const makeInFilter = (name, values) => `${name}=in.(${values.map((value) => `"${value}"`).join(",")})`;

/**
 * Makes a PostgREST filter for the days of one month.
 * @param {string} month - A month in the form YYYY-MM.
 * @returns {string}
 * @standard range - The filter starts on the first day of the month and ends before the first day of the next month.
 * @uses padTwo
 * @usedby makeVehicleLog (web/app.edge.mjs)
 */
export const makeMonthFilter = (month) => {
  // The next month comes from the numbers of the year and the month. December goes to January.
  const [year, monthNumber] = month.split("-").map(Number);
  const next = monthNumber === 12 ? `${year + 1}-01` : `${year}-${padTwo(monthNumber + 1)}`;
  return `day=gte.${month}-01&day=lt.${next}-01`;
};
