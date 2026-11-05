/**
 * N.S. Construction enquiry sync endpoint.
 * Deploy as a Google Apps Script Web App (execute as you, access: anyone).
 * Set Script Property NS_WEBHOOK_SECRET before deploying.
 */
function doPost(e) {
  let payload;
  try {
    payload = JSON.parse((e.postData && e.postData.contents) || "{}");
  } catch (_error) {
    return json({ ok: false, error: "Invalid JSON payload" });
  }

  const expected = PropertiesService.getScriptProperties().getProperty("NS_WEBHOOK_SECRET");
  if (!expected || payload.secret !== expected) return json({ ok: false, error: "Unauthorized" });
  if (payload.event === "integration.test") return json({ ok: true, test: true });
  if (payload.event !== "enquiry.created" || !payload.enquiry || !payload.enquiry.id) {
    return json({ ok: false, error: "Unsupported event" });
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName("Enquiries") || spreadsheet.insertSheet("Enquiries");
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "Enquiry ID", "Created At", "Name", "Phone", "Email", "Project Type", "Location",
      "Area", "Floors", "Budget", "Services", "Timeline", "Message", "Source"
    ]);
  }

  const enquiry = payload.enquiry;
  const existingIds = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat()
    : [];
  if (existingIds.includes(enquiry.id)) return json({ ok: true, duplicate: true });

  const safeCell = (value) => {
    const text = String(value == null ? "" : value);
    return /^[=+@\-\t\r]/.test(text) ? "'" + text : text;
  };
  sheet.appendRow([
    enquiry.id,
    enquiry.createdAt || new Date().toISOString(),
    safeCell(enquiry.name), safeCell(enquiry.phone), safeCell(enquiry.email),
    safeCell(enquiry.projectType), safeCell(enquiry.location), safeCell(enquiry.projectArea),
    safeCell(enquiry.floors), safeCell(enquiry.budget), safeCell((enquiry.services || []).join(", ")),
    safeCell(enquiry.timeline), safeCell(enquiry.message), safeCell(enquiry.source || "Website")
  ]);
  return json({ ok: true });
}

function json(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
