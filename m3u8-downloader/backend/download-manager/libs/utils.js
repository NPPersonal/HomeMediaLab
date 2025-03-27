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
 *
 * @returns date time string
 */
export function getDateTimeNow() {
  return new Date().toLocaleString();
}

/**
 * Create a log which concatenent current local date time with message
 *
 * @param {string} message the message to be logged
 * @returns string in format `[current date time]: [message]`
 */
export function dateTimeLog(message) {
  return `${getDateTimeNow()}: ${message}`;
}

/**
 * Check file path is valid
 *
 * @param {string} filePath
 * @param {string[]} validExtensions valid file extension e.g .mp4, .mp3
 * @returns
 */
export function isValidFileExtension(filePath, validExtensions = []) {
  const fileExt = path.extname(filePath);
  return validExtensions.includes(fileExt.toLowerCase());
}

/**
 * Get base url
 *
 * example: https://abc/123/index.html => https://abc/123/
 *
 * example: https://abc/123/ => https://abc/123/
 *
 * @param {string} url
 * @returns base url **include last forward slash(/)**
 */
export function getBaseURL(url) {
  // +1 include last forward slash(/)
  return url.slice(0, url.lastIndexOf("/") + 1);
}

/**
 * Combine url
 *
 * https://abc/ddd + aaa/ddd/ => https://abc/ddd/aaa/ddd/
 *
 * https://abc/ddd/ + /aaa/ddd/ => https://abc/ddd/aaa/ddd/
 *
 * https://abc/ddd + /aaa/ddd/ => https://abc/ddd/aaa/ddd/
 *
 * @param {string} base base url e.g https://abc/ddd
 * @param {string} url relative url e.g /aaa/ddd/
 * @returns URL
 */
export function combineURL(base, url) {
  if (base.slice(-1) === "/" && url.slice(0, 1) === "/") {
    return new URL(url.slice(1), base);
  } else if (base.slice(-1) !== "/" && url.slice(0, 1) === "/") {
    return new URL(`/${url}`, base);
  } else {
    return new URL(url, base);
  }
}
