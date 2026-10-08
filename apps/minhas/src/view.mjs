// The HTML of the test page. Each function makes text from the page state and changes nothing.
/** @import { Page } from "../types/states.mjs" */
import { CHECK_GROUPS, CHECK_ITEMS, CONFIRMATION, labelOf, makeCheckTitle } from "./checklist.mjs";
import { makeReportMail } from "./report.mjs";

const DAY_FIELDS = [
  { name: "start_km", label: "Start km", type: "number" },
  { name: "end_km", label: "End km", type: "number" },
  { name: "trip_url", label: "Trip link (Google Maps)", type: "url" },
  { name: "clock_in", label: "Clock in", type: "time" },
  { name: "lunch_out", label: "Lunch out", type: "time" },
  { name: "lunch_in", label: "Lunch in", type: "time" },
  { name: "clock_out", label: "Clock out", type: "time" },
  { name: "action_plan", label: "Action plan", type: "text" },
];

const STOP_FIELDS = [
  { name: "location", label: "Location", type: "text" },
  { name: "odometer_km", label: "Odometer km", type: "number" },
  { name: "arrived_at", label: "Arrived (empty = now)", type: "datetime-local" },
  { name: "note", label: "Note", type: "text" },
  { name: "action_plan", label: "Action plan", type: "text" },
];

const FUEL_FIELDS = [
  { name: "odometer_km", label: "Odometer km", type: "number" },
  { name: "litres", label: "Litres", type: "number" },
  { name: "cost", label: "Cost $", type: "number" },
  { name: "station", label: "Station", type: "text" },
  { name: "filled_at", label: "Time (empty = now)", type: "datetime-local" },
];

const VEHICLE_FIELDS = [
  { name: "unit_number", label: "Unit number", type: "text" },
  { name: "plate", label: "Plate", type: "text" },
  { name: "make", label: "Make", type: "text" },
  { name: "model", label: "Model", type: "text" },
];

const FAULT_FIELDS = [{ name: "description", label: "Description (for example: left mirror cracked)", type: "text" }];
const RESOLVE_FIELDS = [{ name: "resolution", label: "Repair or action", type: "text" }];

const PRODUCT_FIELDS = [
  { name: "sku", label: "SKU", type: "text" },
  { name: "description", label: "Description", type: "text" },
];

const CUSTOMER_FIELDS = [
  { name: "name", label: "Name", type: "text" },
  { name: "contact_name", label: "Contact person (for a company)", type: "text" },
  { name: "phone", label: "Phone", type: "tel" },
  { name: "email", label: "Email", type: "email" },
  { name: "address", label: "Address", type: "text" },
  { name: "note", label: "Note", type: "text" },
];

const CUSTOMER_KINDS = ["company", "person"];
const PRODUCT_KINDS = ["product", "other"];

const JOIN_FIELDS = [
  { name: "driver_name", label: "Your name", type: "text" },
  { name: "company_name", label: "Company", type: "text" },
];

const STOP_KINDS = ["invoice", "boxes", "other"];
const FUEL_KINDS = ["receipt", "other"];
const CHECK_KINDS = ["condition", "odometer", "other"];
const FAULT_KINDS = ["damage", "other"];
const RESULT_NAMES = [
  ["ok", "OK"],
  ["defect", "Defect"],
];

/**
 * Makes text safe for HTML. The four special characters become entities.
 * @param {unknown} value
 * @returns {string}
 * @standard safe - The characters &, <, > and " become entities.
 * @usedby 10 declarations in view
 */
export const escapeHtml = (value) =>
  String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/**
 * @uses escapeHtml
 * @usedby renderFields
 */
const renderField = (field, value) =>
  `<label>${field.label}<input type="${field.type}" step="any" name="${field.name}" value="${escapeHtml(value)}"></label>`;

/**
 * @uses renderField
 * @usedby renderJoin, renderVehiclesSection, renderProductsSection, renderCustomersSection, renderDayForm,
 *   renderStops, renderFuelFills
 */
