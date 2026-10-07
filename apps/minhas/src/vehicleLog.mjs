// The vehicle log (Schedule A, item 5g): the start km and the end km of each day, and each fuel fill with its km.

/**
 * @usedby describeDay, describeFill
 */
const column = (value, width) => String(value ?? "").padStart(width);
/**
 * @usedby describeDay
 */
const columnLeft = (value, width) => String(value ?? "").padEnd(width);

/**
 * @usedby describeDay
 */
const nameVehicle = (vehicles, id) => {
  // The unit number of the vehicle, or an empty text.
  const vehicle = vehicles.find((row) => row.id === id);
  return vehicle === undefined ? "" : (vehicle.unit_number ?? vehicle.plate ?? "");
};

/**
 * @usedby describeDay, makeVehicleLogLines
 */
const distanceOf = (day) => (day.start_km === null || day.end_km === null ? 0 : day.end_km - day.start_km);

/**
 * @uses columnLeft, nameVehicle, column, distanceOf
 * @usedby makeVehicleLogLines
 */
const describeDay = (day, vehicles) =>
  `${day.day}  ${columnLeft(nameVehicle(vehicles, day.vehicle_id), 12)}${column(day.start_km, 10)}${column(day.end_km, 10)}${column(distanceOf(day), 10)}`;

/**
 * @uses column
 * @usedby makeVehicleLogLines
 */
const describeFill = (fill, days) =>
  `${days.find((day) => day.id === fill.day_id)?.day ?? ""}  ${column(fill.odometer_km, 12)}${column(fill.litres, 9)}${column(fill.cost, 10)}  ${fill.station ?? ""}`;

/**
 * @usedby makeVehicleLogLines
 */
const byDay = (first, second) => (first.day < second.day ? -1 : 1);
/**
 * @usedby makeVehicleLogLines
 */
const byOdometer = (first, second) => first.odometer_km - second.odometer_km;

/**
 * @usedby makeVehicleLogLines
 */
const sumOf = (rows, pick) => rows.reduce((total, row) => total + Number(pick(row) ?? 0), 0);

/**
 * Makes the lines of the vehicle log of one month: a table of the days and a table of the fuel fills.
 * @param {string} month - A month in the form YYYY-MM.
 * @param {{ days: object[], fuelFills: object[], vehicles: object[], driver: string }} records
 * @returns {string[]}
 * @standard distance - The last line of the days gives the sum of the distances.
 * @standard fuel - The last line of the fuel fills gives the sum of the litres and the sum of the costs.
 * @standard sorted - The days are in the sequence of their dates. The fuel fills are in the sequence of their odometer values.
 * @uses byDay, describeDay, sumOf, distanceOf, byOdometer, describeFill
 * @usedby makeVehicleLog (web/app.edge.mjs)
 */
export const makeVehicleLogLines = (month, records) => [
  `Vehicle log ${month}    Driver: ${records.driver}`,
  "",
  `Date        Vehicle       Start km    End km  Distance`,
  ...[...records.days].sort(byDay).map((day) => describeDay(day, records.vehicles)),
  `Total distance: ${sumOf(records.days, distanceOf)} km`,
  "",
  "Fuel fills (full tank)",
  `Date         Odometer km   Litres      Cost  Station`,
  ...[...records.fuelFills].sort(byOdometer).map((fill) => describeFill(fill, records.days)),
  `Total fuel: ${sumOf(records.fuelFills, (fill) => fill.litres)} L, $${sumOf(records.fuelFills, (fill) => fill.cost).toFixed(2)}`,
];
