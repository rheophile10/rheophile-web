// The rows of the catalog: products and prices from a price list, invoices and shelf labels.

const CENTS = 100;

/**
 * Rounds a value to two decimals, for a price per unit.
 * @param {number} value
 * @returns {number}
 * @standard cents - The result has no more than two decimals.
 * @uses CENTS
 * @usedby makePrice, makeLinePrice
 */
export const roundMoney = (value) => Math.round(value * CENTS) / CENTS;

/**
 * Makes the id of a product in one volume: the base id and the volume, or "pack" without a volume.
 * @param {string} base
 * @param {number | null} volumeMl
 * @returns {string}
 * @standard pack - Without a volume, the id ends with "pack".
 * @usedby makeProduct
 */
export const makeProductId = (base, volumeMl) => `${base}-${volumeMl === null ? "pack" : volumeMl}`;

/**
 * @uses makeProductId
 * @usedby expandCell, expandExtra
 */
const makeProduct = (list, item, size) => ({
  id: makeProductId(item.id, size.volumeMl),
  sku: null,
  producer: list.producer,
  name: item.name,
  category: item.category ?? size.category,
  volume_ml: size.volumeMl,
  container: size.container,
  material: size.material ?? item.material ?? null,
  alcohol_percent: item.alcohol ?? null,
  note: item.note ?? null,
});

/**
 * @uses roundMoney
 * @usedby expandCell, expandExtra
 */
const makePrice = (list, productId, size) => ({
  id: "",
  product_id: productId,
  price_kind: "wholesale",
  origin_kind: "pricelist",
  document_id: list.document,
  observed_on: list.effectiveOn,
  customer_id: null,
  case_size: size.caseSize,
  case_price: size.casePrice,
  unit_price: size.caseSize === null ? null : roundMoney(size.casePrice / size.caseSize),
  deposit_per_unit: null,
  note: size.note ?? null,
});

/**
 * @usedby expandCell
 */
const sizeOfCell = (column, cell, category) => {
  // A number is a case price in the column. An object can replace the case size and the material.
  const given = typeof cell === "number" ? { casePrice: cell } : cell;
  return { ...column, category, ...given };
};

/**
 * @uses sizeOfCell, makeProduct, makePrice
 * @usedby expandItem
 */
const expandCell = (list, item, section) => (cell, index) => {
  // An empty cell gives no rows.
  if (cell === null) return { products: [], prices: [] };
  // A cell gives one product and one price.
  const size = sizeOfCell(section.columns[index], cell, section.category);
  const product = makeProduct(list, item, size);
  return { products: [product], prices: [makePrice(list, product.id, size)] };
};

/**
 * @uses makeProduct, makePrice
 * @usedby expandItem
 */
const expandExtra = (list, item, category) => (extra) => {
  // A size in the parentheses of a row gives one product and one price.
  const product = makeProduct(list, item, { ...extra, category });
  return { products: [product], prices: [makePrice(list, product.id, extra)] };
};

/**
 * @usedby expandItem, expandSection, expandPriceList
 */
const joinRows = (parts) => ({
  products: parts.flatMap((part) => part.products),
  prices: parts.flatMap((part) => part.prices),
});

/**
 * @uses joinRows, expandCell, expandExtra
 * @usedby expandSection
 */
const expandItem = (list, section) => (item) =>
  joinRows([
    ...item.cells.map(expandCell(list, item, section)),
    ...(item.extra ?? []).map(expandExtra(list, item, section.category)),
  ]);

/**
 * @uses joinRows, expandItem
 * @usedby expandPriceList
 */
const expandSection = (list) => (section) => joinRows(section.items.map(expandItem(list, section)));

/**
 * Keeps the first row of each id. Two prices of one product in one volume share a product row.
 * @param {object[]} rows
 * @returns {object[]}
 * @standard first - The first row of an id stays. The later rows of the same id go.
 * @usedby makeTableRows (edge/catalog.edge.mjs), expandPriceList
 */
export const uniqueById = (rows) => rows.filter((row, index) => rows.findIndex((other) => other.id === row.id) === index);