const renderFields = (fields, row) => fields.map((field) => renderField(field, row[field.name] ?? "")).join("");

/**
 * @usedby renderOption, renderVehiclesSection
 */
const describeVehicle = (vehicle) => [vehicle.unit_number, vehicle.plate, vehicle.make, vehicle.model].filter(Boolean).join(" ");

/**
 * @uses escapeHtml, describeVehicle
 * @usedby renderVehicles
 */
const renderOption = (vehicle, selected) =>
  `<option value="${vehicle.id}"${vehicle.id === selected ? " selected" : ""}>${escapeHtml(describeVehicle(vehicle))}</option>`;

/**
 * @uses renderOption
 * @usedby renderDayForm
 */
const renderVehicles = (vehicles, selected) =>
  `<label>Vehicle<select name="vehicle_id"><option value="">None</option>${vehicles.map((vehicle) => renderOption(vehicle, selected)).join("")}</select></label>`;

/**
 * @uses CHECK_ITEMS
 * @usedby renderFaults
 */
const renderItemChoice = () =>
  `<label>Checklist item<select name="item"><option value="">None</option>${CHECK_ITEMS.map((item) => `<option value="${item.key}">${item.label}</option>`).join("")}</select></label>`;

/**
 * @usedby renderPage
 */
const renderLogin = () => `
<form data-action="sign-in">
  <h1>Minhas daily report</h1>
  <label>Email<input type="email" name="email" required autocomplete="username"></label>
  <label>Password<input type="password" name="password" required autocomplete="current-password"></label>
  <button>Sign in</button>
</form>`;

/**
 * @uses renderFields, JOIN_FIELDS
 * @usedby renderPage
 */
const renderJoin = () => `
<form data-action="join">
  <h1>Minhas daily report</h1>
  <p>Your login has no company yet. Give your name and the company name. You become the driver of that company.</p>
  ${renderFields(JOIN_FIELDS, { company_name: "Minhas Sask Ventures Inc." })}
  <button>Join</button>
</form>`;

/**
 * @uses escapeHtml, describeVehicle, renderFields, VEHICLE_FIELDS
 * @usedby renderSetup
 */
const renderVehiclesSection = (page) => `
<section>
  <h2>Vehicles</h2>
  <ul>${page.vehicles.map((vehicle) => `<li>${escapeHtml(describeVehicle(vehicle))}</li>`).join("")}</ul>
  <form data-action="add-vehicle">${renderFields(VEHICLE_FIELDS, {})}<button>Add the vehicle</button></form>
</section>`;

/**
 * @uses escapeHtml, renderPhoto, renderPhotoForm, PRODUCT_KINDS
 * @usedby renderProductsSection
 */
const renderProduct = (product, photos) => `
<li><strong>${escapeHtml(product.sku)}</strong> ${escapeHtml(product.description)}
  <ul>${photos.map(renderPhoto).join("")}</ul>
  ${renderPhotoForm({ table: "products", id: product.id }, PRODUCT_KINDS)}
</li>`;

/**
 * @uses renderProduct, photosOf, renderFields, PRODUCT_FIELDS
 * @usedby renderSetup
 */
const renderProductsSection = (page) => `
<section>
  <h2>Products</h2>
  <ul>${page.products.map((product) => renderProduct(product, photosOf(page, product.id))).join("")}</ul>
  <form data-action="add-product">${renderFields(PRODUCT_FIELDS, {})}<button>Add the product</button></form>
</section>`;

/**
 * @usedby renderCustomersSection
 */
const describeCustomer = (customer) =>
  [customer.name, customer.kind === "company" && customer.contact_name !== null ? `(${customer.contact_name})` : "", customer.phone, customer.email]
    .filter((part) => part !== null && part !== "")
    .join(" ");

/**
 * @uses escapeHtml, describeCustomer, CUSTOMER_KINDS, renderFields, CUSTOMER_FIELDS
 * @usedby renderSetup
 */
