// Shared text/query helpers.

// Normalizes Arabic text for searching: strips diacritics/tatweel, unifies alef/yaa/taa-marbuta/hamza
// forms, collapses whitespace and lowercases. Used for every normalizedTitle / normalizedName field,
// so records created anywhere in the app can be found by the same search.
function normalizeArabicText(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[آأإا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ٕٔ]/g, '')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ء/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Escapes regex special characters so user input is matched literally (and can't cause ReDoS).
function escapeRegex(str = '') {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Parses ?page=&limit= into safe integers. `limit` is capped so a single request can't dump a collection.
function parsePagination(query, { defaultLimit = 10, maxLimit = 100 } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

// Case-insensitive "contains" filter on the display field and its normalized twin.
function buildNameSearch(search, field, normalizedField) {
  if (!search) return {};
  return {
    $or: [
      { [field]: { $regex: escapeRegex(search), $options: 'i' } },
      { [normalizedField]: { $regex: escapeRegex(normalizeArabicText(search)), $options: 'i' } }
    ]
  };
}


// Location values were typed with both digit systems ("11" and "١١"). Returns every spelling of a
// value so an exact location filter matches both: the value as typed, Latin digits, Arabic-Indic digits.
const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
function toLatinDigits(str = '') {
  return String(str).replace(/[٠-٩]/g, d => String(ARABIC_INDIC.indexOf(d)));
}
function digitVariants(value) {
  const raw = String(value ?? '').trim();
  const latin = toLatinDigits(raw);
  const arabic = latin.replace(/[0-9]/g, d => ARABIC_INDIC[Number(d)]);
  return [...new Set([raw, latin, arabic])];
}

module.exports = { normalizeArabicText, escapeRegex, parsePagination, buildNameSearch, toLatinDigits, digitVariants };
