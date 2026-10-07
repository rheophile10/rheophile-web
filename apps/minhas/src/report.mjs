// The daily report (Schedule A, item 10): the arrival time, the departure time, the location and the action plan of each stop.
/** @import { Page } from "../types/states.mjs" */

/**
 * @usedby makeReportLines
 */
const describeVehicle = (page) => {
  // The vehicle of the day, by its unit number and plate. "None" without a vehicle.
  const vehicle = page.vehicles.find((row) => row.id === page.day?.vehicle_id);
  return vehicle === undefined ? "None" : `${vehicle.unit_number ?? ""} ${vehicle.plate ?? ""}`.trim();
};

/**
 * @usedby makeReportLines
 */
const describeStop = (stop) =>
  [
    `${stop.arrivedText} - ${stop.departedText === "" ? "(not departed)" : stop.departedText}  ${stop.location}`,
    stop.note === null ? "" : `  Note: ${stop.note}`,
    stop.action_plan === null ? "" : `  Action plan: ${stop.action_plan}`,
  ].filter((line) => line !== "");

/**
 * @usedby makeReportLines
 */
const describeFuel = (fill) => `${fill.odometer_km} km, ${fill.litres ?? "?"} L, $${fill.cost ?? "?"}, ${fill.station ?? ""}`;

/**
 * Makes the lines of the daily report from the page state.
 * @param {Page} page
 * @returns {string[]}
 * @standard stops - Each stop gives its arrival time, its departure time and its location on one line.
 * @standard plan - The action plan of the day is the last part of the report.
 * @uses describeVehicle, describeStop, describeFuel
 * @usedby makeReportMail
 */
export const makeReportLines = (page) => [
  `Daily report ${page.today}`,
  `Driver: ${page.user.name}`,
  `Vehicle: ${describeVehicle(page)}`,
  `Start km: ${page.day?.start_km ?? ""}   End km: ${page.day?.end_km ?? ""}`,
  `Trip: ${page.day?.trip_url ?? ""}`,
  "",
  "Stops",
  ...page.stops.flatMap(describeStop),
  "",
  "Fuel",
  ...page.fuelFills.map(describeFuel),
  "",
  `Action plan: ${page.day?.action_plan ?? ""}`,
];

/**
 * Makes a mailto link that opens the daily report in the mail program of the phone.
 * @param {Page} page
 * @param {{ supervisor: string, copy: string }} recipients - The address of the supervisor and the address of the copy.
 * @returns {string}
 * @standard encoded - The subject and the body are URL-encoded, with the lines separated by CRLF.
 * @uses makeReportLines
 * @usedby renderReports
 */
export const makeReportMail = (page, recipients) => {
  // The subject names the day and the driver.
  const subject = encodeURIComponent(`Daily report ${page.today} - ${page.user.name}`);
  // The body is the report with CRLF line ends, as RFC 6068 says.
  const body = encodeURIComponent(makeReportLines(page).join("\r\n"));
  return `mailto:${recipients.supervisor}?cc=${encodeURIComponent(recipients.copy)}&subject=${subject}&body=${body}`;
};
