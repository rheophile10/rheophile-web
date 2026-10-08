// The daily vehicle checklist of Minhas Sask (vehicleChecklist.pdf, 2026-10-08), and the document of one check.
// The item labels keep the words of the paper form, because the driver compares the two.

/**
 * The groups of the checklist, in the sequence of the paper form. Each item key is a key of vehicle_checks.results.
 * @usedby CHECK_ITEMS, makeCheckLines, renderCheckForm (src/view.mjs)
 */
export const CHECK_GROUPS = [
  {
    title: "External vehicle condition",
    items: [
      { key: "bodywork", label: "Condition of vehicle bodywork, windshield, windows, lights" },
      { key: "wiper_blades", label: "Condition of windshield wiper blades" },
      { key: "cleanliness", label: "Cleanliness of windshield, windows, mirrors, lights, license plate" },
      { key: "tires", label: "Condition of tires" },
      { key: "spare_wheel_jack", label: "Availability of spare wheel & jack" },
    ],
  },
  {
    title: "Fluids",
    items: [
      { key: "engine_oil", label: "Engine oil level" },
      { key: "coolant", label: "Coolant level" },
      { key: "washer_fluid", label: "Windshield wash level" },
      { key: "leaks", label: "Oil or waste leaks" },
    ],
  },
  {
    title: "Vehicle interior and equipment",
    items: [
      { key: "seatbelts", label: "Condition & function of seatbelts" },
      { key: "head_restraints", label: "Head restraint adjustment" },
      { key: "mirrors", label: "Mirror adjustment" },
      { key: "first_aid_kit", label: "First aid kit" },
      { key: "fire_extinguisher", label: "Fire extinguisher" },
      { key: "warning_triangles", label: "Warning triangles" },
      { key: "logbook", label: "Vehicle logbook" },
    ],
  },
  {
    title: "Function checks before starting the journey",
    items: [
      { key: "lights", label: "All lights" },
      { key: "horn", label: "Horn" },
      { key: "washers_wipers", label: "Washers & wipers" },
      { key: "brakes", label: "Brakes" },
    ],
  },
];

/** All items of the checklist in one list. */
export const CHECK_ITEMS = CHECK_GROUPS.flatMap((group) => group.items);

export const CONFIRMATION = "All the items above have been checked and any defects and omissions reported.";

const RESULT_MARKS = { ok: "[OK]", defect: "[X ]" };
const UNSAFE_NAME = /[\\/:*?"<>|]/g;

/**
 * Makes the label of a checklist item from its key. An unknown key stays as it is.
 * @param {string} key
 * @returns {string}
 * @standard unknown - A key that is not in the checklist gives the key.
 */
export const labelOf = (key) => CHECK_ITEMS.find((item) => item.key === key)?.label ?? key;

/**
 * Makes the title of the checklist document: the make of the vehicle, the plate and the date.
 * @param {object} vehicle - A row of the vehicles table.
 * @param {string} date - The date of the check, YYYY-MM-DD.
 * @returns {string}
 * @standard parts - The title is the make, the plate and the date, with one space between them.
 * @standard fallback - Without a make, the title has the model. Without a model, it has the unit number.
 */
export const makeCheckTitle = (vehicle, date) =>
  [vehicle.make || vehicle.model || vehicle.unit_number, vehicle.plate, date].filter((part) => part !== null && part !== undefined && part !== "").join(" ");

/**
 * Makes the file name of the checklist document from its title.
 * @param {string} title
 * @returns {string}
 * @standard safe - The characters that a file system refuses become "-". The name ends with ".pdf".
 */
export const makeCheckFileName = (title) => `${title.replace(UNSAFE_NAME, "-")}.pdf`;

/**
 * Reads the results of a check from the values of a form. Each item field holds "ok", "defect" or an empty text.
 * @param {object} form - Field names and their text values.
 * @returns {object}
 * @standard chosen - The result has only the items with "ok" or "defect". An empty field is not in the result.
 */
export const readCheckResults = (form) =>
  Object.fromEntries(CHECK_ITEMS.map((item) => [item.key, form[`item_${item.key}`]]).filter(([, value]) => value === "ok" || value === "defect"));

/**
 * Finds the items with a defect that have no open fault on the vehicle. Each of them needs a new fault.
 * @param {object} results - The results of a check.
 * @param {object[]} openFaults - The open faults of the same vehicle.
 * @returns {string[]}
 * @standard new - An item with "defect" is in the result only if no open fault has the same item.
 */
export const findNewFaults = (results, openFaults) =>
  Object.entries(results)
    .filter(([key, value]) => value === "defect" && !openFaults.some((fault) => fault.item === key))
    .map(([key]) => key);

/**
 * @uses RESULT_MARKS
 * @usedby describeGroup
 */
const describeItem = (item, results) => `${RESULT_MARKS[results[item.key]] ?? "[  ]"} ${item.label}`;

/**
 * @uses describeItem
 * @usedby makeCheckLines
 */
const describeGroup = (group, results) => ["", group.title.toUpperCase(), ...group.items.map((item) => describeItem(item, results))];

/**
 * @uses labelOf
 * @usedby makeCheckLines
 */
const describeFault = (fault) =>
  `${fault.reportedText}  ${fault.description}${fault.item === null ? "" : ` (${labelOf(fault.item)})`}  Photos: ${fault.photoCount}`;

/**
 * Makes the lines of the checklist document of one check.
 * @param {string} title - The title from makeCheckTitle.
 * @param {{ check: object, vehicle: object, faults: object[], driver: string }} records - The faults have reportedText and photoCount.
 * @returns {string[]}
 * @standard items - The document has each item of the checklist, in the sequence of the paper form, with [OK], [X ] or [  ].
 * @standard faults - The document lists each open fault of the vehicle.
 * @uses describeGroup, CHECK_GROUPS, CONFIRMATION, describeFault
 */
export const makeCheckLines = (title, records) => [
  "MINHAS SASK DAILY VEHICLE CHECKLIST",
  title,
  "",
  `Vehicle: ${[records.vehicle.make, records.vehicle.model, records.vehicle.unit_number].filter(Boolean).join(" ")}`,
  `License plate #: ${records.vehicle.plate ?? ""}    Date: ${records.check.checked_on}`,
  `Driver: ${records.driver}`,
  "[OK] = satisfactory/available    [X ] = defective/missing    [  ] = not checked",
  ...CHECK_GROUPS.flatMap((group) => describeGroup(group, records.check.results)),
  "",
  `${records.check.all_checked ? "[OK]" : "[  ]"} ${CONFIRMATION}`,
  `Notes: ${records.check.notes ?? ""}`,
  "",
  `Open faults of the vehicle: ${records.faults.length}`,
  ...records.faults.map(describeFault),
];