const renderCustomersSection = (page) => `
<section>
  <h2>Customers</h2>
  <ul>${page.customers.map((customer) => `<li>${escapeHtml(customer.kind)}: ${escapeHtml(describeCustomer(customer))}</li>`).join("")}</ul>
  <form data-action="add-customer">
    <label>Kind<select name="kind">${CUSTOMER_KINDS.map((kind) => `<option value="${kind}">${kind}</option>`).join("")}</select></label>
    ${renderFields(CUSTOMER_FIELDS, {})}<button>Add the customer</button>
  </form>
</section>`;

/**
 * @uses renderVehiclesSection, renderProductsSection, renderCustomersSection
 * @usedby renderDayParts
 */
const renderSetup = (page) => renderVehiclesSection(page) + renderProductsSection(page) + renderCustomersSection(page);

/**
 * @uses escapeHtml
 * @usedby renderPage
 */
const renderHeader = (page) => `
<header>
  <strong>${escapeHtml(page.user.name)}</strong> · ${page.today}
  <form data-action="export"><button>Export ZIP</button></form>
  <form data-action="sign-out"><button>Sign out</button></form>
</header>`;

/**
 * @uses escapeHtml
 * @usedby renderPage
 */
const renderMessage = (page) => (page.message === "" ? "" : `<p class="message">${escapeHtml(page.message)}</p>`);

/**
 * @uses renderVehicles, renderFields, DAY_FIELDS
 * @usedby renderPage
 */
const renderDayForm = (page) => `
<form data-action="save-day">
  <h2>Day</h2>
  ${renderVehicles(page.vehicles, page.day?.vehicle_id ?? "")}
  ${renderFields(DAY_FIELDS, page.day ?? {})}
  <button>Save the day</button>
</form>`;

/**
 * @usedby renderPhoto, renderStop
 */
const renderPosition = (row) => (row.latitude === null ? "" : ` <small>(${row.latitude.toFixed(5)}, ${row.longitude.toFixed(5)})</small>`);

/**
 * @uses escapeHtml, renderPosition
 * @usedby renderProduct, renderStop, renderFuelFill
 */
const renderPhoto = (photo) => `<li class="photo">${escapeHtml(photo.kind)}: ${escapeHtml(photo.path.split("/").at(-1))}${renderPosition(photo)}</li>`;

/**
 * @usedby renderProduct, renderStop, renderFuelFill
 */
const renderPhotoForm = (subject, kinds) => `
<form data-action="add-photo" class="photo-form">
  <input type="hidden" name="subject_table" value="${subject.table}"><input type="hidden" name="subject_id" value="${subject.id}">
  <select name="kind">${kinds.map((kind) => `<option value="${kind}">${kind}</option>`).join("")}</select>
  <input type="file" name="file" accept="image/*" required>
  <button>Add the photo</button>
</form>`;

/**
 * @usedby renderProductsSection, renderStops, renderFuelFills
 */
const photosOf = (page, id) => page.photos.filter((photo) => photo.subject_id === id);

/**
 * @uses escapeHtml, renderPosition, renderPhoto, renderPhotoForm, STOP_KINDS
 * @usedby renderStops
 */
const renderStop = (stop, photos) => `
<li>
  <strong>${escapeHtml(stop.location)}</strong> ${stop.arrivedText} – ${stop.departedText}${renderPosition(stop)}
  ${stop.odometer_km === null ? "" : `${stop.odometer_km} km.`} ${escapeHtml(stop.note)} ${escapeHtml(stop.action_plan)}
  ${stop.departed_at === null ? `<form data-action="depart"><input type="hidden" name="id" value="${stop.id}"><button>Depart now</button></form>` : ""}
  <ul>${photos.map(renderPhoto).join("")}</ul>
  ${renderPhotoForm({ table: "stops", id: stop.id }, STOP_KINDS)}
</li>`;

/**
 * @uses renderStop, photosOf, renderFields, STOP_FIELDS
 * @usedby renderDayParts
 */