/**
 * Makes the product rows and the wholesale price rows of a price list.
 * @param {object} list
 * @returns {{ products: object[], prices: object[] }}
 * @standard unit - The unit price is the case price divided by the case size, rounded to cents.
 * @standard unique - Each product in one volume has one row, also with several prices.
 * @uses joinRows, expandSection, uniqueById
 * @usedby makeTableRows (edge/catalog.edge.mjs)
 */
export const expandPriceList = (list) => {
  // Each section has its own columns. Each cell and each extra size is one price.
  const rows = joinRows(list.sections.map(expandSection(list)));
  // One product can have a price in a column and in the parentheses. The id of a price is its position in the list.
  return {
    products: uniqueById(rows.products),
    prices: rows.prices.map((price, index) => ({ ...price, id: `${list.document}-${index + 1}` })),
  };
};

/**
 * @usedby expandInvoices
 */
const makeLine = (invoice) => (line, index) => ({
  invoice_id: invoice.id,
  line_no: index + 1,
  product_id: line.product_id,
  sku: line.sku,
  description: line.description,
  units: line.units,
  cases: line.cases,
  value: line.value,
  deposit: line.deposit,
});

/**
 * @uses roundMoney
 * @usedby expandInvoices
 */
const makeLinePrice = (invoice) => (line, index) => ({
  id: `${invoice.id}-${index + 1}`,
  product_id: line.product_id,
  price_kind: "customer",
  origin_kind: "invoice",
  document_id: invoice.document_id,
  observed_on: invoice.order_date,
  customer_id: invoice.customer_id,
  case_size: line.units / line.cases,
  case_price: roundMoney(line.value / line.cases),
  unit_price: roundMoney(line.value / line.units),
  deposit_per_unit: roundMoney(line.deposit / line.units),
  note: null,
});

/**
 * @usedby expandInvoices
 */
const withoutLines = ({ lines: _lines, ...invoice }) => invoice;

/**
 * Makes the invoice rows, the line rows and the customer price rows of an invoice file.
 * @param {object} file
 * @returns {{ customers: object[], products: object[], invoices: object[], invoiceLines: object[], prices: object[], skus: object[] }}
 * @standard unit - The unit price of a line is its value divided by its units, rounded to cents.
 * @uses withoutLines, makeLine, makeLinePrice
 * @usedby makeTableRows (edge/catalog.edge.mjs)
 */
export const expandInvoices = (file) => ({
  customers: file.customers,
  products: file.products,
  invoices: file.invoices.map(withoutLines),
  invoiceLines: file.invoices.flatMap((invoice) => invoice.lines.map(makeLine(invoice))),
  prices: file.invoices.flatMap((invoice) => invoice.lines.map(makeLinePrice(invoice))),
  skus: file.invoices.flatMap((invoice) => invoice.lines.map((line) => ({ product_id: line.product_id, sku: line.sku }))),
});

/**
 * @usedby expandLabels
 */
const makeLabelPrice = (label) => (item, index) => ({
  id: `${label.document}-${index + 1}`,
  product_id: item.product_id,
  price_kind: "retail",
  origin_kind: "retail_label",
  document_id: label.document,
  observed_on: label.observed_on,
  customer_id: label.customer_id,
  case_size: 1,
  case_price: item.price,
  unit_price: item.price,
  deposit_per_unit: null,
  note: item.note ?? null,
});

/**
 * Makes the product rows and the retail price rows of a file of shelf labels.
 * @param {object} file
 * @returns {{ products: object[], prices: object[] }}
 * @standard unit - A label price is the price of one unit, with a case size of 1.
 * @uses makeLabelPrice
 * @usedby makeTableRows (edge/catalog.edge.mjs)
 */
export const expandLabels = (file) => ({
  products: file.products,
  prices: file.labels.flatMap((label) => label.items.map(makeLabelPrice(label))),
});

/**
 * Puts the SKU of the invoices on each product that has one.
 * @param {object[]} products
 * @param {object[]} skus
 * @returns {object[]}
 * @standard marked - A product with a SKU on an invoice has that SKU. The other products keep null.
 * @usedby makeTableRows (edge/catalog.edge.mjs)
 */
export const assignSkus = (products, skus) =>
  products.map((product) => ({
    ...product,
    sku: skus.find((pair) => pair.product_id === product.id)?.sku ?? product.sku,
  }));
