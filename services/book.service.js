const mongoose = require('mongoose');
const BookModel = require('../models/book.model');
const Category = require('../models/category.model');
const Subject = require('../models/subject.model');
const Author = require('../models/author.model'); // This is your 'Person' model for authors, commentators, etc.
const Publisher = require('../models/publisher.model');

class BookService {

  // Add this at the top of your BookService file
  normalizeArabicText = (text) => {
    if (!text) return '';
    console.log("text ", text);

    return text
      .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
      .replace(/[\u0622\u0623\u0625\u0627]/g, 'ا')
      .replace(/\u0649/g, 'ي')
      .replace(/\u0629/g, 'ه')
      .replace(/[\u0654\u0655]/g, '')
      .replace(/\u0624/g, 'و')
      .replace(/\u0626/g, 'ي')
      .replace(/\u0621/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  };

  // Updated resolveEntity method
  async resolveEntity(data, Model, field, filter = {}) {
    if (!data) return null;

    let dataArray;
    let isOriginalInputArray = Array.isArray(data);

    if (isOriginalInputArray) {
      dataArray = data;
    } else {
      dataArray = [data];
    }

    const ids = [];

    // Determine the normalized field name
    const normalizedField = field === 'title' ? 'normalizedTitle' :
      field === 'name' ? 'normalizedName' : null;

    for (const item of dataArray) {
      // If item is a string that looks like an ObjectId, use it directly
      if (typeof item === 'string' && mongoose.Types.ObjectId.isValid(item.replace(/"/g, ''))) {
        ids.push(item.replace(/"/g, ''));
      }
      // If item is an object with an _id, use it directly
      else if (typeof item === 'object' && item !== null && item._id && mongoose.Types.ObjectId.isValid(item._id)) {
        ids.push(item._id);
      }
      // If item is an object with the specified field, try to find/create
      else if (typeof item === 'object' && item !== null && item[field]) {
        let query;
        if (normalizedField) {
          const normalizedValue = this.normalizeArabicText(item[field]);
          query = { [normalizedField]: normalizedValue, ...filter };
        } else {
          query = { [field]: item[field], ...filter };
        }

        let doc = await Model.findOne(query);
        if (!doc) {
          const newDoc = { ...filter, [field]: item[field] };
          if (normalizedField) {
            newDoc[normalizedField] = this.normalizeArabicText(item[field]);
          }
          doc = await new Model(newDoc).save();
        }
        ids.push(doc._id);
      }
      // Fallback: If it's a string but not a valid ObjectId, assume it's a name/title
      else if (typeof item === 'string' && !mongoose.Types.ObjectId.isValid(item.replace(/"/g, ''))) {
        const cleanValue = item.replace(/"/g, '');

        let query;
        if (normalizedField) {
          const normalizedValue = this.normalizeArabicText(cleanValue);
          query = { [normalizedField]: normalizedValue, ...filter };
        } else {
          query = { [field]: cleanValue, ...filter };
        }

        let doc = await Model.findOne(query);
        if (!doc) {
          const newDoc = { ...filter, [field]: cleanValue };
          if (normalizedField) {
            newDoc[normalizedField] = this.normalizeArabicText(cleanValue);
          }
          doc = await new Model(newDoc).save();
        }
        ids.push(doc._id);
      }
    }

    return isOriginalInputArray ? ids : ids[0];
  }

  async createBook(bookData) {
    // All existing resolveEntity calls remain the same
    const categoryId = await this.resolveEntity(bookData.category, Category, 'title');
    const subjectId = await this.resolveEntity(bookData.subject, Subject, 'title');
    const publisherIds = await this.resolveEntity(bookData.publishers, Publisher, 'title');
    const authorIds = await this.resolveEntity(bookData.authors, Author, 'name', { type: 'author' });
    const commentatorids = await this.resolveEntity(bookData.commentators, Author, 'name', { type: 'commentator' });
    const editorIds = await this.resolveEntity(bookData.editors, Author, 'name', { type: 'editor' });
    const caretakerIds = await this.resolveEntity(bookData.caretakers, Author, 'name', { type: 'caretaker' });
    const muhashisIds = await this.resolveEntity(bookData.muhashis, Author, 'name', { type: 'muhashi' });

    let pageCountValue = parseInt(bookData.pageCount, 10);
    if (isNaN(pageCountValue) || pageCountValue < 0) {
      pageCountValue = 0;
      console.warn(`Invalid pageCount received: ${bookData.pageCount}. Defaulting to ${pageCountValue}.`);
    }
    const bookObj = {
      title: bookData.title,
      normalizedTitle: this.normalizeArabicText(bookData.title), // ADD THIS LINE
      authors: authorIds,
      commentators: commentatorids,
      editors: editorIds,
      caretakers: caretakerIds,
      muhashis: muhashisIds,
      category: categoryId,
      subject: subjectId,
      publishers: publisherIds,
      numberOfVolumes: bookData.numberOfVolumes,
      numberOfFolders: bookData.numberOfFolders,
      editionNumber: bookData.editionNumber,
      publicationYear: bookData.publicationYear,
      pageCount: pageCountValue,
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

  // Updated updateBook method - add normalizedTitle when title is updated
  async updateBook(id, bookData) {
    const updatePayload = { ...bookData };

    // ADD THIS: If title is being updated, also update normalizedTitle
    if (bookData.title) {
      updatePayload.normalizedTitle = this.normalizeArabicText(bookData.title);
    }

    if (bookData.imagePath) {
      updatePayload.imageUrl = bookData.imagePath;
    } else {
      delete updatePayload.imagePath;
    }

    if (updatePayload.pageCount !== undefined) {
      let pageCountValue = parseInt(updatePayload.pageCount, 10);
      if (isNaN(pageCountValue) || pageCountValue < 0) {
        pageCountValue = 0;
        console.warn(`Invalid pageCount received during update: ${updatePayload.pageCount}. Defaulting to ${pageCountValue}.`);
      }
      updatePayload.pageCount = pageCountValue;
    }

    // All existing resolveEntity calls remain the same
    if (bookData.category) {
      updatePayload.category = await this.resolveEntity(bookData.category, Category, 'title');
    }
    if (bookData.subject) {
      updatePayload.subject = await this.resolveEntity(bookData.subject, Subject, 'title');
    }
    if (bookData.publishers) {
      updatePayload.publishers = await this.resolveEntity(bookData.publishers, Publisher, 'title');
    }
    if (bookData.authors) {
      updatePayload.authors = await this.resolveEntity(bookData.authors, Author, 'name', { type: 'author' });
    }
    if (bookData.commentators) {
      updatePayload.commentators = await this.resolveEntity(bookData.commentators, Author, 'name', { type: 'commentator' });
    }
    if (bookData.editors) {
      updatePayload.editors = await this.resolveEntity(bookData.editors, Author, 'name', { type: 'editor' });
    }
    if (bookData.caretakers) {
      updatePayload.caretakers = await this.resolveEntity(bookData.caretakers, Author, 'name', { type: 'caretaker' });
    }
    if (bookData.muhashis) {
      updatePayload.muhashis = await this.resolveEntity(bookData.muhashis, Author, 'name', { type: 'muhashi' });
    }

    let updatedBook = await BookModel.findByIdAndUpdate(id, updatePayload, { new: true });
    let book = await this.getBookById(updatedBook._id);
    return book;
  }

  escapeRegex(str = '') {
    // escape regex special chars so user input can't break pattern matching
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async getAllBooks(
    query = '',
    searchTerm = '',
    page = 1,
    limit = 30,
    sortDirection = 'asc' // keep sort direction, but sortField removed
  ) {
    // Normalize numeric params
    page = Number(page) || 1;
    limit = Number(limit) || 30;
    const skip = (page - 1) * limit;
    const sortDir = sortDirection === 'desc' ? -1 : 1;

    // Lookups
    const lookupStages = [
      { $lookup: { from: 'authors', localField: 'authors', foreignField: '_id', as: 'authorData' } },
      { $lookup: { from: 'authors', localField: 'commentators', foreignField: '_id', as: 'commentatorData' } },
      { $lookup: { from: 'authors', localField: 'editors', foreignField: '_id', as: 'editorData' } },
      { $lookup: { from: 'authors', localField: 'caretakers', foreignField: '_id', as: 'caretakerData' } },
      { $lookup: { from: 'authors', localField: 'muhashis', foreignField: '_id', as: 'muhashiData' } },
      { $lookup: { from: 'publishers', localField: 'publishers', foreignField: '_id', as: 'publisherData' } },
      { $lookup: { from: 'categories', localField: 'category', foreignField: '_id', as: 'categoryData' } },
      { $lookup: { from: 'subjects', localField: 'subject', foreignField: '_id', as: 'subjectData' } }
    ];

    // Build matchStage
    const matchStage = [];
    if (query === 'advanced') {
      let filters = [];
      try { filters = JSON.parse(searchTerm); } catch (e) { filters = []; }

      const conditions = filters.map(({ field, value }) => {
        const normalizedValue = this.normalizeArabicText(value);
        const pathMap = {
          title: { path: 'normalizedTitle', useNormalized: true },
          category: { path: 'categoryData.normalizedTitle', useNormalized: true },
          subject: { path: 'subjectData.normalizedTitle', useNormalized: true },
          publishers: { path: 'publisherData.normalizedTitle', useNormalized: true },

          authors: { path: 'authorData.normalizedName', useNormalized: true },
          editors: { path: 'editorData.normalizedName', useNormalized: true },
          commentators: { path: 'commentatorData.normalizedName', useNormalized: true },
          caretakers: { path: 'caretakerData.normalizedName', useNormalized: true },
          muhashis: { path: 'muhashiData.normalizedName', useNormalized: true },

          roomNumber: { path: 'address.roomNumber', useNormalized: false },
          shelfNumber: { path: 'address.shelfNumber', useNormalized: false },
          wallNumber: { path: 'address.wallNumber', useNormalized: false },
          bookNumber: { path: 'address.bookNumber', useNormalized: false },

          numberOfVolumes: { path: 'numberOfVolumes', useNormalized: false },
          numberOfFolders: { path: 'numberOfFolders', useNormalized: false },
          editionNumber: { path: 'editionNumber', useNormalized: false },
          publicationYear: { path: 'publicationYear', useNormalized: false },
          pageCount: { path: 'pageCount', useNormalized: false },
          notes: { path: 'notes', useNormalized: false }
        };

        const cfg = pathMap[field] || { path: field, useNormalized: false };

        if (cfg.useNormalized) {
          return { [cfg.path]: normalizedValue };
        } else {
          return { [cfg.path]: { $regex: value, $options: 'i' } };
        }
      });

      if (conditions.length) matchStage.push({ $match: { $and: conditions } });
    }
    else if (searchTerm && String(searchTerm).trim()) {
      const rawTerm = String(searchTerm).trim();
      const normalizedSearchTerm = this.normalizeArabicText(rawTerm) || rawTerm;

      const rawEsc = this.escapeRegex(rawTerm);
      const normEsc = this.escapeRegex(normalizedSearchTerm);

      const pathMap = {
        title: { path: 'normalizedTitle', useNormalized: true },
        category: { path: 'categoryData.normalizedTitle', useNormalized: true },
        subcategory: { path: 'subjectData.normalizedTitle', useNormalized: true },
        subject: { path: 'subjectData.normalizedTitle', useNormalized: true },
        publishers: { path: 'publisherData.normalizedTitle', useNormalized: true },

        authors: { path: 'authorData.normalizedName', useNormalized: true, isArray: true },
        editors: { path: 'editorData.normalizedName', useNormalized: true, isArray: true },
        commentators: { path: 'commentatorData.normalizedName', useNormalized: true, isArray: true },
        caretakers: { path: 'caretakerData.normalizedName', useNormalized: true, isArray: true },
        muhashis: { path: 'muhashiData.normalizedName', useNormalized: true, isArray: true },

        roomNumber: { path: 'address.roomNumber', useNormalized: false },
        shelfNumber: { path: 'address.shelfNumber', useNormalized: false },
        wallNumber: { path: 'address.wallNumber', useNormalized: false },
        bookNumber: { path: 'address.bookNumber', useNormalized: false },

        numberOfVolumes: { path: 'numberOfVolumes', useNormalized: false },
        numberOfFolders: { path: 'numberOfFolders', useNormalized: false },
        editionNumber: { path: 'editionNumber', useNormalized: false },
        publicationYear: { path: 'publicationYear', useNormalized: false },
        pageCount: { path: 'pageCount', useNormalized: false },
        notes: { path: 'notes', useNormalized: false }
      };

      const fieldConfig = pathMap[query] || null;

      if (fieldConfig) {
        if (fieldConfig.isArray) {
          if (fieldConfig.useNormalized) {
            matchStage.push({
              $match: {
                [fieldConfig.path.split('.').slice(0, -1).join('.')]: {
                  $elemMatch: { [fieldConfig.path.split('.').slice(-1)[0]]: { $regex: normEsc, $options: 'i' } }
                }
              }
            });
          } else {
            matchStage.push({
              $match: {
                [fieldConfig.path.split('.').slice(0, -1).join('.')]: {
                  $elemMatch: { [fieldConfig.path.split('.').slice(-1)[0]]: { $regex: rawEsc, $options: 'i' } }
                }
              }
            });
          }
        } else {
          matchStage.push({
            $match: {
              [fieldConfig.path]: { $regex: fieldConfig.useNormalized ? normEsc : rawEsc, $options: 'i' }
            }
          });
        }
      } else {
        const orConditions = [];

        ['title', 'category', 'subject', 'subcategory', 'publishers'].forEach(k => {
          const cfg = pathMap[k];
          if (!cfg) return;
          orConditions.push({ [cfg.path]: { $regex: normEsc, $options: 'i' } });
        });

        ['authors', 'editors', 'commentators', 'caretakers', 'muhashis'].forEach(k => {
          const cfg = pathMap[k];
          if (!cfg) return;
          const parts = cfg.path.split('.');
          const parent = parts.slice(0, -1).join('.');
          const childField = parts.slice(-1)[0];
          orConditions.push({ [parent]: { $elemMatch: { [childField]: { $regex: normEsc, $options: 'i' } } } });
          orConditions.push({ [cfg.path]: { $regex: normEsc, $options: 'i' } });
        });

        ['roomNumber', 'shelfNumber', 'wallNumber', 'bookNumber', 'notes'].forEach(k => {
          const cfg = pathMap[k];
          if (!cfg) return;
          orConditions.push({ [cfg.path]: { $regex: rawEsc, $options: 'i' } });
        });

        if (!Number.isNaN(Number(rawTerm))) {
          const n = Number(rawTerm);
          ['numberOfVolumes', 'numberOfFolders', 'editionNumber', 'publicationYear', 'pageCount'].forEach(k => {
            const cfg = pathMap[k];
            if (!cfg) return;
            orConditions.push({ [cfg.path]: n });
          });
        } else {
          ['numberOfVolumes', 'numberOfFolders', 'editionNumber', 'publicationYear', 'pageCount'].forEach(k => {
            const cfg = pathMap[k];
            if (!cfg) return;
            orConditions.push({ [cfg.path]: { $regex: rawEsc, $options: 'i' } });
          });
        }

        if (orConditions.length) {
          matchStage.push({ $match: { $or: orConditions } });
        } else {
          console.warn('No search conditions created for non-advanced searchTerm:', rawTerm);
        }
      }
    }

    // Projection stage
    const projectStage = {
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
        authors: '$authorData',
        commentators: '$commentatorData',
        editors: '$editorData',
        caretakers: '$caretakerData',
        muhashis: '$muhashiData',
        publishers: '$publisherData',
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

    // Always sort by numeric address fields (room, shelf, wall, book),
    // but handle non-numeric values (e.g. "أ ب") by falling back to string sorting.
    const sortStage = [
      {
        $addFields: {
          // Numeric attempts (null if not convertible)
          tempRoomNum: { $convert: { input: '$address.roomNumber', to: 'int', onError: null, onNull: null } },
          tempShelfNum: { $convert: { input: '$address.shelfNumber', to: 'int', onError: null, onNull: null } },
          tempWallNum: { $convert: { input: '$address.wallNumber', to: 'int', onError: null, onNull: null } },
          tempBookNum: { $convert: { input: '$address.bookNumber', to: 'int', onError: null, onNull: null } },

          // String fallbacks (trimmed)
          tempRoomStr: { $trim: { input: { $ifNull: ['$address.roomNumber', ''] } } },
          tempShelfStr: { $trim: { input: { $ifNull: ['$address.shelfNumber', ''] } } },
          tempWallStr: { $trim: { input: { $ifNull: ['$address.wallNumber', ''] } } },
          tempBookStr: { $trim: { input: { $ifNull: ['$address.bookNumber', ''] } } },

          // Flags: 0 if numeric exists, 1 if numeric is null — so numbers come first when sorting ascending.
          // If you want non-numeric first, invert the 0/1 values.
          tempRoomNumFlag: { $cond: [{ $ifNull: ['$tempRoomNum', false] }, 0, 1] },
          tempShelfNumFlag: { $cond: [{ $ifNull: ['$tempShelfNum', false] }, 0, 1] },
          tempWallNumFlag: { $cond: [{ $ifNull: ['$tempWallNum', false] }, 0, 1] },
          tempBookNumFlag: { $cond: [{ $ifNull: ['$tempBookNum', false] }, 0, 1] }
        }
      },
      {
        $sort: {
          // Primary ordering: by whether a numeric value exists (numbers first for asc)
          tempRoomNumFlag: sortDir,
          // If numeric exists for both, sort by numeric value; otherwise by string fallback
          tempRoomNum: sortDir,
          tempRoomStr: sortDir,

          tempShelfNumFlag: sortDir,
          tempShelfNum: sortDir,
          tempShelfStr: sortDir,

          tempWallNumFlag: sortDir,
          tempWallNum: sortDir,
          tempWallStr: sortDir,

          tempBookNumFlag: sortDir,
          tempBookNum: sortDir,
          tempBookStr: sortDir
        }
      },
      {
        $project: {
          // remove helper fields
          tempRoomNum: 0, tempShelfNum: 0, tempWallNum: 0, tempBookNum: 0,
          tempRoomStr: 0, tempShelfStr: 0, tempWallStr: 0, tempBookStr: 0,
          tempRoomNumFlag: 0, tempShelfNumFlag: 0, tempWallNumFlag: 0, tempBookNumFlag: 0
        }
      }
    ];


    // Build pipeline
    const pipeline = [
      ...lookupStages,
      ...matchStage,
      projectStage,
      ...sortStage,
      {
        $facet: {
          paginatedResults: [
            { $skip: skip },
            { $limit: limit }
          ],
          counts: [
            { $count: 'filteredCount' }
          ],
          uniqueAuthors: [
            { $unwind: { path: '$authors', preserveNullAndEmptyArrays: true } },
            { $group: { _id: '$authors._id' } },
            { $count: 'count' }
          ],
          uniquePublishers: [
            { $unwind: { path: '$publishers', preserveNullAndEmptyArrays: true } },
            { $group: { _id: '$publishers._id' } },
            { $count: 'count' }
          ]
        }
      },
      {
        $project: {
          paginatedResults: 1,
          filteredCount: { $ifNull: [{ $arrayElemAt: ['$counts.filteredCount', 0] }, 0] },
          uniqueAuthors: { $ifNull: [{ $arrayElemAt: ['$uniqueAuthors.count', 0] }, 0] },
          uniquePublishers: { $ifNull: [{ $arrayElemAt: ['$uniquePublishers.count', 0] }, 0] }
        }
      }
    ];

    // Optional: uncomment to debug the pipeline shape in logs
    // console.dir(pipeline, { depth: null });

    // Execute aggregation
    const aggResult = await BookModel.aggregate(pipeline);

    // Process results
    const resultDoc = aggResult[0] || { paginatedResults: [], filteredCount: 0, uniqueAuthors: 0, uniquePublishers: 0 };
    const totalAll = await BookModel.countDocuments();

    return {
      books: resultDoc.paginatedResults || [],
      totalBooks: totalAll || 0,
      filteredCount: resultDoc.filteredCount || 0,
      uniqueAuthors: resultDoc.uniqueAuthors || 0,
      uniquePublishers: resultDoc.uniquePublishers || 0
    };
  }

  async exportBooksToExcel(query = '', searchTerm = '', sortDirection = 'asc') {
    const ExcelJS = require('exceljs');
    const sortDir = sortDirection === 'desc' ? -1 : 1;

    // Reuse the same lookup and match stages from getAllBooks
    const lookupStages = [
      { $lookup: { from: 'authors', localField: 'authors', foreignField: '_id', as: 'authorData' } },
      { $lookup: { from: 'authors', localField: 'commentators', foreignField: '_id', as: 'commentatorData' } },
      { $lookup: { from: 'authors', localField: 'editors', foreignField: '_id', as: 'editorData' } },
      { $lookup: { from: 'authors', localField: 'caretakers', foreignField: '_id', as: 'caretakerData' } },
      { $lookup: { from: 'authors', localField: 'muhashis', foreignField: '_id', as: 'muhashiData' } },
      { $lookup: { from: 'publishers', localField: 'publishers', foreignField: '_id', as: 'publisherData' } },
      { $lookup: { from: 'categories', localField: 'category', foreignField: '_id', as: 'categoryData' } },
      { $lookup: { from: 'subjects', localField: 'subject', foreignField: '_id', as: 'subjectData' } }
    ];

    // Build matchStage (same logic as getAllBooks)
    const matchStage = [];
    if (query === 'advanced') {
      let filters = [];
      try { filters = JSON.parse(searchTerm); } catch (e) { filters = []; }

      const conditions = filters.map(({ field, value }) => {
        const normalizedValue = this.normalizeArabicText(value);
        const pathMap = {
          title: { path: 'normalizedTitle', useNormalized: true },
          category: { path: 'categoryData.normalizedTitle', useNormalized: true },
          subject: { path: 'subjectData.normalizedTitle', useNormalized: true },
          publishers: { path: 'publisherData.normalizedTitle', useNormalized: true },
          authors: { path: 'authorData.normalizedName', useNormalized: true },
          editors: { path: 'editorData.normalizedName', useNormalized: true },
          commentators: { path: 'commentatorData.normalizedName', useNormalized: true },
          caretakers: { path: 'caretakerData.normalizedName', useNormalized: true },
          muhashis: { path: 'muhashiData.normalizedName', useNormalized: true },
          roomNumber: { path: 'address.roomNumber', useNormalized: false },
          shelfNumber: { path: 'address.shelfNumber', useNormalized: false },
          wallNumber: { path: 'address.wallNumber', useNormalized: false },
          bookNumber: { path: 'address.bookNumber', useNormalized: false },
          numberOfVolumes: { path: 'numberOfVolumes', useNormalized: false },
          numberOfFolders: { path: 'numberOfFolders', useNormalized: false },
          editionNumber: { path: 'editionNumber', useNormalized: false },
          publicationYear: { path: 'publicationYear', useNormalized: false },
          pageCount: { path: 'pageCount', useNormalized: false },
          notes: { path: 'notes', useNormalized: false }
        };

        const cfg = pathMap[field] || { path: field, useNormalized: false };
        if (cfg.useNormalized) {
          return { [cfg.path]: normalizedValue };
        } else {
          return { [cfg.path]: { $regex: value, $options: 'i' } };
        }
      });

      if (conditions.length) matchStage.push({ $match: { $and: conditions } });
    }
    else if (searchTerm && String(searchTerm).trim()) {
      const rawTerm = String(searchTerm).trim();
      const normalizedSearchTerm = this.normalizeArabicText(rawTerm) || rawTerm;
      const rawEsc = this.escapeRegex(rawTerm);
      const normEsc = this.escapeRegex(normalizedSearchTerm);

      const pathMap = {
        title: { path: 'normalizedTitle', useNormalized: true },
        category: { path: 'categoryData.normalizedTitle', useNormalized: true },
        subcategory: { path: 'subjectData.normalizedTitle', useNormalized: true },
        subject: { path: 'subjectData.normalizedTitle', useNormalized: true },
        publishers: { path: 'publisherData.normalizedTitle', useNormalized: true },
        authors: { path: 'authorData.normalizedName', useNormalized: true, isArray: true },
        editors: { path: 'editorData.normalizedName', useNormalized: true, isArray: true },
        commentators: { path: 'commentatorData.normalizedName', useNormalized: true, isArray: true },
        caretakers: { path: 'caretakerData.normalizedName', useNormalized: true, isArray: true },
        muhashis: { path: 'muhashiData.normalizedName', useNormalized: true, isArray: true },
        roomNumber: { path: 'address.roomNumber', useNormalized: false },
        shelfNumber: { path: 'address.shelfNumber', useNormalized: false },
        wallNumber: { path: 'address.wallNumber', useNormalized: false },
        bookNumber: { path: 'address.bookNumber', useNormalized: false },
        numberOfVolumes: { path: 'numberOfVolumes', useNormalized: false },
        numberOfFolders: { path: 'numberOfFolders', useNormalized: false },
        editionNumber: { path: 'editionNumber', useNormalized: false },
        publicationYear: { path: 'publicationYear', useNormalized: false },
        pageCount: { path: 'pageCount', useNormalized: false },
        notes: { path: 'notes', useNormalized: false }
      };

      const fieldConfig = pathMap[query] || null;
      if (fieldConfig) {
        if (fieldConfig.isArray) {
          if (fieldConfig.useNormalized) {
            matchStage.push({
              $match: {
                [fieldConfig.path.split('.').slice(0, -1).join('.')]: {
                  $elemMatch: { [fieldConfig.path.split('.').slice(-1)[0]]: { $regex: normEsc, $options: 'i' } }
                }
              }
            });
          } else {
            matchStage.push({
              $match: {
                [fieldConfig.path.split('.').slice(0, -1).join('.')]: {
                  $elemMatch: { [fieldConfig.path.split('.').slice(-1)[0]]: { $regex: rawEsc, $options: 'i' } }
                }
              }
            });
          }
        } else {
          matchStage.push({
            $match: {
              [fieldConfig.path]: { $regex: fieldConfig.useNormalized ? normEsc : rawEsc, $options: 'i' }
            }
          });
        }
      } else {
        const orConditions = [];
        ['title', 'category', 'subject', 'subcategory', 'publishers'].forEach(k => {
          const cfg = pathMap[k];
          if (!cfg) return;
          orConditions.push({ [cfg.path]: { $regex: normEsc, $options: 'i' } });
        });
        ['authors', 'editors', 'commentators', 'caretakers', 'muhashis'].forEach(k => {
          const cfg = pathMap[k];
          if (!cfg) return;
          const parts = cfg.path.split('.');
          const parent = parts.slice(0, -1).join('.');
          const childField = parts.slice(-1)[0];
          orConditions.push({ [parent]: { $elemMatch: { [childField]: { $regex: normEsc, $options: 'i' } } } });
        });
        ['roomNumber', 'shelfNumber', 'wallNumber', 'bookNumber', 'notes'].forEach(k => {
          const cfg = pathMap[k];
          if (!cfg) return;
          orConditions.push({ [cfg.path]: { $regex: rawEsc, $options: 'i' } });
        });
        if (orConditions.length) {
          matchStage.push({ $match: { $or: orConditions } });
        }
      }
    }

    // Projection stage (same as getAllBooks)
    const projectStage = {
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
        authors: '$authorData',
        commentators: '$commentatorData',
        editors: '$editorData',
        caretakers: '$caretakerData',
        muhashis: '$muhashiData',
        publishers: '$publisherData',
        category: { $arrayElemAt: ['$categoryData', 0] },
        subject: { $arrayElemAt: ['$subjectData', 0] },
        notes: 1,
        createdAt: 1,
        updatedAt: 1
      }
    };

    // Sort stage (same as getAllBooks)
    const sortStage = [
      {
        $addFields: {
          tempRoomNum: { $convert: { input: '$address.roomNumber', to: 'int', onError: null, onNull: null } },
          tempShelfNum: { $convert: { input: '$address.shelfNumber', to: 'int', onError: null, onNull: null } },
          tempWallNum: { $convert: { input: '$address.wallNumber', to: 'int', onError: null, onNull: null } },
          tempBookNum: { $convert: { input: '$address.bookNumber', to: 'int', onError: null, onNull: null } },
          tempRoomStr: { $trim: { input: { $ifNull: ['$address.roomNumber', ''] } } },
          tempShelfStr: { $trim: { input: { $ifNull: ['$address.shelfNumber', ''] } } },
          tempWallStr: { $trim: { input: { $ifNull: ['$address.wallNumber', ''] } } },
          tempBookStr: { $trim: { input: { $ifNull: ['$address.bookNumber', ''] } } },
          tempRoomNumFlag: { $cond: [{ $ifNull: ['$tempRoomNum', false] }, 0, 1] },
          tempShelfNumFlag: { $cond: [{ $ifNull: ['$tempShelfNum', false] }, 0, 1] },
          tempWallNumFlag: { $cond: [{ $ifNull: ['$tempWallNum', false] }, 0, 1] },
          tempBookNumFlag: { $cond: [{ $ifNull: ['$tempBookNum', false] }, 0, 1] }
        }
      },
      {
        $sort: {
          tempRoomNumFlag: sortDir,
          tempRoomNum: sortDir,
          tempRoomStr: sortDir,
          tempShelfNumFlag: sortDir,
          tempShelfNum: sortDir,
          tempShelfStr: sortDir,
          tempWallNumFlag: sortDir,
          tempWallNum: sortDir,
          tempWallStr: sortDir,
          tempBookNumFlag: sortDir,
          tempBookNum: sortDir,
          tempBookStr: sortDir
        }
      },
      {
        $project: {
          tempRoomNum: 0, tempShelfNum: 0, tempWallNum: 0, tempBookNum: 0,
          tempRoomStr: 0, tempShelfStr: 0, tempWallStr: 0, tempBookStr: 0,
          tempRoomNumFlag: 0, tempShelfNumFlag: 0, tempWallNumFlag: 0, tempBookNumFlag: 0
        }
      }
    ];

    // Build pipeline WITHOUT pagination
    const pipeline = [
      ...lookupStages,
      ...matchStage,
      projectStage,
      ...sortStage
    ];

    // Execute aggregation to get ALL matching books
    const books = await BookModel.aggregate(pipeline).allowDiskUse(true);

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
      'المحاشي',
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

  async updateBook(id, bookData) {
    const updatePayload = { ...bookData };

    if (bookData.imagePath) {
      updatePayload.imageUrl = bookData.imagePath;
    } else {
      delete updatePayload.imagePath;
    }

    // FIX: Validate and parse pageCount for updates
    if (updatePayload.pageCount !== undefined) {
      let pageCountValue = parseInt(updatePayload.pageCount, 10);
      if (isNaN(pageCountValue) || pageCountValue < 0) {
        pageCountValue = 0; // Default or handle as error
        console.warn(`Invalid pageCount received during update: ${updatePayload.pageCount}. Defaulting to ${pageCountValue}.`);
      }
      updatePayload.pageCount = pageCountValue;
    }

    // Resolve IDs for nested entities if they are provided in the update payload.
    if (bookData.category) {
      updatePayload.category = await this.resolveEntity(bookData.category, Category, 'title');
    }
    if (bookData.subject) {
      updatePayload.subject = await this.resolveEntity(bookData.subject, Subject, 'title');
    }
    if (bookData.publishers) {
      updatePayload.publishers = await this.resolveEntity(bookData.publishers, Publisher, 'title');
    }
    if (bookData.authors) {
      updatePayload.authors = await this.resolveEntity(bookData.authors, Author, 'name', { type: 'author' });
    }
    if (bookData.commentators) {
      updatePayload.commentators = await this.resolveEntity(bookData.commentators, Author, 'name', { type: 'commentator' });
    }
    if (bookData.editors) {
      updatePayload.editors = await this.resolveEntity(bookData.editors, Author, 'name', { type: 'editor' });
    }
    if (bookData.caretakers) {
      updatePayload.caretakers = await this.resolveEntity(bookData.caretakers, Author, 'name', { type: 'caretaker' });
    }
    if (bookData.muhashis) {
      updatePayload.muhashis = await this.resolveEntity(bookData.muhashis, Author, 'name', { type: 'muhashi' });
    }

    let updatedBook = await BookModel.findByIdAndUpdate(id, updatePayload, { new: true });
    let book = await this.getBookById(updatedBook._id);
    return book;
  }

  async deleteBook(id) {
    // Before deleting the book, consider deleting its associated image file
    const bookToDelete = await BookModel.findById(id);
    if (bookToDelete && bookToDelete.imageUrl) {
      const imagePath = path.join(__dirname, '../', bookToDelete.imageUrl); // Adjust path as needed
      fs.unlink(imagePath, (err) => {
        if (err) console.error('Error deleting associated image file:', err);
      });
    }
    return await BookModel.findByIdAndDelete(id);
  }

  async getCategories() {
    return Category.aggregate([
      {
        $project: {
          title: 1,
        /* other fields you want: */ subjects: 1,
          subjectsCount: { $size: { $ifNull: ["$subjects", []] } }
        }
      }
    ]);
  }


  async createCategory(categoryData) {
    const { title } = categoryData;
    const normalizedTitle = this.normalizeArabicText(title); // ADD THIS
    let category = await Category.findOne({ normalizedTitle }); // CHANGE THIS
    if (!category) {
      category = new Category({
        title,
        normalizedTitle // ADD THIS
      });
      await category.save();
    }
    return category;
  }

  async getsubjects() {
    return await Subject.find();
  }

  async createSubject(subjectData) {
    const { title } = subjectData;
    const normalizedTitle = this.normalizeArabicText(title); // ADD THIS
    let subject = await Subject.findOne({ normalizedTitle }); // CHANGE THIS
    if (!subject) {
      subject = new Subject({
        title,
        normalizedTitle // ADD THIS
      });
      await subject.save();
    }
    return subject;
  }

  async getPeople() {
    return await Author.find();
  }

  async createPerson(personData) {
    const { name, type } = personData;
    const normalizedName = this.normalizeArabicText(name); // ADD THIS
    let person = await Author.findOne({ normalizedName, type }); // CHANGE THIS
    if (!person) {
      person = new Author({
        name,
        type,
        normalizedName // ADD THIS
      });
      await person.save();
    }
    return person;
  }

  async createPublisher(publisherData) {
    const { title } = publisherData;
    const normalizedTitle = this.normalizeArabicText(title); // ADD THIS
    let publisher = await Publisher.findOne({ normalizedTitle }); // CHANGE THIS
    if (!publisher) {
      publisher = new Publisher({
        title,
        normalizedTitle // ADD THIS
      });
      await publisher.save();
    }
    return publisher;
  }

  async getPublishers() {
    return await Publisher.find();
  }
}


module.exports = {
  BookService: new BookService(),
};