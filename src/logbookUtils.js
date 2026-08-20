export function sortLogbookEntries(entries) {
  return [...entries].sort((left, right) => {
    const dateOrder = String(right.date || "").localeCompare(String(left.date || ""));
    if (dateOrder !== 0) return dateOrder;
    return String(right.updatedAt || right.createdAt || right.id || "")
      .localeCompare(String(left.updatedAt || left.createdAt || left.id || ""));
  });
}

export function getLatestProcedureDate(procedureId, logbook) {
  let latestDate = "";
  for (const entry of logbook) {
    const procedureIds = entry.procedureIds
      || [entry.procedureId, entry.procedureId2, entry.procedureId3].filter(Boolean);
    if (procedureIds.includes(procedureId) && String(entry.date || "") > latestDate) {
      latestDate = String(entry.date);
    }
  }
  return latestDate;
}
