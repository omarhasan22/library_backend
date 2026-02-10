const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const BookModel = require('../models/book.model');
const Category = require('../models/category.model');
const Subject = require('../models/subject.model');
const Author = require('../models/author.model'); // This is your 'Person' model for authors, commentators, etc.
const Publisher = require('../models/publisher.model');
const BulkUpdateHistory = require('../models/bulk-update-history.model');

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
        const normEsc = this.escapeRegex(normalizedValue);
        const rawEsc = this.escapeRegex(value);
        const pathMap = {
          title: { path: 'normalizedTitle', useNormalized: true },
          category: { path: 'categoryData.normalizedTitle', useNormalized: true },
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

        const cfg = pathMap[field] || { path: field, useNormalized: false };

        // Handle array fields with $elemMatch
        if (cfg.isArray) {
          const parts = cfg.path.split('.');
          const parent = parts.slice(0, -1).join('.');
          const childField = parts.slice(-1)[0];
          if (cfg.useNormalized) {
            return { [parent]: { $elemMatch: { [childField]: { $regex: normEsc, $options: 'i' } } } };
          } else {
            return { [parent]: { $elemMatch: { [childField]: { $regex: rawEsc, $options: 'i' } } } };
          }
        }
        // Handle normalized text fields with regex partial matching
        else if (cfg.useNormalized) {
          return { [cfg.path]: { $regex: normEsc, $options: 'i' } };
        }
        // Handle numeric fields with exact match (no change)
        else if (['numberOfVolumes', 'numberOfFolders', 'editionNumber', 'publicationYear', 'pageCount'].includes(field)) {
          const numValue = Number(value);
          if (!isNaN(numValue)) {
            return { [cfg.path]: numValue };
          }
          return { [cfg.path]: { $regex: rawEsc, $options: 'i' } };
        }
        // Handle other non-normalized text fields with regex
        else {
          return { [cfg.path]: { $regex: rawEsc, $options: 'i' } };
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
        const normEsc = this.escapeRegex(normalizedValue);
        const rawEsc = this.escapeRegex(value);
        const pathMap = {
          title: { path: 'normalizedTitle', useNormalized: true },
          category: { path: 'categoryData.normalizedTitle', useNormalized: true },
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

        const cfg = pathMap[field] || { path: field, useNormalized: false };

        // Handle array fields with $elemMatch
        if (cfg.isArray) {
          const parts = cfg.path.split('.');
          const parent = parts.slice(0, -1).join('.');
          const childField = parts.slice(-1)[0];
          if (cfg.useNormalized) {
            return { [parent]: { $elemMatch: { [childField]: { $regex: normEsc, $options: 'i' } } } };
          } else {
            return { [parent]: { $elemMatch: { [childField]: { $regex: rawEsc, $options: 'i' } } } };
          }
        }
        // Handle normalized text fields with regex partial matching
        else if (cfg.useNormalized) {
          return { [cfg.path]: { $regex: normEsc, $options: 'i' } };
        }
        // Handle numeric fields with exact match (no change)
        else if (['numberOfVolumes', 'numberOfFolders', 'editionNumber', 'publicationYear', 'pageCount'].includes(field)) {
          const numValue = Number(value);
          if (!isNaN(numValue)) {
            return { [cfg.path]: numValue };
          }
          return { [cfg.path]: { $regex: rawEsc, $options: 'i' } };
        }
        // Handle other non-normalized text fields with regex
        else {
          return { [cfg.path]: { $regex: rawEsc, $options: 'i' } };
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

    // Lookup stages for subject and category (must come before match stages that reference them)
    const lookupStages = [
      {
        $lookup: {
          from: 'subjects',
          localField: 'subject',
          foreignField: '_id',
          as: 'subject'
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'category'
        }
      }
    ];

    // Build matchStage for additional filters (reuse logic from exportBooksToExcel)
    // First, apply room number filter
    const matchStage = [{ $match: { "address.roomNumber": String(roomNumber) } }];

    // Then apply additional filters if provided (after lookups)
    if (query === 'advanced') {
      let filters = [];
      try { filters = JSON.parse(searchTerm); } catch (e) { filters = []; }

      // Filter out roomNumber from additional filters since we already applied it
      const additionalFilters = filters.filter(f => f.field !== 'roomNumber');

      if (additionalFilters.length > 0) {
        const conditions = additionalFilters.map(({ field, value }) => {
          const normalizedValue = this.normalizeArabicText(value);
          const normEsc = this.escapeRegex(normalizedValue);
          const rawEsc = this.escapeRegex(value);
          // For locations export, only use direct Book fields (no lookups needed for filtering)
          const pathMap = {
            title: { path: 'normalizedTitle', useNormalized: true },
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

          const cfg = pathMap[field];
          if (!cfg) return null; // Skip fields not in pathMap

          if (cfg.useNormalized) {
            return { [cfg.path]: { $regex: normEsc, $options: 'i' } };
          } else if (['numberOfVolumes', 'numberOfFolders', 'editionNumber', 'publicationYear', 'pageCount'].includes(field)) {
            const numValue = Number(value);
            if (!isNaN(numValue)) {
              return { [cfg.path]: numValue };
            }
            return { [cfg.path]: { $regex: rawEsc, $options: 'i' } };
          } else {
            return { [cfg.path]: { $regex: rawEsc, $options: 'i' } };
          }
        }).filter(c => c !== null); // Remove null conditions

        if (conditions.length) {
          matchStage.push({ $match: { $and: conditions } });
        }
      }
    } else if (searchTerm && String(searchTerm).trim()) {
      // Simple search - apply additional filters but exclude roomNumber
      const rawTerm = String(searchTerm).trim();
      const normalizedSearchTerm = this.normalizeArabicText(rawTerm) || rawTerm;
      const rawEsc = this.escapeRegex(rawTerm);
      const normEsc = this.escapeRegex(normalizedSearchTerm);

      const orConditions = [];
      // For simple search in locations export, only search in title and address fields
      orConditions.push({ normalizedTitle: { $regex: normEsc, $options: 'i' } });
      orConditions.push({ 'address.shelfNumber': { $regex: rawEsc, $options: 'i' } });
      orConditions.push({ 'address.wallNumber': { $regex: rawEsc, $options: 'i' } });
      orConditions.push({ 'address.bookNumber': { $regex: rawEsc, $options: 'i' } });
      orConditions.push({ notes: { $regex: rawEsc, $options: 'i' } });
      if (orConditions.length) {
        matchStage.push({ $match: { $or: orConditions } });
      }
    }

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

    // Build pipeline
    // Order: room filter first (for performance), then lookups, then additional filters, then project, then unwind
    const roomFilter = matchStage[0]; // First match is room filter
    const additionalFilters = matchStage.slice(1); // Rest are additional filters

    const pipeline = [
      roomFilter, // Apply room filter first for performance
      ...lookupStages, // Then do lookups
      ...additionalFilters, // Then apply additional filters (if any)
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

      // Add book number range filter
      const bookNumberFrom = parseInt(criteria.bookNumberFrom, 10);
      const bookNumberTo = parseInt(criteria.bookNumberTo, 10);

      if (isNaN(bookNumberFrom) || isNaN(bookNumberTo)) {
        throw new Error('Book number range must be valid numbers');
      }

      if (bookNumberFrom > bookNumberTo) {
        throw new Error('Book number "from" must be less than or equal to "to"');
      }

      // Build query with $and to combine all conditions
      const queryConditions = [
        { 'address.shelfNumber': String(criteria.shelfNumber) }
      ];

      // Add optional filters
      if (criteria.roomNumber) {
        queryConditions.push({ 'address.roomNumber': criteria.roomNumber });
      }
      if (criteria.wallNumber) {
        queryConditions.push({ 'address.wallNumber': criteria.wallNumber });
      }

      // Add book number range filter - generate explicit list to avoid string comparison issues
      const bookNumberStrings = [];
      for (let i = bookNumberFrom; i <= bookNumberTo; i++) {
        bookNumberStrings.push(String(i));
      }
      queryConditions.push({
        'address.bookNumber': { $in: bookNumberStrings }
      });

      const query = { $and: queryConditions };

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

      // Count matching books before update
      const countBefore = await BookModel.countDocuments(query);

      // Perform bulk update
      const updateResult = await BookModel.updateMany(
        query,
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
          bookNumberFrom: bookNumberFrom,
          bookNumberTo: bookNumberTo
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

      // Add book number range filter
      const bookNumberFrom = parseInt(criteria.bookNumberFrom, 10);
      const bookNumberTo = parseInt(criteria.bookNumberTo, 10);

      if (isNaN(bookNumberFrom) || isNaN(bookNumberTo)) {
        throw new Error('Book number range must be valid numbers');
      }

      if (bookNumberFrom > bookNumberTo) {
        throw new Error('Book number "from" must be less than or equal to "to"');
      }

      // Build query with $and to combine all conditions
      const queryConditions = [
        { 'address.shelfNumber': String(criteria.shelfNumber) }
      ];

      // Add optional filters
      if (criteria.roomNumber) {
        queryConditions.push({ 'address.roomNumber': criteria.roomNumber });
      }
      if (criteria.wallNumber) {
        queryConditions.push({ 'address.wallNumber': criteria.wallNumber });
      }

      // Add book number range filter - generate explicit list to avoid string comparison issues
      const bookNumberStrings = [];
      for (let i = bookNumberFrom; i <= bookNumberTo; i++) {
        bookNumberStrings.push(String(i));
      }
      queryConditions.push({
        'address.bookNumber': { $in: bookNumberStrings }
      });

      const query = { $and: queryConditions };

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

      // Count matching books before update
      const countBefore = await BookModel.countDocuments(query);

      // Perform bulk update
      const updateResult = await BookModel.updateMany(
        query,
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
          bookNumberFrom: bookNumberFrom,
          bookNumberTo: bookNumberTo
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