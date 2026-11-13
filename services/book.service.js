const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const BookModel = require('../models/book.model');
const Category = require('../models/category.model');
const Subject = require('../models/subject.model');
const Author = require('../models/author.model'); // Every person type: authors, commentators, editors, ...
const Publisher = require('../models/publisher.model');
const BulkUpdateHistory = require('../models/bulk-update-history.model');

const { normalizeArabicText, escapeRegex, digitVariants, toLatinDigits } = require('../utils/text');

const MAX_PAGE_SIZE = 500;
const BULK_UPDATE_MAX_RANGE = 5000;

// pageCount is optional but must be >= 1 (schema). Empty/invalid input means "not set" (null);
// it used to become 0, which failed validation and made the whole save fail.
function parsePageCount(value) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) || n < 1 ? null : n;
}

// Fields the client may never set directly on a book.
const PROTECTED_BOOK_FIELDS = new Set(['_id', '__v', 'createdAt', 'updatedAt', 'sortKeys', 'normalizedTitle']);

// Reference fields on a book: [Model, name field, extra filter used when finding/creating the entity].
const REFERENCE_FIELDS = {
  category: [Category, 'title'],
  subject: [Subject, 'title'],
  publishers: [Publisher, 'title'],
  authors: [Author, 'name', { type: 'author' }],
  commentators: [Author, 'name', { type: 'commentator' }],
  editors: [Author, 'name', { type: 'editor' }],
  caretakers: [Author, 'name', { type: 'caretaker' }],
  muhashis: [Author, 'name', { type: 'muhashi' }]
};

const PERSON_FIELDS = ['authors', 'editors', 'commentators', 'caretakers', 'muhashis'];
const NUMERIC_FIELDS = ['numberOfVolumes', 'numberOfFolders', 'editionNumber', 'publicationYear', 'pageCount'];

// How each searchable field is matched against a book:
//   text    - regex on a field stored on the book (normalized: compare Arabic-normalized forms)
//   ref     - the text lives in another collection; matching ids are found there first so the book
//             query is an indexed `$in` instead of a $lookup over every book
//   numeric - exact number match, regex fallback for non-numeric input
//   id      - exact match on a reference id (category/subject chosen from a list, not typed text)
//   exact   - exact match on a location value, in either digit system ("11" or "١١")
// Fields with anyField: false are only used when asked for by name, never by the "all fields" search.
const SEARCH_FIELDS = {
  title: { type: 'text', path: 'normalizedTitle', normalized: true },
  category: { type: 'ref', path: 'category', model: Category, field: 'normalizedTitle' },
  subject: { type: 'ref', path: 'subject', model: Subject, field: 'normalizedTitle' },
  publishers: { type: 'ref', path: 'publishers', model: Publisher, field: 'normalizedTitle' },
  ...Object.fromEntries(PERSON_FIELDS.map(f => [f, { type: 'ref', path: f, model: Author, field: 'normalizedName' }])),
  roomNumber: { type: 'text', path: 'address.roomNumber' },
  shelfNumber: { type: 'text', path: 'address.shelfNumber' },
  wallNumber: { type: 'text', path: 'address.wallNumber' },
  bookNumber: { type: 'text', path: 'address.bookNumber' },
  ...Object.fromEntries(NUMERIC_FIELDS.map(f => [f, { type: 'numeric', path: f }])),
  notes: { type: 'text', path: 'notes' },
  categoryId: { type: 'id', path: 'category', anyField: false },
  subjectId: { type: 'id', path: 'subject', anyField: false },
  roomExact: { type: 'exact', path: 'address.roomNumber', anyField: false },
  wallExact: { type: 'exact', path: 'address.wallNumber', anyField: false },
  shelfExact: { type: 'exact', path: 'address.shelfNumber', anyField: false }
};
const SEARCH_FIELD_ALIASES = { subcategory: 'subject' };
const ANY_FIELD_KEYS = Object.keys(SEARCH_FIELDS).filter(key => SEARCH_FIELDS[key].anyField !== false);

function searchFieldConfig(key) {
  if (typeof key !== 'string') return null;
  const name = Object.hasOwn(SEARCH_FIELD_ALIASES, key) ? SEARCH_FIELD_ALIASES[key] : key;
  return Object.hasOwn(SEARCH_FIELDS, name) ? SEARCH_FIELDS[name] : null;
}

// The books a bulk update targets: one shelf (optionally narrowed to a room and wall) and a range of
// book numbers. Shared by both bulk updates and their preview, so the preview always matches the update.
function bulkCriteriaQuery(criteria) {
  if (!criteria.shelfNumber) {
    throw new Error('Shelf number is required');
  }
  const bookNumberFrom = parseInt(criteria.bookNumberFrom, 10);
  const bookNumberTo = parseInt(criteria.bookNumberTo, 10);

  if (isNaN(bookNumberFrom) || isNaN(bookNumberTo)) {
    throw new Error('Book number range must be valid numbers');
  }
  if (bookNumberFrom > bookNumberTo) {
    throw new Error('Book number "from" must be less than or equal to "to"');
  }
  if (bookNumberTo - bookNumberFrom + 1 > BULK_UPDATE_MAX_RANGE) {
    throw new Error(`Book number range is too large (max ${BULK_UPDATE_MAX_RANGE} books per update)`);
  }

  const queryConditions = [{ 'address.shelfNumber': String(criteria.shelfNumber) }];
  if (criteria.roomNumber) {
    queryConditions.push({ 'address.roomNumber': criteria.roomNumber });
  }
  if (criteria.wallNumber) {
    queryConditions.push({ 'address.wallNumber': criteria.wallNumber });
  }
  // Explicit list of numbers: book numbers are stored as strings, so a range comparison would be wrong.
  const bookNumberStrings = [];
  for (let i = bookNumberFrom; i <= bookNumberTo; i++) {
    bookNumberStrings.push(String(i));
  }
  queryConditions.push({ 'address.bookNumber': { $in: bookNumberStrings } });
  return { $and: queryConditions };
}

// Address order: room -> shelf -> wall -> book (numbers before text), _id as a stable tiebreaker.
// Backed by the compound sortKeys index in book.model.js.
function addressSortStage(dir) {
  return {
    $sort: {
      'sortKeys.room': dir,
      'sortKeys.shelf': dir,
      'sortKeys.wall': dir,
      'sortKeys.book': dir,
      _id: dir
    }
  };
}

