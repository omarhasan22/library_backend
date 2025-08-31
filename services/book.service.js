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

  async getAllBooks(query = '', searchTerm = '') {
    // Lookup stages
    const lookupStages = [
      {
        $lookup: {
          from: 'authors',
          localField: 'authors',
          foreignField: '_id',
          as: 'authorData'
        }
      },
      {
        $lookup: {
          from: 'authors',
          localField: 'commentators',
          foreignField: '_id',
          as: 'commentatorData'
        }
      },
      {
        $lookup: {
          from: 'authors',
          localField: 'editors',
          foreignField: '_id',
          as: 'editorData'
        }
      },
      {
        $lookup: {
          from: 'authors',
          localField: 'caretakers',
          foreignField: '_id',
          as: 'caretakerData'
        }
      },
      {
        $lookup: {
          from: 'authors',
          localField: 'muhashis',
          foreignField: '_id',
          as: 'muhashiData'
        }
      },
      {
        $lookup: {
          from: 'publishers',
          localField: 'publishers',
          foreignField: '_id',
          as: 'publisherData'
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'categoryData'
        }
      },
      {
        $lookup: {
          from: 'subjects',
          localField: 'subject',
          foreignField: '_id',
          as: 'subjectData'
        }
      }
    ];

    const matchStage = [];

    if (query === 'advanced') {
      let filters = [];
      try {
        filters = JSON.parse(searchTerm);
      } catch {
        filters = [];
      }

      const conditions = filters.map(({ field, value }) => {
        // Normalize the search value
        const normalizedValue = this.normalizeArabicText(value);

        // Map fields to their paths and determine if they should use normalized fields
        const pathMap = {
          // For title fields, use normalized versions
          title: { path: 'normalizedTitle', useNormalized: true },
          category: { path: 'categoryData.normalizedTitle', useNormalized: true },
          subject: { path: 'subjectData.normalizedTitle', useNormalized: true },
          publishers: { path: 'publisherData.normalizedTitle', useNormalized: true },

          // For name fields, use normalized versions
          authors: { path: 'authorData.normalizedName', useNormalized: true },
          editors: { path: 'editorData.normalizedName', useNormalized: true },
          commentators: { path: 'commentatorData.normalizedName', useNormalized: true },
          caretakers: { path: 'caretakerData.normalizedName', useNormalized: true },
          muhashis: { path: 'muhashiData.normalizedName', useNormalized: true },

          // Address fields don't need normalization
          roomNumber: { path: 'address.roomNumber', useNormalized: false },
          shelfNumber: { path: 'address.shelfNumber', useNormalized: false },
          wallNumber: { path: 'address.wallNumber', useNormalized: false },
          bookNumber: { path: 'address.bookNumber', useNormalized: false },

          // Other fields
          numberOfVolumes: { path: 'numberOfVolumes', useNormalized: false },
          numberOfFolders: { path: 'numberOfFolders', useNormalized: false },
          editionNumber: { path: 'editionNumber', useNormalized: false },
          publicationYear: { path: 'publicationYear', useNormalized: false },
          pageCount: { path: 'pageCount', useNormalized: false },
          notes: { path: 'notes', useNormalized: false }
        };

        const fieldConfig = pathMap[field] || { path: field, useNormalized: false };

        if (fieldConfig.useNormalized) {
          // For normalized fields, use exact match with normalized value
          return {
            [fieldConfig.path]: normalizedValue
          };
        } else {
          // For non-normalized fields, use regex as before
          return {
            [fieldConfig.path]: { $regex: value, $options: 'i' }
          };
        }
      });

      if (conditions.length) {
        matchStage.push({ $match: { $and: conditions } });
      }

    } else if (searchTerm.trim()) {
      // Normalize the search term
      const normalizedSearchTerm = this.normalizeArabicText(searchTerm);

      // Define path mappings with normalization info
      const pathMap = {
        // Title searches - use normalized fields
        title: { path: 'normalizedTitle', useNormalized: true },
        category: { path: 'categoryData.normalizedTitle', useNormalized: true },
        subcategory: { path: 'subjectData.normalizedTitle', useNormalized: true },
        subject: { path: 'subjectData.normalizedTitle', useNormalized: true },
        publishers: { path: 'publisherData.normalizedTitle', useNormalized: true },

        // Name searches - use normalized fields
        authors: { path: 'authorData.normalizedName', useNormalized: true },
        editors: { path: 'editorData.normalizedName', useNormalized: true },
        commentators: { path: 'commentatorData.normalizedName', useNormalized: true },
        caretakers: { path: 'caretakerData.normalizedName', useNormalized: true },
        muhashis: { path: 'muhashiData.normalizedName', useNormalized: true },

        // Address fields - no normalization needed
        roomNumber: { path: 'address.roomNumber', useNormalized: false },
        shelfNumber: { path: 'address.shelfNumber', useNormalized: false },
        wallNumber: { path: 'address.wallNumber', useNormalized: false },
        bookNumber: { path: 'address.bookNumber', useNormalized: false }
      };

      const fieldConfig = pathMap[query] || { path: query, useNormalized: false };

      if (fieldConfig.useNormalized) {
        // For normalized fields, search using the normalized value
        // Using regex on normalized field for partial matching
        matchStage.push({
          $match: {
            [fieldConfig.path]: { $regex: normalizedSearchTerm, $options: 'i' }
          }
        });
      } else {
        // For non-normalized fields, use regular regex search
        matchStage.push({
          $match: {
            [fieldConfig.path]: { $regex: searchTerm, $options: 'i' }
          }
        });
      }
    }

    const projectStage = {
      $project: {
        title: 1,
        normalizedTitle: 1, // Include normalized field in results if needed
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
      }
    };

    const pipeline = [
      ...lookupStages,
      ...matchStage,
      projectStage
    ];

    const countsPipeline = [
      ...lookupStages,
      ...matchStage,
      {
        $facet: {
          totalBooks: [{ $count: 'count' }],
          uniqueAuthors: [
            { $unwind: '$authors' },
            { $group: { _id: '$authors' } },
            { $count: 'count' }
          ],
          uniquePublishers: [
            { $unwind: '$publishers' },
            { $group: { _id: '$publishers' } },
            { $count: 'count' }
          ]
        }
      },
      {
        $project: {
          totalBooks: { $ifNull: [{ $arrayElemAt: ['$totalBooks.count', 0] }, 0] },
          uniqueAuthors: { $ifNull: [{ $arrayElemAt: ['$uniqueAuthors.count', 0] }, 0] },
          uniquePublishers: { $ifNull: [{ $arrayElemAt: ['$uniquePublishers.count', 0] }, 0] }
        }
      }
    ];

    const [books, [counts]] = await Promise.all([
      BookModel.aggregate(pipeline),
      BookModel.aggregate(countsPipeline)
    ]);

    return {
      books,
      totalBooks: counts?.totalBooks || 0,
      uniqueAuthors: counts?.uniqueAuthors || 0,
      uniquePublishers: counts?.uniquePublishers || 0
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
    return await Category.find();
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