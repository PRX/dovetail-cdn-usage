const log = require("lambda-log");

const IGNORE_PATHS = [/^$/, /^favicon\.ico$/, /^robots.txt$/];
const IGNORE_BYTES_UNDER = 10000;

/**
 * Parse string to date array
 */
exports.parseDate = (str) => {
  if (str) {
    const date = new Date(str);
    if (!date.getTime()) {
      throw new Error(`Invalid date input: ${str}`);
    }
    return date;
  }

  return null;
};

/**
 * Get an array of dates to process, from a start date
 */
exports.daysToProcess = (startDate) => {
  const maxDays = parseInt(process.env.MAX_DAYS_TO_ROLLUP, 10) || 1;
  const firstDay = new Date(startDate);
  firstDay.setUTCHours(0, 0, 0, 0);

  const days = [firstDay];
  for (let i = 1; i < maxDays; i += 1) {
    const next = new Date(firstDay);
    next.setDate(next.getDate() + i);
    if (next <= new Date()) {
      days.push(next);
    }
  }
  return days;
};

/**
 * Time how long a function takes to execute
 */
exports.elapsed = async (fn) => {
  const start = Date.now();
  const result = await fn();
  return [Date.now() - start, result];
};

/**
 * Extract metadata from cdn paths. Counted paths must be one of:
 *   <feeder_podcast>/<feeder_episode>
 *   <feeder_podcast>/<feeder_feed>/<feeder_episode>
 */
exports.parseUsage = (dayDate, rows) => {
  const day = dayDate.toISOString().split("T").shift();
  const usage = [];
  const unknowns = {};

  // parse paths
  for (const row of rows) {
    const uri = row[0];
    const parts = uri.split("/");
    const bytes = parseInt(row[1], 10);

    if (parts[0].match(/^[0-9]+$/)) {
      /* eslint-disable camelcase */
      const feeder_podcast = parseInt(parts[0], 10);
      const feeder_feed = parts[1];
      const feeder_episode = parts[parts.length - 1];
      if (parts.length === 2) {
        usage.push({ feeder_podcast, feeder_episode, bytes, day });
      } else if (parts.length === 3) {
        usage.push({ feeder_podcast, feeder_feed, feeder_episode, bytes, day });
      } else {
        unknowns[feeder_podcast] = (unknowns[feeder_podcast] || 0) + bytes;
      }
      /* eslint-enable camelcase */
    } else {
      const ignored = IGNORE_PATHS.find((r) => r.test(uri));
      if (bytes >= IGNORE_BYTES_UNDER && !ignored) {
        log.warn(`unrecognized uri: '${uri}' (${bytes} bytes)`);
      }
    }
  }

  // insert null feeder_episodes for unknown paths under a podcast_id
  for (const podcastStr in unknowns) {
    if (Object.hasOwn(unknowns, podcastStr)) {
      /* eslint-disable camelcase */
      const feeder_podcast = parseInt(podcastStr, 10);
      const bytes = unknowns[feeder_podcast];
      usage.push({ feeder_podcast, bytes, day });
      /* eslint-enable camelcase */
    }
  }

  return usage;
};
