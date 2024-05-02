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
