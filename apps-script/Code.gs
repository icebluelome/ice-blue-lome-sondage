/**
 * Ice Blue Lomé — collecteur Google Sheets + statistiques privées.
 * À coller dans Extensions > Apps Script depuis le Google Sheet de destination.
 */

const SHEET_NAME = "Réponses";
const LIST_SEPARATOR = " || ";
const HEADERS = [
  "Horodatage",
  "Identifiant",
  "Prénom",
  "Tranche d’âge",
  "Fréquence",
  "Parfums",
  "Autre parfum",
  "Mélanges",
  "Autre mélange",
  "Toppings",
  "Autre topping",
  "Sauces",
  "Autre sauce",
  "Suggestion",
  "Source",
];

/**
 * À exécuter une seule fois depuis l’éditeur Apps Script.
 * Crée l’onglet et génère le code secret du tableau de bord.
 */
function installer() {
  const sheet = getSheet_();
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold").setBackground("#075ee8").setFontColor("#ffffff");
  sheet.autoResizeColumns(1, HEADERS.length);

  const properties = PropertiesService.getScriptProperties();
  let adminKey = properties.getProperty("ADMIN_KEY");
  if (!adminKey) {
    adminKey = Utilities.getUuid().replace(/-/g, "");
    properties.setProperty("ADMIN_KEY", adminKey);
  }

  console.log("CODE ADMIN À CONSERVER : " + adminKey);
  return "Installation terminée. Consultez le journal d’exécution pour copier le code admin.";
}

/** Génère un nouveau code et invalide immédiatement l’ancien. */
function genererNouveauCodeAdmin() {
  const adminKey = Utilities.getUuid().replace(/-/g, "");
  PropertiesService.getScriptProperties().setProperty("ADMIN_KEY", adminKey);
  console.log("NOUVEAU CODE ADMIN À CONSERVER : " + adminKey);
  return "Nouveau code généré. Consultez le journal d’exécution.";
}

function doPost(e) {
  try {
    const raw = e && e.parameter ? e.parameter.payload : "";
    const payload = JSON.parse(raw || "{}");
    validatePayload_(payload);

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sheet = getSheet_();
      const submissionId = cleanText_(payload.submissionId, 100) || Utilities.getUuid();
      if (isDuplicate_(sheet, submissionId)) {
        return jsonOutput_({ ok: true, duplicate: true });
      }

      sheet.appendRow([
        new Date(),
        safeCell_(submissionId),
        safeCell_(cleanText_(payload.firstName, 80)),
        safeCell_(cleanText_(payload.ageRange, 50)),
        safeCell_(cleanText_(payload.frequency, 80)),
        safeCell_(cleanList_(payload.flavors).join(LIST_SEPARATOR)),
        safeCell_(cleanText_(payload.otherFlavor, 120)),
        safeCell_(cleanList_(payload.mixes).join(LIST_SEPARATOR)),
        safeCell_(cleanText_(payload.otherMix, 160)),
        safeCell_(cleanList_(payload.toppings).join(LIST_SEPARATOR)),
        safeCell_(cleanText_(payload.otherTopping, 160)),
        safeCell_(cleanList_(payload.sauces).join(LIST_SEPARATOR)),
        safeCell_(cleanText_(payload.otherSauce, 160)),
        safeCell_(cleanText_(payload.suggestion, 500)),
        safeCell_(cleanText_(payload.source, 300)),
      ]);
    } finally {
      lock.releaseLock();
    }

    return jsonOutput_({ ok: true });
  } catch (error) {
    console.error(error);
    return jsonOutput_({ ok: false, error: "Réponse non enregistrée" });
  }
}

function doGet(e) {
  const params = (e && e.parameter) || {};
  const callback = validCallback_(params.callback);
  let result;

  if (params.action === "health") {
    result = { ok: true, service: "Ice Blue Lomé", configured: Boolean(PropertiesService.getScriptProperties().getProperty("ADMIN_KEY")) };
  } else if (params.action === "stats") {
    const expected = PropertiesService.getScriptProperties().getProperty("ADMIN_KEY");
    if (!expected || !secureEquals_(String(params.key || ""), expected)) {
      result = { ok: false, error: "Accès refusé" };
    } else {
      result = buildStats_();
    }
  } else {
    result = { ok: false, error: "Action inconnue" };
  }

  return callback ? jsonpOutput_(callback, result) : jsonOutput_(result);
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error("Ce script doit être créé depuis un Google Sheet.");
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  return sheet;
}