const LOOKUP_STAGES = [
  { $lookup: { from: 'authors', localField: 'authors', foreignField: '_id', as: 'authorData' } },
  { $lookup: { from: 'authors', localField: 'commentators', foreignField: '_id', as: 'commentatorData' } },
  { $lookup: { from: 'authors', localField: 'editors', foreignField: '_id', as: 'editorData' } },
  { $lookup: { from: 'authors', localField: 'caretakers', foreignField: '_id', as: 'caretakerData' } },
  { $lookup: { from: 'authors', localField: 'muhashis', foreignField: '_id', as: 'muhashiData' } },
  { $lookup: { from: 'publishers', localField: 'publishers', foreignField: '_id', as: 'publisherData' } },
  { $lookup: { from: 'categories', localField: 'category', foreignField: '_id', as: 'categoryData' } },
  { $lookup: { from: 'subjects', localField: 'subject', foreignField: '_id', as: 'subjectData' } }
];

// $lookup returns joined documents in no guaranteed order (and MongoDB's join strategy can change it).
// Rebuild each joined array in the order the ids are stored on the book, i.e. the order they were
// entered, matching the book detail page. Ids that no longer resolve and duplicate ids are dropped,
// exactly like $lookup itself does.
function inStoredOrder(idsField, joinedField) {
  return {
    $reduce: {
      input: { $ifNull: ['$' + idsField, []] },
      initialValue: [],
      in: {
        $let: {
          vars: {
            doc: { $first: { $filter: { input: '$' + joinedField, as: 'j', cond: { $eq: ['$$j._id', '$$this'] } } } }
          },
          in: {
            $cond: [
              { $or: [{ $eq: [{ $ifNull: ['$$doc', null] }, null] }, { $in: ['$$doc', '$$value'] }] },
              '$$value',
              { $concatArrays: ['$$value', ['$$doc']] }
            ]
          }
        }
      }
    }
  };
}

// Book list response shape.
const LIST_PROJECTION = {
  $project: {
    title: 1,
    normalizedTitle: 1,
    numberOfVolumes: 1,
    numberOfFolders: 1,
    editionNumber: 1,
    publicationYear: 1,
    pageCount: 1,
    address: 1,
    imageUrl: 1,
    authors: inStoredOrder('authors', 'authorData'),
    commentators: inStoredOrder('commentators', 'commentatorData'),
    editors: inStoredOrder('editors', 'editorData'),
    caretakers: inStoredOrder('caretakers', 'caretakerData'),
    muhashis: inStoredOrder('muhashis', 'muhashiData'),
    publishers: inStoredOrder('publishers', 'publisherData'),
    category: { $arrayElemAt: ['$categoryData', 0] },
    subject: { $arrayElemAt: ['$subjectData', 0] },
    notes: 1,
    displayAddress: {
      $let: {
        vars: {
          parts: [
            { $ifNull: ['$address.roomNumber', ''] },
            { $ifNull: ['$address.shelfNumber', ''] },
            { $ifNull: ['$address.wallNumber', ''] },
            { $ifNull: ['$address.bookNumber', ''] }
          ]
        },
        in: {
          $trim: {
            input: {
              $concat: [
                {
                  $reduce: {
                    input: '$$parts',
                    initialValue: '',
                    in: {
                      $cond: [
                        { $eq: ['$$this', ''] },
                        '$$value',
                        {
                          $cond: [
                            { $eq: ['$$value', ''] },
                            '$$this',
                            { $concat: ['$$value', ' / ', '$$this'] }
                          ]
                        }
                      ]
                    }
                  }
                },
                {
                  $cond: [
                    { $and: [{ $ifNull: ['$numberOfVolumes', false] }, { $gt: ['$numberOfVolumes', 1] }] },
                    { $concat: [', v.', { $toString: '$numberOfVolumes' }] },
                    ''
                  ]
                }
              ]
            }
          }
        }
      }
    }
  }
};

// Excel export: book fields the sheet needs, and the references joined onto them in memory.
const EXPORT_BOOK_FIELDS = {
  title: 1, numberOfVolumes: 1, numberOfFolders: 1, editionNumber: 1, publicationYear: 1, pageCount: 1,
  address: 1, notes: 1, createdAt: 1, updatedAt: 1,
  authors: 1, commentators: 1, editors: 1, caretakers: 1, muhashis: 1, publishers: 1, category: 1, subject: 1
};
// [book field, model, display field, is array]
const EXPORT_JOINS = [
  ['authors', Author, 'name', true],
  ['commentators', Author, 'name', true],
  ['editors', Author, 'name', true],
  ['caretakers', Author, 'name', true],
  ['muhashis', Author, 'name', true],
  ['publishers', Publisher, 'title', true],
  ['category', Category, 'title', false],
  ['subject', Subject, 'title', false]
];

class BookService {

  normalizeArabicText = normalizeArabicText;
  escapeRegex = escapeRegex;

