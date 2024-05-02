/**
 * Parse string to date (or arrays of strings)
 */
export function parseDate(str) {
  if (Array.isArray(str)) {
    return str.map((s) => parseDate(s));
  }

  if (str) {
    const date = new Date(str);
    if (!date.getTime()) {
      throw new Error(`Invalid date input: ${str}`);
    }
    return date;
  }

  return null;
}
