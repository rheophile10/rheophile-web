const MAX_SIDE = 1200;

/**
 * Makes the size of a photo after the resize. The long side becomes 1200 px at most. A small photo stays.
 * @param {number} width
 * @param {number} height
 * @returns {{ width: number, height: number }}
 * @standard limit - The long side of the result is 1200 px or less, and the shape stays.
 * @uses MAX_SIDE
 * @usedby resizePhoto (web/app.edge.mjs)
 */
export const fitWithin = (width, height) => {
  // The scale is 1 for a small photo. A large photo gets a scale below 1.
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
};

/**
 * Makes the path of a photo in the bucket: the company, the table, the record and a unique file name.
 * @param {string} companyId
 * @param {{ table: string, id: string }} subject - The record that the photo belongs to.
 * @param {string} stamp - A unique text, for example the time in milliseconds.
 * @returns {string}
 * @standard folders - The path starts with the company id, because the storage policies look at the first folder.
 * @usedby addPhoto (web/app.edge.mjs)
 */
export const makePhotoPath = (companyId, subject, stamp) => `${companyId}/${subject.table}/${subject.id}/${stamp}.jpg`;
