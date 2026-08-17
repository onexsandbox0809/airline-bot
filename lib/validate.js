const SUPPORTED_CABIN_CLASSES = ['ECONOMY', 'BUSINESS'];

function isValidDateString(s) {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}

function isPastDate(dateStr) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const d = new Date(`${dateStr}T00:00:00Z`);
  return d.getTime() < today.getTime();
}

function isValidCabinClass(cc) {
  return SUPPORTED_CABIN_CLASSES.includes((cc || '').toUpperCase());
}

function isValidPassengerCount(n) {
  const num = Number(n);
  return Number.isInteger(num) && num >= 1 && num <= 9;
}

module.exports = {
  SUPPORTED_CABIN_CLASSES,
  isValidDateString,
  isPastDate,
  isValidCabinClass,
  isValidPassengerCount,
};