const renderStops = (page) => `
<section>
  <h2>Stops</h2>
  <ul>${page.stops.map((stop) => renderStop(stop, photosOf(page, stop.id))).join("")}</ul>
  <form data-action="add-stop">${renderFields(STOP_FIELDS, {})}<button>Add the stop</button></form>
</section>`;

/**
 * @uses escapeHtml, renderPhoto, renderPhotoForm, FUEL_KINDS
 * @usedby renderFuelFills
 */
const renderFuelFill = (fill, photos) => `
<li>${fill.odometer_km} km, ${fill.litres ?? "?"} L, $${fill.cost ?? "?"}, ${escapeHtml(fill.station)}
  <ul>${photos.map(renderPhoto).join("")}</ul>
  ${renderPhotoForm({ table: "fuel_fills", id: fill.id }, FUEL_KINDS)}
</li>`;

/**
 * @uses renderFuelFill, photosOf, renderFields, FUEL_FIELDS
 * @usedby renderDayParts
 */
const renderFuelFills = (page) => `
<section>
  <h2>Fuel</h2>
  <ul>${page.fuelFills.map((fill) => renderFuelFill(fill, photosOf(page, fill.id))).join("")}</ul>
  <form data-action="add-fuel">${renderFields(FUEL_FIELDS, {})}<button>Add the fuel fill</button></form>
</section>`;

/**
 * @usedby renderReports
 */
const renderReportSent = (page) =>
  page.day.report_sent_at === null
    ? `<form data-action="report-sent"><button>Mark the report as sent</button></form>`
    : `<p>Report sent: ${page.day.reportSentText}</p>`;

/**
 * @uses escapeHtml, RESULT_NAMES
 * @usedby renderCheckItem
 */
const renderResult = (item, chosen) =>
  RESULT_NAMES.map(
    ([value, name]) => `<label><input type="radio" name="item_${item.key}" value="${value}"${chosen === value ? " checked" : ""}> ${name}</label>`,
  ).join("");

/**
 * @uses escapeHtml, renderResult
 * @usedby renderCheckForm
 */
const renderCheckItem = (item, results, faults) => `
<fieldset class="check-item"><legend>${escapeHtml(item.label)}</legend>${renderResult(item, results[item.key])}
  ${faults.filter((fault) => fault.item === item.key).map((fault) => `<small>Open fault: ${escapeHtml(fault.description)}</small>`).join("")}
</fieldset>`;

/**
 * @uses CHECK_GROUPS, renderCheckItem, CONFIRMATION, escapeHtml
 * @usedby renderCheck
 */
const renderCheckForm = (check, faults) => `
<form data-action="save-check">
  ${CHECK_GROUPS.map((group) => `<h3>${group.title}</h3>${group.items.map((item) => renderCheckItem(item, check?.results ?? {}, faults)).join("")}`).join("")}
  <label class="confirm"><input type="checkbox" name="all_checked" value="true"${check?.all_checked ? " checked" : ""}> ${CONFIRMATION}</label>
  <label>Notes<input type="text" name="notes" value="${escapeHtml(check?.notes)}"></label>
  <button>Save the check</button>
</form>`;

/**
 * @uses renderPhoto, renderPhotoForm, CHECK_KINDS
 * @usedby renderCheck
 */
const renderCheckOutputs = (check, photos) => `
  <ul>${photos.map(renderPhoto).join("")}</ul>
  ${renderPhotoForm({ table: "vehicle_checks", id: check.id }, CHECK_KINDS)}
  <form data-action="check-pdf"><button>Download the checklist PDF</button></form>`;

/**
 * @uses escapeHtml, makeCheckTitle, renderCheckForm, renderCheckOutputs, photosOf
 * @usedby renderPage
 */
