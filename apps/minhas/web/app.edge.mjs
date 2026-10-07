// The browser page: the sign-in, the record of today, the photos, the reports and the export button.
// The page state is a value. Each action makes a new state and draws the page again.
/** @import { Connection, Page } from "../types/states.mjs" */
import { readExportEntries } from "../edge/export.edge.mjs";
import { callFunction, insertRow, openConnection, readRows, refreshSession, saveRow, signIn, updateRow, uploadPhoto } from "../edge/supabase.edge.mjs";
import { makeArchive, nameArchive } from "../src/export.mjs";
import { makePdf } from "../src/pdf.mjs";
import { fitWithin, makePhotoPath } from "../src/photo.mjs";
import { cleanRow, formatLocal, makeFilter, makeInFilter, makeMonthFilter } from "../src/rows.mjs";
import { makeVehicleLogLines } from "../src/vehicleLog.mjs";
import { renderPage } from "../src/view.mjs";
import { REPORT_RECIPIENTS, SETTINGS } from "./settings.mjs";

const SESSION_KEY = "minhas-session";
const NO_POSITION = { latitude: null, longitude: null };

/**
 * @uses openConnection (edge/supabase.edge.mjs), SETTINGS
 * @usedby ACTIONS, start
 */
const baseConnection = () => openConnection(SETTINGS.url, SETTINGS.key);
/**
 * @uses formatLocal (src/rows.mjs)
 * @usedby emptyPage, loadPage
 */
const today = () => formatLocal(new Date()).slice(0, 10);
/**
 * @usedby toIso, addPhoto, ACTIONS
 */
const nowIso = () => new Date().toISOString();
/**
 * @uses nowIso
 * @usedby ACTIONS
 */
const toIso = (local) => (local === "" ? nowIso() : new Date(local).toISOString());
/**
 * @uses formatLocal (src/rows.mjs)
 * @usedby describeStop
 */
const timeOf = (iso) => (iso === null ? "" : formatLocal(new Date(iso)).slice(11, 16));

/**
 * @uses SESSION_KEY
 * @usedby enter
 */
const rememberSession = (connection) => {
  localStorage.setItem(SESSION_KEY, connection.refreshToken);
  return connection;
};

/**
 * @uses today, REPORT_RECIPIENTS
 * @usedby loadPage, enter, ACTIONS, start
 */
const emptyPage = (connection, message) => ({
  connection,
  user: null,
  today: today(),
  vehicles: [],
  day: null,
  stops: [],
  fuelFills: [],
  photos: [],
  products: [],
  customers: [],
  recipients: REPORT_RECIPIENTS,
  message,
});

/**
 * @uses NO_POSITION
 * @usedby addPhoto, ACTIONS
 */
const readPosition = () =>
  new Promise((resolve) => {
    // The position is optional. Without permission, or after 5 seconds, the record has no position.
    const onPosition = (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    navigator.geolocation?.getCurrentPosition(onPosition, () => resolve(NO_POSITION), { timeout: 5000, maximumAge: 60000 });
    setTimeout(() => resolve(NO_POSITION), 6000);
  });

/**
 * @uses fitWithin (src/photo.mjs)
 * @usedby addPhoto
 */
const resizePhoto = (file) =>
  createImageBitmap(file, { imageOrientation: "from-image" }).then((bitmap) => {
    // The long side becomes 1200 px at most. The original never leaves the phone.
    const size = fitWithin(bitmap.width, bitmap.height);
    const canvas = new OffscreenCanvas(size.width, size.height);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, size.width, size.height);
    return canvas.convertToBlob({ type: "image/jpeg", quality: 0.85 });
  });

/**
 * @uses timeOf
 * @usedby loadDayRows
 */
const describeStop = (stop) => ({ ...stop, arrivedText: timeOf(stop.arrived_at), departedText: timeOf(stop.departed_at) });

/**
 * @uses formatLocal (src/rows.mjs)
 * @usedby loadDayRows
 */
const describeDay = (day) => ({ ...day, reportSentText: day.report_sent_at === null ? "" : formatLocal(new Date(day.report_sent_at)).replace("T", " ") });

/**
 * @usedby loadUser
 */
const memberOf = (row) => ({ id: row.user_id, companyId: row.company_id, name: row.name, role: row.role });

/**
 * @uses readRows (edge/supabase.edge.mjs), makeFilter (src/rows.mjs), memberOf
 * @usedby enter
 */
const loadUser = (connection) =>
  readRows(connection, "members", makeFilter({ user_id: connection.userId })).then((rows) => (rows.length === 0 ? null : memberOf(rows[0])));

/**
 * @uses readRows (edge/supabase.edge.mjs), makeInFilter (src/rows.mjs)
 * @usedby loadDayParts, makeVehicleLog
 */
const loadChildren = (connection, table, parents) =>
  parents.length === 0 ? Promise.resolve([]) : readRows(connection, table, makeInFilter(parents[0].column, parents.map((parent) => parent.id)));

