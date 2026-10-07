// A small PDF writer: pages of text lines in Courier. Enough for a log that a person prints.
import { strToU8 } from "fflate";

const LINES_PER_PAGE = 60;
const FONT_SIZE = 10;
const LINE_HEIGHT = 12;

/**
 * @usedby makeStream
 */
const escapeText = (line) => line.replace(/[^\x20-\x7e]/g, "?").replace(/[\\()]/g, (char) => `\\${char}`);

/**
 * @usedby makePdf
 */
const chunk = (lines, size) =>
  lines.reduce((pages, line, index) => (index % size === 0 ? [...pages, [line]] : [...pages.slice(0, -1), [...pages.at(-1), line]]), []);

/**
 * @uses escapeText, FONT_SIZE, LINE_HEIGHT
 * @usedby makePageObjects
 */
const makeStream = (lines) => {
  // Each line shows at the next line position. The text starts near the top left corner.
  const text = lines.map((line) => `(${escapeText(line)}) '`).join("\n");
  const content = `BT /F1 ${FONT_SIZE} Tf ${LINE_HEIGHT} TL 40 800 Td\n${text}\nET`;
  return `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
};

/**
 * @uses makeStream
 * @usedby makePdf
 */
const makePageObjects = (pageLines, index) => {
  // Objects 1 to 3 are the catalog, the page list and the font. Each page takes two objects after them.
  const pageNumber = 4 + index * 2;
  const page = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageNumber + 1} 0 R >>`;
  return [page, makeStream(pageLines)];
};

/**
 * @usedby makePdf
 */
const makeObject = (body, index) => `${index + 1} 0 obj\n${body}\nendobj\n`;

/**
 * @usedby makePdf
 */
const makeOffsets = (objects, header) =>
  objects.reduce((offsets, object) => [...offsets, offsets.at(-1) + object.length], [header.length]);

/**
 * @usedby makePdf
 */
const makeXref = (offsets) =>
  ["xref", `0 ${offsets.length}`, "0000000000 65535 f ", ...offsets.slice(0, -1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `)].join("\n");

/**
 * Makes a PDF file with the lines of text, 60 lines on each page.
 * @param {string[]} lines
 * @returns {Uint8Array}
 * @standard text - A PDF reader shows each line, in sequence.
 * @standard pages - Each 60 lines make one page. No lines make one empty page.
 * @uses chunk, LINES_PER_PAGE, makePageObjects, makeObject, makeOffsets, makeXref
 * @usedby makeVehicleLog (web/app.edge.mjs)
 */
export const makePdf = (lines) => {
  // The pages hold the lines in groups.
  const pages = chunk(lines.length === 0 ? [""] : lines, LINES_PER_PAGE);
  const pageRefs = pages.map((page, index) => `${4 + index * 2} 0 R`).join(" ");
  // The fixed objects, then the pages with their content streams.
  const bodies = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageRefs}] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
    ...pages.flatMap(makePageObjects),
  ];
  const objects = bodies.map(makeObject);
  // The cross-reference table needs the byte offset of each object. All text is ASCII, thus the length is the byte count.
  const header = "%PDF-1.4\n";
  const offsets = makeOffsets(objects, header);
  const trailer = `trailer\n<< /Size ${bodies.length + 1} /Root 1 0 R >>\nstartxref\n${offsets.at(-1)}\n%%EOF\n`;
  return strToU8([header, ...objects, makeXref(offsets), "\n", trailer].join(""));
};
