// Results: a record that a stage of the data flow makes.

/**
 * A ZipEntry is a result that holds one file of the export archive.
 * @typedef {object} ZipEntry
 * @property {string} path - The path of the file in the archive.
 * @property {Uint8Array} bytes - The content of the file.
 * @madeby readExportEntries, makeCsvEntry, makePhotoEntry
 * @readby makeArchive
 */

export {};
