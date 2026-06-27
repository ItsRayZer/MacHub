export const sanitizePercentage = (raw) => {
  if (raw === undefined || raw === null) return 0;
  const cleaned = String(raw).replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};
