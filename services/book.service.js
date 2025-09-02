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
    limit = 20,
    sortField = null,
    sortDirection = 'asc'
  ) {
    // normalize numeric params
    page = Number(page) || 1;
    limit = Number(limit) || 20;
    const skip = (page - 1) * limit;
    const sortDir = sortDirection === 'desc' ? -1 : 1;
    console.log("query ", query);
    console.log("searchTerm ", searchTerm);

    // lookups (same as you had)
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

    // build matchStage same logic, but produce an array `matchStage` to spread later
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
          // match exact normalized value (you used normalized plain equality earlier)
          return { [cfg.path]: normalizedValue };
        } else {
          return { [cfg.path]: { $regex: value, $options: 'i' } };
        }
      });

      if (conditions.length) matchStage.push({ $match: { $and: conditions } });

    }
    else if (searchTerm && String(searchTerm).trim()) {
      const rawTerm = String(searchTerm).trim();
      // fallback: if normalize returns empty, use rawTerm
      const normalizedSearchTerm = this.normalizeArabicText(rawTerm) || rawTerm;

      const rawEsc = this.escapeRegex(rawTerm);
      const normEsc = this.escapeRegex(normalizedSearchTerm);
      console.log("normEsc ", normEsc);

      // map of searchable fields and whether they are normalized in DB
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

      // If the client requested a single field via `query` (e.g., q=title)
      const fieldConfig = pathMap[query] || null;

      if (fieldConfig) {
        // build single-field match
        if (fieldConfig.isArray) {
          // use $elemMatch for arrays of subdocs (safer)
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
          // normal field (string or number)
          matchStage.push({
            $match: {
              [fieldConfig.path]: { $regex: fieldConfig.useNormalized ? normEsc : rawEsc, $options: 'i' }
            }
          });
        }
      } else {
        // build an $or across many fields (default broad search)
        const orConditions = [];

        // normalized string fields
        ['title', 'category', 'subject', 'subcategory', 'publishers'].forEach(k => {
          const cfg = pathMap[k];
          if (!cfg) return;
          orConditions.push({ [cfg.path]: { $regex: normEsc, $options: 'i' } });
        });

        // author-like arrays (use $elemMatch)
        ['authors', 'editors', 'commentators', 'caretakers', 'muhashis'].forEach(k => {
          const cfg = pathMap[k];
          if (!cfg) return;
          // parent array path, last part is field in subdoc
          const parts = cfg.path.split('.');
          const parent = parts.slice(0, -1).join('.');
          const childField = parts.slice(-1)[0];
          orConditions.push({ [parent]: { $elemMatch: { [childField]: { $regex: normEsc, $options: 'i' } } } });
          // also try matching top-level dotted path (some Mongo versions accept it)
          orConditions.push({ [cfg.path]: { $regex: normEsc, $options: 'i' } });
        });

        // raw fields (address numeric fields and plain text)
        ['roomNumber', 'shelfNumber', 'wallNumber', 'bookNumber', 'notes'].forEach(k => {
          const cfg = pathMap[k];
          if (!cfg) return;
          orConditions.push({ [cfg.path]: { $regex: rawEsc, $options: 'i' } });
        });

        // numeric fields: try exact match if the term is numeric
        if (!Number.isNaN(Number(rawTerm))) {
          const n = Number(rawTerm);
          ['numberOfVolumes', 'numberOfFolders', 'editionNumber', 'publicationYear', 'pageCount'].forEach(k => {
            const cfg = pathMap[k];
            if (!cfg) return;
            orConditions.push({ [cfg.path]: n });
          });
        } else {
          // also search numeric-like fields as strings
          ['numberOfVolumes', 'numberOfFolders', 'editionNumber', 'publicationYear', 'pageCount'].forEach(k => {
            const cfg = pathMap[k];
            if (!cfg) return;
            orConditions.push({ [cfg.path]: { $regex: rawEsc, $options: 'i' } });
          });
        }

        // final push if we have any conditions
        if (orConditions.length) {
          matchStage.push({ $match: { $or: orConditions } });
        } else {
          // fallback: no conditions => do not restrict (but log to debug)
          console.warn('No search conditions created for non-advanced searchTerm:', rawTerm);
        }
      }
    }

    // projection: build displayAddress that avoids names and appends volume when >1
    const projectStage = {
      $project: {
        title: 1,
        normalizedTitle: 1,
        numberOfVolumes: 1,
        numberOfFolders: 1,
        editionNumber: 1,
        publicationYear: 1,
        pageCount: 1,
        // keep raw address object if needed elsewhere but don't render names from it:
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

        // displayAddress: compose only numeric address pieces and append volume count only when > 1
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
                      // reduce parts into a string separated by " / " ignoring empty values
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
                      // append volume suffix only if numberOfVolumes exists and > 1
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

    // Build one pipeline that uses facet to return both paginated docs and counts/uniques
    const pipeline = [
      ...lookupStages,
      ...matchStage,
      // project early so counts can use populated arrays (authorData/publisherData) for unique counts
      projectStage,
      // optional sort
      ...(sortField ? [{ $sort: { [sortField]: sortDir } }] : []),
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
            // unwind populated authors and count unique author _ids
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
      // flatten counts into predictable values
      {
        $project: {
          paginatedResults: 1,
          filteredCount: { $ifNull: [{ $arrayElemAt: ['$counts.filteredCount', 0] }, 0] },
          uniqueAuthors: { $ifNull: [{ $arrayElemAt: ['$uniqueAuthors.count', 0] }, 0] },
          uniquePublishers: { $ifNull: [{ $arrayElemAt: ['$uniquePublishers.count', 0] }, 0] }
        }
      }
    ];

    // Execute aggregation
    const aggResult = await BookModel.aggregate(pipeline);

    // aggResult is an array with a single doc
    const resultDoc = aggResult[0] || { paginatedResults: [], filteredCount: 0, uniqueAuthors: 0, uniquePublishers: 0 };

    // totalBooks: still useful - total collection size without filters
    const totalAll = await BookModel.countDocuments();

    return {
      books: resultDoc.paginatedResults || [],
      totalBooks: totalAll || 0,
      filteredCount: resultDoc.filteredCount || 0,
      uniqueAuthors: resultDoc.uniqueAuthors || 0,
      uniquePublishers: resultDoc.uniquePublishers || 0
    };
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