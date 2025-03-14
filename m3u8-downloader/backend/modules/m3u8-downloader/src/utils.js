import axios from "axios";

/**
 * Check if it is url
 *
 * @param {string} uri
 * @returns true if it is url otherwise false
 */
export function isUrl(uri) {
  return /^https?:\/\//.test(uri);
}