/**
 * @uses readRows (edge/supabase.edge.mjs), makeFilter (src/rows.mjs), describeDay, describeStop
 * @usedby loadDayParts
 */
const loadDayRows = (connection, day) =>
  day === null
    ? Promise.resolve({ day, stops: [], fuelFills: [] })
    : Promise.all([
        readRows(connection, "stops", makeFilter({ day_id: day.id })),
        readRows(connection, "fuel_fills", makeFilter({ day_id: day.id })),
      ]).then(([stops, fuelFills]) => ({ day: describeDay(day), stops: stops.map(describeStop), fuelFills }));

/**
 * @uses loadDayRows, readRows (edge/supabase.edge.mjs), loadChildren
 * @usedby loadPage
 */
const loadDayParts = (connection, day) =>
  Promise.all([loadDayRows(connection, day), readRows(connection, "products", ""), readRows(connection, "customers", "")]).then(
    ([rows, products, customers]) =>
      loadChildren(connection, "photos", [...rows.stops, ...rows.fuelFills, ...products].map((row) => ({ column: "subject_id", id: row.id })))
        .then((photos) => ({ ...rows, products, customers, photos })),
  );

/**
 * @uses readRows (edge/supabase.edge.mjs), makeFilter (src/rows.mjs), today, loadDayParts, emptyPage
 * @usedby enter, reload
 */
const loadPage = (connection, user, message) =>
  Promise.all([
    readRows(connection, "vehicles", ""),
    readRows(connection, "days", makeFilter({ driver_id: user.id, day: today() })).then((rows) => loadDayParts(connection, rows[0] ?? null)),
  ]).then(([vehicles, parts]) => ({ ...emptyPage(connection, message), user, vehicles, ...parts }));

/**
 * @uses loadUser, rememberSession, emptyPage, loadPage
 * @usedby ACTIONS, start
 */
const enter = (connection, message) =>
  loadUser(rememberSession(connection)).then((user) => (user === null ? emptyPage(connection, message) : loadPage(connection, user, message)));

/**
 * @uses loadPage
 * @usedby ACTIONS
 */
const reload = (page, message) => loadPage(page.connection, page.user, message);

/**
 * @usedby makeVehicleLog, ACTIONS
 */
