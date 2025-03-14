import path from "node:path";

/**
 * Check if it is url
 *
 * @param {string} uri
 * @returns true if it is url otherwise false
 */
export function isUrl(uri) {
  return /^https?:\/\//.test(uri);
}

/**
 * Get current local date time
 * @returns date time string
 */
export function getDateTimeNow() {
  return new Date().toLocaleString();
}

/**
 * Log with current local date time
 * @param {string} message
 * @returns string with current date time and message
 */
export function dateTimeLog(message) {
  return `${getDateTimeNow()}: ${message}`;
}

export function isValidFileExtension(filePath, validExtensions = []) {
  const fileExt = path.basename(filePath).split(".").pop();
  if (fileExt) {
    return validExtensions.includes(fileExt.toLowerCase());
  }
  return false;
}