const renderCheck = (page) => {
  // The check is for the vehicle of the day. Without it, the section asks for it.
  const vehicle = page.vehicles.find((row) => row.id === page.day?.vehicle_id);
  const faults = page.faults.filter((fault) => fault.vehicle_id === vehicle?.id);
  return vehicle === undefined
    ? "<section><h2>Vehicle check</h2><p>Choose the vehicle of the day and save the day. Then do the vehicle check.</p></section>"
    : `<section><h2>Vehicle check</h2><p><strong>${escapeHtml(makeCheckTitle(vehicle, page.today))}</strong></p>
      ${renderCheckForm(page.check, faults)}${page.check === null ? "" : renderCheckOutputs(page.check, photosOf(page, page.check.id))}</section>`;
};

/**
 * @uses escapeHtml, describeVehicle, labelOf, renderPhoto, renderPhotoForm, FAULT_KINDS, renderFields, RESOLVE_FIELDS
 * @usedby renderFaults
 */
const renderFault = (fault, vehicle, photos) => `
<li><strong>${escapeHtml(describeVehicle(vehicle ?? {}))}</strong> ${fault.reportedText}: ${escapeHtml(fault.description)}${fault.item === null ? "" : ` <small>(${escapeHtml(labelOf(fault.item))})</small>`}
  <ul>${photos.map(renderPhoto).join("")}</ul>
  ${renderPhotoForm({ table: "faults", id: fault.id }, FAULT_KINDS)}
  <form data-action="resolve-fault"><input type="hidden" name="id" value="${fault.id}">${renderFields(RESOLVE_FIELDS, {})}<button>Resolve the fault</button></form>
</li>`;

/**
 * @uses renderFault, photosOf, renderVehicles, renderItemChoice, renderFields, FAULT_FIELDS
 * @usedby renderPage
 */
const renderFaults = (page) => `
<section>
  <h2>Faults</h2>
  <p>A fault stays on its vehicle until you resolve it.</p>
  <ul>${page.faults.map((fault) => renderFault(fault, page.vehicles.find((row) => row.id === fault.vehicle_id), photosOf(page, fault.id))).join("")}</ul>
  <form data-action="add-fault">${renderVehicles(page.vehicles, page.day?.vehicle_id ?? "")}${renderItemChoice()}${renderFields(FAULT_FIELDS, {})}<button>Add the fault</button></form>
</section>`;

/**
 * @uses makeReportMail, renderReportSent
 * @usedby renderDayParts
 */
const renderReports = (page) => `
<section>
  <h2>Reports</h2>
  <a class="button" href="${makeReportMail(page, page.recipients)}">Send the daily report by email</a>
  ${renderReportSent(page)}
  <form data-action="vehicle-log">
    <label>Vehicle log, month<input type="month" name="month" value="${page.today.slice(0, 7)}"></label>
    <button>Download the vehicle log PDF</button>
  </form>
</section>`;

/**
 * @uses renderSetup, renderStops, renderFuelFills, renderReports
 * @usedby renderPage
 */
const renderDayParts = (page) =>
  page.day === null
    ? "<p>Save the day. Then add the stops and the fuel fills.</p>" + renderSetup(page)
    : renderStops(page) + renderFuelFills(page) + renderReports(page) + renderSetup(page);

/**
 * Makes the HTML of the full page: the sign-in form, or the record of today.
 * @param {Page} page
 * @returns {string}
 * @standard login - Without a user, the page is the sign-in form only. With a login but no member row, it is the join form.
 * @standard record - With a user, the page has the day form, and the stops, the fuel fills and the reports after the first save.
 * @standard check - With a day and a vehicle, the page has the checklist form with each item. Without a vehicle, it asks for one.
 * @standard faults - The page lists each open fault, with a photo form and a resolve form.
 * @uses renderLogin, renderJoin, renderMessage, renderHeader, renderDayForm, renderCheck, renderFaults, renderDayParts
 * @usedby draw (web/app.edge.mjs)
 */
export const renderPage = (page) =>
  page.user === null
    ? (page.connection.userId === "" ? renderLogin() : renderJoin()) + renderMessage(page)
    : [renderHeader(page), renderMessage(page), renderDayForm(page), renderCheck(page), renderFaults(page), renderDayParts(page)].join("");