const download = (bytes, name, type) => {
  // A link to the bytes in memory. A click on it starts the download.
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const anchor = document.createElement("a");
  anchor.setAttribute("href", url);
  anchor.setAttribute("download", name);
  anchor.click();
  // The browser needs a moment to start the download before the link goes.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};

/**
 * @uses resizePhoto, readPosition, makePhotoPath (src/photo.mjs), nowIso, uploadPhoto (edge/supabase.edge.mjs),
 *   insertRow (edge/supabase.edge.mjs)
 * @usedby ACTIONS
 */
const addPhoto = (page, form) =>
  Promise.all([resizePhoto(form.file), readPosition()]).then(([blob, position]) => {
    // The path names the company, the record and the time.
    const subject = { table: form.subject_table, id: form.subject_id };
    const path = makePhotoPath(page.user.companyId, subject, String(Date.now()));
    // The file goes to the bucket first. Then the row names it.
    const row = { company_id: page.user.companyId, subject_table: subject.table, subject_id: subject.id, path, kind: form.kind, taken_at: nowIso(), ...position };
    return uploadPhoto(page.connection, path, blob).then(() => insertRow(page.connection, "photos", row));
  });

/**
 * @uses readRows (edge/supabase.edge.mjs), makeFilter (src/rows.mjs), makeMonthFilter (src/rows.mjs), loadChildren,
 *   download, makePdf (src/pdf.mjs), makeVehicleLogLines (src/vehicleLog.mjs)
 * @usedby ACTIONS
 */
const makeVehicleLog = (page, month) =>
  readRows(page.connection, "days", `${makeFilter({ driver_id: page.user.id })}&${makeMonthFilter(month)}`).then((days) =>
    loadChildren(page.connection, "fuel_fills", days.map((day) => ({ column: "day_id", id: day.id }))).then((fuelFills) => {
      download(makePdf(makeVehicleLogLines(month, { days, fuelFills, vehicles: page.vehicles, driver: page.user.name })), `vehicle-log-${month}.pdf`, "application/pdf");
      return days.length;
    }),
  );

/**
 * @uses signIn (edge/supabase.edge.mjs), enter, SESSION_KEY, emptyPage, baseConnection,
 *   callFunction (edge/supabase.edge.mjs), insertRow (edge/supabase.edge.mjs), cleanRow (src/rows.mjs), reload,
 *   saveRow (edge/supabase.edge.mjs), readPosition, toIso, updateRow (edge/supabase.edge.mjs), nowIso, addPhoto,
 *   makeVehicleLog, readExportEntries (edge/export.edge.mjs), download, makeArchive (src/export.mjs),
 *   nameArchive (src/export.mjs)
 * @usedby handle
 */
const ACTIONS = {
  "sign-in": (page, form) => signIn(page.connection, form.email, form.password).then((connection) => enter(connection, "")),
  "sign-out": () => {
    localStorage.removeItem(SESSION_KEY);
    return Promise.resolve(emptyPage(baseConnection(), "Signed out."));
  },
  join: (page, form) =>
    callFunction(page.connection, "join_first_company", { company_name: form.company_name, driver_name: form.driver_name }).then(() =>
      enter(page.connection, "Welcome. Add your vehicle, then save the day."),
    ),
  "add-product": (page, form) =>
    insertRow(page.connection, "products", { ...cleanRow(form), company_id: page.user.companyId }).then(() => reload(page, "Product added.")),
  "add-customer": (page, form) =>
    insertRow(page.connection, "customers", { ...cleanRow(form), company_id: page.user.companyId }).then(() => reload(page, "Customer added.")),
  "add-vehicle": (page, form) =>
    insertRow(page.connection, "vehicles", { ...cleanRow(form), company_id: page.user.companyId }).then(() => reload(page, "Vehicle added.")),
  "save-day": (page, form) =>
    saveRow(page.connection, { table: "days", conflict: "driver_id,day" }, {
      ...cleanRow(form),
      company_id: page.user.companyId,
      driver_id: page.user.id,
      day: page.today,
    }).then(() => reload(page, "Day saved.")),
  "add-stop": (page, form) =>
    readPosition()
      .then((position) =>
        insertRow(page.connection, "stops", {
          ...cleanRow(form),
          ...position,
          arrived_at: toIso(form.arrived_at),
          company_id: page.user.companyId,
          day_id: page.day.id,
        }))
      .then(() => reload(page, "Stop added.")),
  depart: (page, form) =>
    updateRow(page.connection, "stops", { id: form.id, departed_at: nowIso() }).then(() => reload(page, "Departure saved.")),
  "add-fuel": (page, form) =>
    insertRow(page.connection, "fuel_fills", {
      ...cleanRow(form),
      filled_at: toIso(form.filled_at),
      company_id: page.user.companyId,
      day_id: page.day.id,
    }).then(() => reload(page, "Fuel fill added.")),
  "add-photo": (page, form) => addPhoto(page, form).then(() => reload(page, "Photo added.")),
  "report-sent": (page) =>
    updateRow(page.connection, "days", { id: page.day.id, report_sent_at: nowIso() }).then(() => reload(page, "Report marked as sent.")),
  "vehicle-log": (page, form) => makeVehicleLog(page, form.month).then((count) => ({ ...page, message: `Vehicle log ${form.month}: ${count} days.` })),
  export: (page) =>
    readExportEntries(page.connection).then((entries) => {
      download(makeArchive(entries), nameArchive(page.today), "application/zip");
      return { ...page, message: `Export made: ${entries.length} files.` };
    }),
};

/**
 * @usedby readForm
 */
const readElement = (element) => [element.name, element.type === "file" ? element.files[0] ?? null : element.value];

/**
 * @uses readElement
 * @usedby onSubmit
 */
const readForm = (form) => Object.fromEntries([...form.elements].filter((element) => element.name !== "").map(readElement));

/**
 * @uses ACTIONS, draw
 * @usedby onSubmit
 */
const handle = (page, action, form) =>
  ACTIONS[action](page, form)
    .then(draw)
    .catch((error) => draw({ ...page, message: `Problem: ${error.message}` }));

/**
 * @uses handle, readForm
 * @usedby draw
 */
const onSubmit = (page) => (event) => {
  event.preventDefault();
  handle(page, event.target.dataset.action, readForm(event.target));
};

/**
 * @uses renderPage (src/view.mjs), onSubmit
 * @usedby handle, start
 */
const draw = (page) => {
  // The page is drawn again from the state. The old forms and their listeners go.
  const root = document.querySelector("#app");
  root.replaceChildren();
  root.insertAdjacentHTML("afterbegin", renderPage(page));
  // Each form sends its action with the state of this drawing.
  [...root.querySelectorAll("form")].map((form) => form.addEventListener("submit", onSubmit(page)));
};

/**
 * @uses SESSION_KEY, emptyPage, baseConnection, refreshSession (edge/supabase.edge.mjs), enter, draw
 * @usedby web/app.edge.mjs
 */
const start = () => {
  // A saved refresh token gives a new session without a sign-in.
  const saved = localStorage.getItem(SESSION_KEY) ?? "";
  const opening =
    saved === ""
      ? Promise.resolve(emptyPage(baseConnection(), ""))
      : refreshSession(baseConnection(), saved)
          .then((connection) => enter(connection, ""))
          .catch(() => emptyPage(baseConnection(), "The session ended. Sign in again."));
  opening.then(draw);
};

start();
