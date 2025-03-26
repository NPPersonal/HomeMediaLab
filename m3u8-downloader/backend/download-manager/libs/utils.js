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