function validatePayload_(payload) {
  const hasChoice = (list, other) => cleanList_(list).length > 0 || cleanText_(other, 160).length > 0;
  if (!hasChoice(payload.flavors, payload.otherFlavor)) throw new Error("Parfum manquant");
  if (!hasChoice(payload.mixes, payload.otherMix)) throw new Error("Mélange manquant");
  if (!hasChoice(payload.toppings, payload.otherTopping)) throw new Error("Topping manquant");
  if (!hasChoice(payload.sauces, payload.otherSauce)) throw new Error("Sauce manquante");
}

function isDuplicate_(sheet, submissionId) {
  if (sheet.getLastRow() < 2) return false;
  return Boolean(sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).createTextFinder(submissionId).matchEntireCell(true).findNext());
}

function buildStats_() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return emptyStats_();
  }

  const rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues().filter((row) => row[0] || row[1]);
  const total = rows.length;
  const buckets = { flavors: {}, mixes: {}, toppings: {}, sauces: {} };
  const suggestions = [];
  const dates = [];

  rows.forEach((row) => {
    if (row[0] instanceof Date && !isNaN(row[0])) dates.push(row[0]);
    addSelections_(buckets.flavors, row[5], row[6]);
    addSelections_(buckets.mixes, row[7], row[8]);
    addSelections_(buckets.toppings, row[9], row[10]);
    addSelections_(buckets.sauces, row[11], row[12]);
    const suggestion = cleanText_(row[13], 500);
    if (suggestion) suggestions.push(suggestion);
  });

  dates.sort((a, b) => a.getTime() - b.getTime());
  return {
    ok: true,
    total: total,
    generatedAt: new Date().toISOString(),
    periodStart: dates.length ? dates[0].toISOString() : null,
    periodEnd: dates.length ? dates[dates.length - 1].toISOString() : null,
    lastResponseAt: dates.length ? dates[dates.length - 1].toISOString() : null,
    categories: {
      flavors: finalizeBucket_(buckets.flavors, total),
      mixes: finalizeBucket_(buckets.mixes, total),
      toppings: finalizeBucket_(buckets.toppings, total),
      sauces: finalizeBucket_(buckets.sauces, total),
    },
    suggestions: suggestions.reverse().slice(0, 30),
  };
}

function emptyStats_() {
  return {
    ok: true,
    total: 0,
    generatedAt: new Date().toISOString(),
    periodStart: null,
    periodEnd: null,
    lastResponseAt: null,
    categories: { flavors: [], mixes: [], toppings: [], sauces: [] },
    suggestions: [],
  };
}

function addSelections_(bucket, listValue, otherValue) {
  const unique = {};
  String(listValue || "").split(LIST_SEPARATOR).map((value) => value.trim()).filter(Boolean).forEach((value) => { unique[value] = true; });
  const other = cleanText_(otherValue, 160);
  if (other) unique["Autre — " + other] = true;
  Object.keys(unique).forEach((label) => { bucket[label] = (bucket[label] || 0) + 1; });
}

function finalizeBucket_(bucket, total) {
  return Object.keys(bucket)
    .map((label) => ({ label: label, count: bucket[label], percentage: total ? Math.round((bucket[label] / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function cleanList_(value) {
  if (!Array.isArray(value)) return [];
  const unique = {};
  value.slice(0, 20).forEach((item) => {
    const cleaned = cleanText_(item, 120);
    if (cleaned) unique[cleaned] = true;
  });
  return Object.keys(unique);
}

function cleanText_(value, maxLength) {
  return String(value == null ? "" : value).replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function safeCell_(value) {
  const text = String(value || "");
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function secureEquals_(provided, expected) {
  if (provided.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < provided.length; index += 1) mismatch |= provided.charCodeAt(index) ^ expected.charCodeAt(index);
  return mismatch === 0;
}

function validCallback_(value) {
  const callback = String(value || "");
  return /^[A-Za-z_$][0-9A-Za-z_$]{0,80}$/.test(callback) ? callback : "";
}

function jsonOutput_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function jsonpOutput_(callback, data) {
  return ContentService.createTextOutput(callback + "(" + JSON.stringify(data) + ");").setMimeType(ContentService.MimeType.JAVASCRIPT);
}