  // Resolves a reference field from the client: ObjectId strings / {_id} objects are used directly,
  // names/titles are looked up by their normalized form and created if missing.
  async resolveEntity(data, Model, field, filter = {}) {
    if (!data) return null;

    const isOriginalInputArray = Array.isArray(data);
    const dataArray = isOriginalInputArray ? data : [data];
    const ids = [];

    // Determine the normalized field name
    const normalizedField = field === 'title' ? 'normalizedTitle' :
      field === 'name' ? 'normalizedName' : null;

    const findOrCreate = async (value) => {
      const query = normalizedField
        ? { [normalizedField]: normalizeArabicText(value), ...filter }
        : { [field]: value, ...filter };

      let doc = await Model.findOne(query);
      if (!doc) {
        const newDoc = { ...filter, [field]: value };
        if (normalizedField) newDoc[normalizedField] = normalizeArabicText(value);
        doc = await new Model(newDoc).save();
      }
      return doc._id;
    };

    // Sequential on purpose: the same new name twice in one array must create one record.
    for (const item of dataArray) {
      if (typeof item === 'string' && mongoose.Types.ObjectId.isValid(item.replace(/"/g, ''))) {
        ids.push(item.replace(/"/g, ''));
      } else if (typeof item === 'object' && item !== null && item._id && mongoose.Types.ObjectId.isValid(item._id)) {
        ids.push(item._id);
      } else if (typeof item === 'object' && item !== null && item[field]) {
        ids.push(await findOrCreate(item[field]));
      } else if (typeof item === 'string' && item.replace(/"/g, '')) {
        ids.push(await findOrCreate(item.replace(/"/g, '')));
      }
    }

    return isOriginalInputArray ? ids : ids[0];
  }

  // Resolves every reference field present in bookData, in parallel (fields are independent).
  async resolveReferences(bookData) {
    const entries = Object.entries(REFERENCE_FIELDS).filter(([key]) => bookData[key]);
    const values = await Promise.all(entries.map(([key, [Model, field, filter]]) =>
      this.resolveEntity(bookData[key], Model, field, filter)));
    return Object.fromEntries(entries.map(([key], i) => [key, values[i]]));
  }

  async createBook(bookData) {
    const refs = await this.resolveReferences(bookData);

    const bookObj = {
      title: bookData.title,
      normalizedTitle: normalizeArabicText(bookData.title),
      authors: refs.authors ?? null,
      commentators: refs.commentators ?? null,
      editors: refs.editors ?? null,
      caretakers: refs.caretakers ?? null,
      muhashis: refs.muhashis ?? null,
      category: refs.category ?? null,
      subject: refs.subject ?? null,
      publishers: refs.publishers ?? null,
      numberOfVolumes: bookData.numberOfVolumes,
      numberOfFolders: bookData.numberOfFolders,
      editionNumber: bookData.editionNumber,
      publicationYear: bookData.publicationYear,
      pageCount: parsePageCount(bookData.pageCount) ?? undefined,
      address: {
        roomNumber: bookData.address?.roomNumber,
        shelfNumber: bookData.address?.shelfNumber,
        wallNumber: bookData.address?.wallNumber,
        bookNumber: bookData.address?.bookNumber
      },
      imageUrl: bookData.imagePath || '',
      notes: bookData.notes || ''
    };

    const book = new BookModel(bookObj);
    await book.save();
    return this.getBookById(book._id);
  }

  async updateBook(id, bookData) {
    const updatePayload = { ...bookData };

    // Never let the client overwrite system-managed fields or inject update operators.
    for (const key of Object.keys(updatePayload)) {
      if (key.startsWith('$') || PROTECTED_BOOK_FIELDS.has(key)) delete updatePayload[key];
    }

    if (bookData.title) {
      updatePayload.normalizedTitle = normalizeArabicText(bookData.title);
    }

    if (bookData.imagePath) {
      updatePayload.imageUrl = bookData.imagePath;
    }
    delete updatePayload.imagePath;

    if (updatePayload.pageCount !== undefined) {
      updatePayload.pageCount = parsePageCount(updatePayload.pageCount); // null clears it
    }

    Object.assign(updatePayload, await this.resolveReferences(bookData));

    const updatedBook = await BookModel.findByIdAndUpdate(id, updatePayload, { new: true });
    if (!updatedBook) return null;
    return this.getBookById(updatedBook._id);
  }

  // Builds a MongoDB filter that only touches fields stored on the book itself, so it can run
  // before any $lookup. Related collections (authors, publishers, categories, subjects) are searched
  // first and turned into an indexed `$in` on the book's reference field. Returns null for "no filter".
  //   query === 'advanced' -> searchTerm is a JSON array of { field, value } (all must match)
  //   query === <field>    -> searchTerm must match that field
  //   otherwise            -> searchTerm may match any field
  async buildSearchFilter(query = '', searchTerm = '') {
    const idLookups = new Map(); // one lookup per (collection, field, pattern) per request

    const refIds = (cfg, pattern) => {
      const key = `${cfg.model.modelName}|${cfg.field}|${pattern}`;
      if (!idLookups.has(key)) {
        // Cache the promise (.exec()), not the Query: a Mongoose Query can't be awaited twice.
        idLookups.set(key, cfg.model.distinct('_id', { [cfg.field]: { $regex: pattern, $options: 'i' } }).exec());
      }
      return idLookups.get(key);
    };

    const fieldCondition = async (cfg, raw, normalized) => {
      if (cfg.type === 'id') {
        // $match in an aggregation does not cast strings to ObjectId, so cast here.
        const id = raw.trim();
        return /^[a-f\d]{24}$/i.test(id) ? { [cfg.path]: new mongoose.Types.ObjectId(id) } : { _id: null };
      }
      if (cfg.type === 'exact') {
        return { [cfg.path]: { $in: digitVariants(raw) } };
      }
      if (cfg.type === 'ref') {
        return { [cfg.path]: { $in: await refIds(cfg, escapeRegex(normalized)) } };
      }
      if (cfg.type === 'numeric') {
        const n = Number(raw);
        if (!Number.isNaN(n)) return { [cfg.path]: n };
        return { [cfg.path]: { $regex: escapeRegex(raw), $options: 'i' } };
      }
      return { [cfg.path]: { $regex: escapeRegex(cfg.normalized ? normalized : raw), $options: 'i' } };
    };

    const anyFieldCondition = async (raw) => {
      const normalized = normalizeArabicText(raw) || raw;
      const conditions = await Promise.all(
        ANY_FIELD_KEYS.map(key => fieldCondition(SEARCH_FIELDS[key], raw, normalized)));
      return { $or: conditions };
    };

    if (query === 'advanced') {
      let filters;
      try { filters = JSON.parse(searchTerm); } catch (e) { filters = []; }
      if (!Array.isArray(filters)) filters = [];

      const conditions = await Promise.all(filters.map((filter) => {
        const { field, value } = filter || {};
        const raw = String(value ?? '');
        if (field === 'all') return anyFieldCondition(raw.trim());
        const cfg = searchFieldConfig(field);
        if (cfg) return fieldCondition(cfg, raw, normalizeArabicText(raw));
        // Unknown field: match it literally if it's a plain field name, otherwise match nothing.
        if (typeof field === 'string' && /^[A-Za-z_][\w.]*$/.test(field)) {
          return { [field]: { $regex: escapeRegex(raw), $options: 'i' } };
        }
        return { _id: null };
      }));

      return conditions.length ? { $and: conditions } : null;
    }

    const raw = String(searchTerm || '').trim();
    if (!raw) return null;

    const cfg = searchFieldConfig(query);
    if (!cfg) return anyFieldCondition(raw);
    return fieldCondition(cfg, raw, normalizeArabicText(raw) || raw);
  }

  async getAllBooks(
    query = '',
    searchTerm = '',
    page = 1,
    limit = 30,
    sortDirection = 'asc',
    sort = ''
  ) {
    page = Math.max(1, Number(page) || 1);
    limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(limit) || 30));
    const sortDir = sortDirection === 'desc' ? -1 : 1;

    const filter = await this.buildSearchFilter(query, searchTerm);
    const match = filter ? [{ $match: filter }] : [];

    // Three independent queries in parallel:
    //  1. the page itself: filter -> sort (sortKeys index) -> skip/limit -> join only this page
    //  2. counts for the stat cards over the filtered set (no joins needed)
    //  3. the collection size from metadata
    const [books, statsResult, totalBooks] = await Promise.all([
      BookModel.aggregate([
        ...match,
        // 'recent' = newest additions first (ObjectIds grow with creation time); default = shelf order.
        sort === 'recent' ? { $sort: { _id: -1 } } : addressSortStage(sortDir),
        { $skip: (page - 1) * limit },
        { $limit: limit },
        ...LOOKUP_STAGES,
        LIST_PROJECTION
      ]).allowDiskUse(true),
      BookModel.aggregate([
        ...match,
        { $project: { authors: 1, publishers: 1 } },
        {
          $facet: {
            filtered: [{ $count: 'n' }],
            // Count real ids only: books with no author must not count as an extra "author".
            authors: [{ $unwind: '$authors' }, { $group: { _id: '$authors' } }, { $count: 'n' }],
            publishers: [{ $unwind: '$publishers' }, { $group: { _id: '$publishers' } }, { $count: 'n' }]
          }
        }
      ]).allowDiskUse(true),
      BookModel.estimatedDocumentCount()
    ]);

    const stats = statsResult[0] || {};
    const firstCount = (arr) => (arr && arr[0] ? arr[0].n : 0);

    return {
      books,
      totalBooks: totalBooks || 0,
      filteredCount: firstCount(stats.filtered),
      uniqueAuthors: firstCount(stats.authors),
      uniquePublishers: firstCount(stats.publishers)
    };
  }

  // Loads books for an export with their references joined in memory: one sorted book query plus
  // one query per related collection, instead of 8 $lookups for every exported book (~5x faster
  // for a full export). Joined arrays keep the stored order, like the book list.
  async findBooksForExport(filter, sortDir) {
    const books = await BookModel.aggregate([
      ...(filter ? [{ $match: filter }] : []),
      addressSortStage(sortDir),
      { $project: EXPORT_BOOK_FIELDS }
    ]).allowDiskUse(true);

    // Collect referenced ids per collection, then fetch each collection once.
    const idsByModel = new Map();
    for (const [field, Model, displayField] of EXPORT_JOINS) {
      if (!idsByModel.has(Model)) idsByModel.set(Model, { displayField, ids: new Set() });
      const { ids } = idsByModel.get(Model);
      for (const book of books) {
        const value = book[field];
        for (const id of Array.isArray(value) ? value : value ? [value] : []) ids.add(String(id));
      }
    }
    const docsByModel = new Map(await Promise.all([...idsByModel].map(async ([Model, { displayField, ids }]) => {
      const docs = await Model.find({ _id: { $in: [...ids] } }).select(displayField).lean();
      return [Model, new Map(docs.map(d => [String(d._id), d]))];
    })));

    for (const book of books) {
      for (const [field, Model, , isArray] of EXPORT_JOINS) {
        const docs = docsByModel.get(Model);
        if (isArray) {
          // Drop duplicate and unresolvable ids, as $lookup does.
          const seen = new Set();
          book[field] = (book[field] || []).map(String)
            .filter(id => docs.has(id) && !seen.has(id) && seen.add(id))
            .map(id => docs.get(id));
        } else {
          book[field] = book[field] ? docs.get(String(book[field])) : undefined;
        }
      }
    }
    return books;
  }

  async exportBooksToExcel(query = '', searchTerm = '', sortDirection = 'asc') {
    const ExcelJS = require('exceljs');
    const sortDir = sortDirection === 'desc' ? -1 : 1;

    // Same filter as the book list, so the export contains exactly what the user searched for.
    // Filter and sort run on the slim book documents first; the joins run once per exported book.
    const filter = await this.buildSearchFilter(query, searchTerm);
    const books = await this.findBooksForExport(filter, sortDir);

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('الكتب', { views: [{ rightToLeft: true }] });

    // Define headers in Arabic
    const headers = [
      'العنوان',
      'المؤلفون',
      'المحققون',
      'الشارحون',
      'من اعتنى بهم',
      'المحشي',
      'التصنيف',
      'الموضوع',
      'دور النشر',
      'عدد الأجزاء',
      'عدد المجلدات',
      'رقم الطبعة',
      'سنة الطباعة',
      'عدد الصفحات',
      'رقم الغرفة',
      'رقم الحائط',
      'رقم الرف',
      'رقم الكتاب',
      'الملاحظات',
      'تاريخ الإنشاء',
      'تاريخ التحديث'
    ];

    // Add headers
    worksheet.addRow(headers);

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, size: 12 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Helper function to format array fields
    const formatArray = (arr, field) => {
      if (!arr || !Array.isArray(arr) || arr.length === 0) return '';
      return arr.map(item => item[field] || '').filter(Boolean).join(', ');
    };

    // Helper function to format date
    const formatDate = (date) => {
      if (!date) return '';
      const d = new Date(date);
      return d.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' });
    };

    // Add data rows
    books.forEach(book => {
      worksheet.addRow([
        book.title || '',
        formatArray(book.authors, 'name'),
        formatArray(book.editors, 'name'),
        formatArray(book.commentators, 'name'),
        formatArray(book.caretakers, 'name'),
        formatArray(book.muhashis, 'name'),
        book.category?.title || '',
        book.subject?.title || '',
        formatArray(book.publishers, 'title'),
        book.numberOfVolumes || '',
        book.numberOfFolders || '',
        book.editionNumber || '',
        book.publicationYear || '',
        book.pageCount || '',
        book.address?.roomNumber || '',
        book.address?.wallNumber || '',
        book.address?.shelfNumber || '',
        book.address?.bookNumber || '',
        book.notes || '',
        formatDate(book.createdAt),
        formatDate(book.updatedAt)
      ]);
    });

    // Auto-size columns
    worksheet.columns.forEach((column, index) => {
      let maxLength = 10;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const cellValue = cell.value ? cell.value.toString() : '';
        if (cellValue.length > maxLength) {
          maxLength = cellValue.length;
        }
      });
      column.width = Math.min(Math.max(maxLength + 2, 15), 50);
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }

  async exportBookLocationsToExcel(roomNumber, query = '', searchTerm = '', sortDirection = 'asc') {
    const ExcelJS = require('exceljs');

    if (!roomNumber) {
      throw new Error('Room number is required for locations export');
    }

    const sortDir = sortDirection === 'desc' ? -1 : 1;

    // Only the subject title is exported.
    const lookupStages = [
      {
        $lookup: {
          from: 'subjects',
          localField: 'subject',
          foreignField: '_id',
          as: 'subject'
        }
      }
    ];

    // Same filter as the book list (search text, category, subject, people, advanced rows), applied
    // within the chosen room. Every condition is on fields stored on the book, so it runs before the lookup.
    const filter = await this.buildSearchFilter(query, searchTerm);
    const roomMatch = { 'address.roomNumber': String(roomNumber) };
    const matchStage = { $match: filter ? { $and: [roomMatch, filter] } : roomMatch };

    // Projection stage
    const projectStage = {
      $project: {
        title: 1,
        roomNumber: "$address.roomNumber",
        wallNumber: "$address.wallNumber",
        shelfNumber: "$address.shelfNumber",
        bookNumber: "$address.bookNumber",
        numberOfFolders: 1,
        folder: {
          $cond: [
            { $gt: ["$numberOfFolders", 1] },
            { $range: [1, { $add: ["$numberOfFolders", 1] }] },
            "$$REMOVE"
          ]
        },
        categoryAndSubject: {
          $concat: [
            { $ifNull: [{ $first: "$subject.title" }, ""] }
          ]
        }
      }
    };

    // Unwind folders
    const unwindStage = {
      $unwind: {
        path: "$folder",
        preserveNullAndEmptyArrays: true
      }
    };

    // Filter first, then shelf order (before the projection drops sortKeys), then the subject lookup.
    const pipeline = [
      matchStage,
      addressSortStage(sortDir), // Rows in shelf order (before the projection drops sortKeys)
      ...lookupStages,
      projectStage,
      unwindStage
    ];

    // Execute aggregation
    const rows = await BookModel.aggregate(pipeline).allowDiskUse(true);

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Book locations', { views: [{ rightToLeft: true }] });

    // Define headers in Arabic
    const headers = [
      'العنوان',
      'الفئة - الموضوع',
      'الموقع',
      'الغرفة',
      'الحائط',
      'الرف',
      'رقم الكتاب',
      'المجلد'
    ];

    // Add headers
    worksheet.addRow(headers);

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, size: 12 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Column indices for numeric columns (updated after adding merged column)
    const locationMergedCol = 3; // الموقع (merged)
    const roomNumberCol = 4; // الغرفة
    const wallNumberCol = 5;  // الحائط
    const shelfNumberCol = 6; // الرف
    const bookNumberCol = 7;  // رقم الكتاب
    const folderCol = 8;      // المجلد

    // Add data rows with merged location and separate columns
    rows.forEach((r, index) => {
      // Build merged location string: room-wall-shelf-book, folder
      const locationParts = [
        r.roomNumber || '',
        r.wallNumber || '',
        r.shelfNumber || '',
        r.bookNumber || ''
      ].filter(part => part !== ''); // Remove empty parts

      let locationString = locationParts.join('.');

      // Add folder after comma if it exists
      if (r.folder !== null && r.folder !== undefined && r.folder !== '') {
        locationString += `, ${r.folder}`;
      }

      const row = worksheet.addRow([
        r.title || '',
        r.categoryAndSubject || '',
        locationString, // Merged location column
        r.roomNumber || '',
        r.wallNumber || '',
        r.shelfNumber || '',
        r.bookNumber || '',
        r.folder || ''
      ]);

      // Format numeric columns (skip the merged location column)
      [roomNumberCol, wallNumberCol, shelfNumberCol, bookNumberCol, folderCol].forEach(colIndex => {
        const cell = row.getCell(colIndex);
        const value = cell.value;
        if (value !== null && value !== undefined && value !== '') {
          const numValue = Number(value);
          if (!isNaN(numValue)) {
            cell.value = numValue;
            cell.numFmt = '0'; // Integer format
          }
        }
      });
    });

    // Auto column widths
    worksheet.columns.forEach((col) => {
      let max = 10;
      col.eachCell({ includeEmpty: true }, (cell) => {
        const len = (cell.value || '').toString().length;
        if (len > max) max = len;
      });
      col.width = Math.min(Math.max(max + 2, 15), 120);
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }

  // Get unique room numbers for dropdown selector
  async getUniqueRoomNumbers() {
    try {
      const rooms = await BookModel.distinct('address.roomNumber');
      // Filter out null/empty values and sort
      const filteredRooms = rooms.filter(r => r != null && r !== '').map(r => String(r));
      // Sort: numeric values first (as numbers), then string values
      return filteredRooms.sort((a, b) => {
        const numA = Number(a);
        const numB = Number(b);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        if (!isNaN(numA)) return -1;
        if (!isNaN(numB)) return 1;
        return String(a).localeCompare(String(b));
      });
    } catch (err) {
      console.error('Error getting unique room numbers:', err);
      throw err;
    }
  }

  // Get unique wall numbers for a specific room
  async getUniqueWallNumbers(roomNumber) {
    try {
      if (!roomNumber) {
        return [];
      }
      const walls = await BookModel.distinct('address.wallNumber', {
        'address.roomNumber': roomNumber
      });
      // Filter out null/empty values and sort
      const filteredWalls = walls.filter(w => w != null && w !== '').map(w => String(w));
      return filteredWalls.sort((a, b) => {
        const numA = Number(a);
        const numB = Number(b);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        if (!isNaN(numA)) return -1;
        if (!isNaN(numB)) return 1;
        return String(a).localeCompare(String(b));
      });
    } catch (err) {
      console.error('Error getting unique wall numbers:', err);
      throw err;
    }
  }

  // Bulk update subjects for books matching criteria
  async bulkUpdateSubjects(criteria, subjectId, userId) {
    let booksToRestore = [];
    try {
      // Validate required fields
      if (!criteria.shelfNumber) {
        throw new Error('Shelf number is required');
      }
      if (criteria.bookNumberFrom === undefined || criteria.bookNumberTo === undefined) {
        throw new Error('Book number range (from and to) is required');
      }
      if (!subjectId) {
        throw new Error('Subject ID is required');
      }
      if (!userId) {
        throw new Error('User ID is required');
      }

      // Validate subject exists
      const subject = await Subject.findById(subjectId);
      if (!subject) {
        throw new Error('Subject not found');
      }

      const query = bulkCriteriaQuery(criteria);

      // Store previous subject states before updating (for undo)
      // Also fetch book titles for history
      const booksBeforeUpdate = await BookModel.find(query).select('_id subject title').lean();
      booksToRestore = booksBeforeUpdate.map(book => ({
        bookId: book._id.toString(),
        previousSubjectId: book.subject ? book.subject.toString() : null
      }));

      // Get old subject information (most common subject or first book's subject)
      let oldSubject = null;
      if (booksBeforeUpdate.length > 0) {
        // Find the most common previous subject
        const subjectCounts = {};
        booksBeforeUpdate.forEach(book => {
          if (book.subject) {
            const subjId = book.subject.toString();
            subjectCounts[subjId] = (subjectCounts[subjId] || 0) + 1;
          }
        });

        // Get the most common subject ID
        let mostCommonSubjectId = null;
        let maxCount = 0;
        Object.keys(subjectCounts).forEach(subjId => {
          if (subjectCounts[subjId] > maxCount) {
            maxCount = subjectCounts[subjId];
            mostCommonSubjectId = subjId;
          }
        });

        // If no common subject, use first book's subject
        if (!mostCommonSubjectId && booksBeforeUpdate[0].subject) {
          mostCommonSubjectId = booksBeforeUpdate[0].subject.toString();
        }

        if (mostCommonSubjectId) {
          const oldSubjectDoc = await Subject.findById(mostCommonSubjectId);
          if (oldSubjectDoc) {
            oldSubject = {
              _id: oldSubjectDoc._id,
              title: oldSubjectDoc.title
            };
          }
        }
      }

      const countBefore = booksBeforeUpdate.length;

      // Update exactly the books captured above, so the undo history always matches what changed.
      const updateResult = await BookModel.updateMany(
        { _id: { $in: booksBeforeUpdate.map(b => b._id) } },
        { $set: { subject: subjectId } }
      );

      const modifiedCount = updateResult.modifiedCount || updateResult.nModified || 0;

      // Generate unique update ID
      const updateId = new mongoose.Types.ObjectId().toString();

      // Prepare affected books array with titles
      const affectedBooks = booksBeforeUpdate.map(book => ({
        bookId: book._id,
        bookTitle: book.title || 'Untitled',
        previousSubjectId: book.subject || null
      }));

      // Create history record
      const historyRecord = new BulkUpdateHistory({
        updateId: updateId,
        userId: userId,
        updateType: 'subject',
        criteria: {
          roomNumber: criteria.roomNumber || undefined,
          wallNumber: criteria.wallNumber || undefined,
          shelfNumber: criteria.shelfNumber,
          // Parsed again here: bulkCriteriaQuery has already validated them.
          bookNumberFrom: parseInt(criteria.bookNumberFrom, 10),
          bookNumberTo: parseInt(criteria.bookNumberTo, 10)
        },
        oldSubject: oldSubject || { _id: null, title: null },
        newSubject: {
          _id: subject._id,
          title: subject.title
        },
        affectedBooks: affectedBooks,
        status: 'active'
      });

      const savedHistory = await historyRecord.save();

      return {
        matchedCount: countBefore,
        modifiedCount: modifiedCount,
        subject: {
          _id: subject._id,
          title: subject.title
        },
        historyId: savedHistory._id.toString(),
        undoData: {
          updateId: updateId,
          books: booksToRestore,
          timestamp: new Date()
        }
      };
    } catch (err) {
      console.error('Error in bulk update subjects:', err);

      // Automatic rollback on error
      if (booksToRestore.length > 0) {
        try {
          console.log('Attempting automatic rollback...');
          await this.restoreSubjects(booksToRestore);
          console.log('Automatic rollback completed successfully');
        } catch (rollbackErr) {
          console.error('Error during automatic rollback:', rollbackErr);
          throw new Error(`Update failed and rollback also failed: ${err.message}. Rollback error: ${rollbackErr.message}`);
        }
      }

      throw err;
    }
  }

  // Bulk update categories for books matching criteria
  async bulkUpdateCategories(criteria, categoryId, userId) {
    let booksToRestore = [];
    try {
      // Validate required fields
      if (!criteria.shelfNumber) {
        throw new Error('Shelf number is required');
      }
      if (criteria.bookNumberFrom === undefined || criteria.bookNumberTo === undefined) {
        throw new Error('Book number range (from and to) is required');
      }
      if (!categoryId) {
        throw new Error('Category ID is required');
      }
      if (!userId) {
        throw new Error('User ID is required');
      }

      // Validate category exists
      const category = await Category.findById(categoryId);
      if (!category) {
        throw new Error('Category not found');
      }

      const query = bulkCriteriaQuery(criteria);

      // Store previous category states before updating (for undo)
      // Also fetch book titles for history
      const booksBeforeUpdate = await BookModel.find(query).select('_id category title').lean();
      booksToRestore = booksBeforeUpdate.map(book => ({
        bookId: book._id.toString(),
        previousCategoryId: book.category ? book.category.toString() : null
      }));

      // Get old category information (most common category or first book's category)
      let oldCategory = null;
      if (booksBeforeUpdate.length > 0) {
        // Find the most common previous category
        const categoryCounts = {};
        booksBeforeUpdate.forEach(book => {
          if (book.category) {
            const catId = book.category.toString();
            categoryCounts[catId] = (categoryCounts[catId] || 0) + 1;
          }
        });

        // Get the most common category ID
        let mostCommonCategoryId = null;
        let maxCount = 0;
        Object.keys(categoryCounts).forEach(catId => {
          if (categoryCounts[catId] > maxCount) {
            maxCount = categoryCounts[catId];
            mostCommonCategoryId = catId;
          }
        });

        // If no common category, use first book's category
        if (!mostCommonCategoryId && booksBeforeUpdate[0].category) {
          mostCommonCategoryId = booksBeforeUpdate[0].category.toString();
        }

        if (mostCommonCategoryId) {
          const oldCategoryDoc = await Category.findById(mostCommonCategoryId);
          if (oldCategoryDoc) {
            oldCategory = {
              _id: oldCategoryDoc._id,
              title: oldCategoryDoc.title
            };
          }
        }
      }

      const countBefore = booksBeforeUpdate.length;

      // Update exactly the books captured above, so the undo history always matches what changed.
      const updateResult = await BookModel.updateMany(
        { _id: { $in: booksBeforeUpdate.map(b => b._id) } },
        { $set: { category: categoryId } }
      );

      const modifiedCount = updateResult.modifiedCount || updateResult.nModified || 0;

      // Generate unique update ID
      const updateId = new mongoose.Types.ObjectId().toString();

      // Prepare affected books array with titles
      const affectedBooks = booksBeforeUpdate.map(book => ({
        bookId: book._id,
        bookTitle: book.title || 'Untitled',
        previousCategoryId: book.category || null
      }));

      // Create history record
      const historyRecord = new BulkUpdateHistory({
        updateId: updateId,
        userId: userId,
        updateType: 'category',
        criteria: {
          roomNumber: criteria.roomNumber || undefined,
          wallNumber: criteria.wallNumber || undefined,
          shelfNumber: criteria.shelfNumber,
          // Parsed again here: bulkCriteriaQuery has already validated them.
          bookNumberFrom: parseInt(criteria.bookNumberFrom, 10),
          bookNumberTo: parseInt(criteria.bookNumberTo, 10)
        },
        oldCategory: oldCategory || { _id: null, title: null },
        newCategory: {
          _id: category._id,
          title: category.title
        },
        affectedBooks: affectedBooks,
        status: 'active'
      });

      const savedHistory = await historyRecord.save();

      return {
        matchedCount: countBefore,
        modifiedCount: modifiedCount,
        category: {
          _id: category._id,
          title: category.title
        },
        historyId: savedHistory._id.toString(),
        undoData: {
          updateId: updateId,
          books: booksToRestore,
          timestamp: new Date()
        }
      };
    } catch (err) {
      console.error('Error in bulk update categories:', err);

      // Automatic rollback on error
      if (booksToRestore.length > 0) {
        try {
          console.log('Attempting automatic rollback...');
          await this.restoreCategories(booksToRestore);
          console.log('Automatic rollback completed successfully');
        } catch (rollbackErr) {
          console.error('Error during automatic rollback:', rollbackErr);
          throw new Error(`Update failed and rollback also failed: ${err.message}. Rollback error: ${rollbackErr.message}`);
        }
      }

      throw err;
    }
  }

  // Helper method to restore subjects
  async restoreSubjects(booksToRestore) {
    try {
      const bulkOps = booksToRestore.map(({ bookId, previousSubjectId }) => ({
        updateOne: {
          filter: { _id: new mongoose.Types.ObjectId(bookId) },
          update: { $set: { subject: previousSubjectId || null } }
        }
      }));

      if (bulkOps.length > 0) {
        await BookModel.bulkWrite(bulkOps);
      }
    } catch (err) {
      console.error('Error restoring subjects:', err);
      throw err;
    }
  }

  // Helper method to restore categories
  async restoreCategories(booksToRestore) {
    try {
      const bulkOps = booksToRestore.map(({ bookId, previousCategoryId }) => ({
        updateOne: {
          filter: { _id: new mongoose.Types.ObjectId(bookId) },
          update: { $set: { category: previousCategoryId || null } }
        }
      }));

      if (bulkOps.length > 0) {
        await BookModel.bulkWrite(bulkOps);
      }
    } catch (err) {
      console.error('Error restoring categories:', err);
      throw err;
    }
  }

  // Undo bulk update subjects
  async undoBulkUpdateSubjects(historyId) {
    try {
      if (!historyId) {
        throw new Error('History ID is required');
      }

      // Fetch history record
      const historyRecord = await BulkUpdateHistory.findById(historyId);
      if (!historyRecord) {
        throw new Error('History record not found');
      }

      if (historyRecord.status === 'undone') {
        throw new Error('This update has already been undone');
      }

      // Prepare books to restore based on update type
      // Handle old records without updateType (they were all subject updates)
      let booksToRestore = [];
      if (!historyRecord.updateType || historyRecord.updateType === 'subject') {
        booksToRestore = historyRecord.affectedBooks.map(({ bookId, previousSubjectId }) => ({
          bookId: bookId.toString(),
          previousSubjectId: previousSubjectId ? previousSubjectId.toString() : null
        }));
        // Restore subjects
        await this.restoreSubjects(booksToRestore);
      } else if (historyRecord.updateType === 'category') {
        booksToRestore = historyRecord.affectedBooks.map(({ bookId, previousCategoryId }) => ({
          bookId: bookId.toString(),
          previousCategoryId: previousCategoryId ? previousCategoryId.toString() : null
        }));
        // Restore categories
        await this.restoreCategories(booksToRestore);
      } else {
        throw new Error('Invalid update type in history record');
      }

      // Update history record status
      historyRecord.status = 'undone';
      historyRecord.undoneAt = new Date();
      await historyRecord.save();

      return {
        success: true,
        restoredCount: booksToRestore.length
      };
    } catch (err) {
      console.error('Error in undo bulk update subjects:', err);
      throw err;
    }
  }

  // Get bulk update history
  async getBulkUpdateHistory(userId, page = 1, limit = 10) {
    try {
      const query = {};

      // Filter by userId if provided (admin can see all, users see only their own)
      if (userId) {
        query.userId = userId;
      }

      const skip = (page - 1) * limit;

      const [history, total] = await Promise.all([
        BulkUpdateHistory.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('userId', 'username email')
          .lean(),
        BulkUpdateHistory.countDocuments(query)
      ]);

      return {
        history,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (err) {
      console.error('Error getting bulk update history:', err);
      throw err;
    }
  }

  // Get history by ID
  async getHistoryById(historyId) {
    try {
      if (!historyId) {
        throw new Error('History ID is required');
      }

      const history = await BulkUpdateHistory.findById(historyId)
        .populate('userId', 'username email')
        .lean();

      if (!history) {
        throw new Error('History record not found');
      }

      return history;
    } catch (err) {
      console.error('Error getting history by ID:', err);
      throw err;
    }
  }

  // Fast & light (approximate)
  async getStatistics() {
    const [totalBooks, totalAuthors] = await Promise.all([
      BookModel.estimatedDocumentCount(),
      Author.estimatedDocumentCount()
    ]);

    return {
      totalBooks: totalBooks || 0,
      totalAuthors: totalAuthors || 0
    };
  }


  async getBookById(id) {
    return await BookModel.findById(id).populate([
      { path: 'category', select: 'title' },
      { path: 'subject', select: 'title' },
      { path: 'authors', select: 'name type' },
      { path: 'editors', select: 'name type' },
      { path: 'caretakers', select: 'name type' },
      { path: 'commentators', select: 'name type' },
      { path: 'muhashis', select: 'name type' },
      { path: 'publishers', select: 'title' },
    ]);
  }

  async deleteBook(id) {
    const deleted = await BookModel.findByIdAndDelete(id);

    // Remove the cover image, but only if it really is a file inside assets/books.
    // imageUrl comes from the client, so never unlink a path that resolves anywhere else.
    if (deleted && deleted.imageUrl) {
      const booksDir = path.resolve(__dirname, '../assets/books');
      const relativePath = String(deleted.imageUrl).replace(/^[\\/]+/, '');
      const imagePath = path.resolve(__dirname, '..', relativePath);
      if (path.dirname(imagePath) === booksDir) {
        fs.unlink(imagePath, (err) => {
          if (err && err.code !== 'ENOENT') console.error('Error deleting associated image file:', err);
        });
      }
    }
    return deleted;
  }

  // Categories with their subjects (ids, as before) plus book counts: booksCount per category and
  // subjectBookCounts { subjectId: n } for the books filed under that category and subject.
  async getCategories() {
    const [categories, counts] = await Promise.all([
      Category.aggregate([
        {
          $project: {
            title: 1,
            subjects: 1,
            subjectsCount: { $size: { $ifNull: ['$subjects', []] } }
          }
        }
      ]),
      // Covered by the { category: 1, subject: 1 } index.
      BookModel.aggregate([
        { $group: { _id: { c: '$category', s: '$subject' }, n: { $sum: 1 } } }
      ])
    ]);

    const byCategory = new Map();
    for (const { _id, n } of counts) {
      if (!_id.c) continue;
      const key = String(_id.c);
      if (!byCategory.has(key)) byCategory.set(key, { total: 0, subjects: {} });
      const entry = byCategory.get(key);
      entry.total += n;
      if (_id.s) entry.subjects[String(_id.s)] = (entry.subjects[String(_id.s)] || 0) + n;
    }
    return categories.map(category => {
      const entry = byCategory.get(String(category._id));
      return { ...category, booksCount: entry ? entry.total : 0, subjectBookCounts: entry ? entry.subjects : {} };
    });
  }

  // Books per room and per stand (الاستاند), for the home page's library map. Rooms typed with
  // Arabic-Indic digits ("١١") are merged with their Latin spelling ("11"), matching roomExact.
  async getLocationSummary() {
    const groups = await BookModel.aggregate([
      { $group: { _id: { room: '$address.roomNumber', wall: '$address.wallNumber' }, n: { $sum: 1 } } }
    ]);
    const rooms = new Map();
    let unassigned = 0;
    for (const { _id, n } of groups) {
      const room = toLatinDigits(String(_id.room ?? '').trim());
      if (!room) { unassigned += n; continue; }
      if (!rooms.has(room)) rooms.set(room, { room, count: 0, walls: new Map() });
      const entry = rooms.get(room);
      entry.count += n;
      const wall = String(_id.wall ?? '').trim();
      if (wall) entry.walls.set(wall, (entry.walls.get(wall) || 0) + n);
    }
    return {
      rooms: [...rooms.values()]
        .map(r => ({
          room: r.room,
          count: r.count,
          walls: [...r.walls].map(([wall, count]) => ({ wall, count })).sort((a, b) => a.wall.localeCompare(b.wall, 'ar'))
        }))
        .sort((a, b) => a.room.localeCompare(b.room, 'en', { numeric: true })),
      unassigned
    };
  }

  // What a bulk update would change, without changing anything: the number of matching books and the
  // first 20 of them (in shelf order) so the admin can check the range before applying it.
  async previewBulkUpdate(criteria) {
    const query = bulkCriteriaQuery(criteria);
    const [count, sample] = await Promise.all([
      BookModel.countDocuments(query),
      BookModel.aggregate([
        { $match: query },
        addressSortStage(1),
        { $limit: 20 },
        { $lookup: { from: 'categories', localField: 'category', foreignField: '_id', as: 'category' } },
        { $lookup: { from: 'subjects', localField: 'subject', foreignField: '_id', as: 'subject' } },
        {
          $project: {
            title: 1,
            address: 1,
            category: { $first: '$category.title' },
            subject: { $first: '$subject.title' }
          }
        }
      ])
    ]);
    return { count, sample };
  }


  async createCategory(categoryData) {
    const { title } = categoryData;
    const normalizedTitle = normalizeArabicText(title);
    let category = await Category.findOne({ normalizedTitle }); // CHANGE THIS
    if (!category) {
      category = new Category({
        title,
        normalizedTitle
      });
      await category.save();
    }
    return category;
  }

  async getsubjects() {
    return await Subject.find().lean();
  }

  async createSubject(subjectData) {
    const { title } = subjectData;
    const normalizedTitle = normalizeArabicText(title);
    let subject = await Subject.findOne({ normalizedTitle }); // CHANGE THIS
    if (!subject) {
      subject = new Subject({
        title,
        normalizedTitle
      });
      await subject.save();
    }
    return subject;
  }

  async getPeople() {
    return await Author.find().lean();
  }

  async createPerson(personData) {
    const { name, type } = personData;
    const normalizedName = normalizeArabicText(name);
    let person = await Author.findOne({ normalizedName, type });
    if (!person) {
      person = new Author({
        name,
        type,
        normalizedName
      });
      await person.save();
    }
    return person;
  }

  async createPublisher(publisherData) {
    const { title } = publisherData;
    const normalizedTitle = normalizeArabicText(title);
    let publisher = await Publisher.findOne({ normalizedTitle }); // CHANGE THIS
    if (!publisher) {
      publisher = new Publisher({
        title,
        normalizedTitle
      });
      await publisher.save();
    }
    return publisher;
  }

  async getPublishers() {
    return await Publisher.find().lean();
  }
}


module.exports = {
  BookService: new BookService(),
};