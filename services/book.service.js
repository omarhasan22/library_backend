const mongoose = require('mongoose');
const BookModel = require('../models/book.model');
const Category = require('../models/category.model');
const Subject = require('../models/subject.model');
const Author = require('../models/author.model'); // This is your 'Person' model for authors, commentators, etc.
const Publisher = require('../models/publisher.model');


class BookService {
  /**
   * Resolves an entity's ID. If the data contains an _id, it's used.
   * If the data is a plain string, it's treated as an _id.
   * Otherwise, it tries to find the entity by 'field' (e.g., 'title', 'name').
   * If not found, a new entity is created.
   * Handles both single items and arrays of items.
   * @param {Object|Array|string} data - The incoming data for the entity(ies). Can be an object with _id or a specific field, a plain ID string, or an array of such.
   * @param {mongoose.Model} Model - The Mongoose model for the entity (e.g., Category, Subject, Author).
   * @param {string} field - The field to use for finding/creating the entity (e.g., 'title' for Category, 'name' for Author).
   * @param {Object} filter - Additional filter criteria for finding/creating (e.g., { type: 'author' } for Author).
   * @returns {string|Array<string>|null} The resolved _id(s) or null if data is empty.
   */
  async resolveEntity(data, Model, field, filter = {}) {
    if (!data) return null;

    // Normalize data to an array for consistent processing
    let dataArray;
    let isOriginalInputArray = Array.isArray(data);

    if (isOriginalInputArray) {
      dataArray = data;
    } else {
      dataArray = [data];
    }

    const ids = [];

    for (const item of dataArray) {
      // If item is a string that looks like an ObjectId, use it directly
      if (typeof item === 'string' && mongoose.Types.ObjectId.isValid(item.replace(/"/g, ''))) {
        ids.push(item.replace(/"/g, '')); // Strip quotes just in case
      }
      // If item is an object with an _id, use it directly
      else if (typeof item === 'object' && item !== null && item._id && mongoose.Types.ObjectId.isValid(item._id)) {
        ids.push(item._id);
      }
      // If item is an object with the specified field, try to find/create
      else if (typeof item === 'object' && item !== null && item[field]) {
        const query = { [field]: item[field], ...filter };
        let doc = await Model.findOne(query);
        if (!doc) {
          doc = await new Model({ ...filter, [field]: item[field] }).save();
        }
        ids.push(doc._id);
      }
      // Fallback: If it's a string but not a valid ObjectId, assume it's a name/title
      // This is crucial for handling new names/titles passed as strings.
      else if (typeof item === 'string' && !mongoose.Types.ObjectId.isValid(item.replace(/"/g, ''))) {
        const query = { [field]: item.replace(/"/g, ''), ...filter }; // Strip quotes
        let doc = await Model.findOne(query);
        if (!doc) {
          doc = await new Model({ ...filter, [field]: item.replace(/"/g, '') }).save();
        }
        ids.push(doc._id);
      }
    }

    return isOriginalInputArray ? ids : ids[0];
  }

  async createBook(bookData) {
    // 1) resolve IDs for all associated entities based on the incoming payload
    const categoryId = await this.resolveEntity(bookData.category, Category, 'title');
    const subjectId = await this.resolveEntity(bookData.subject, Subject, 'title');
    const publisherIds = await this.resolveEntity(bookData.publishers, Publisher, 'title');
    const authorIds = await this.resolveEntity(bookData.authors, Author, 'name', { type: 'author' });
    const commentatorids = await this.resolveEntity(bookData.commentators, Author, 'name', { type: 'commentator' });
    const editorIds = await this.resolveEntity(bookData.editors, Author, 'name', { type: 'editor' });
    const caretakerIds = await this.resolveEntity(bookData.caretakers, Author, 'name', { type: 'caretaker' });
    const muhashisIds = await this.resolveEntity(bookData.muhashis, Author, 'name', { type: 'muhashi' });

    // FIX: Validate and parse pageCount
    let pageCountValue = parseInt(bookData.pageCount, 10);
    if (isNaN(pageCountValue) || pageCountValue < 0) {
      // If it's "100+", "invalid", or negative, default to a sensible value like 0 or 1,
      // or throw an error if you want strict validation.
      // For now, let's default to 0 if invalid or 1 if it means "at least 1"
      pageCountValue = 0; // Or 1, depending on your desired default for invalid input
      console.warn(`Invalid pageCount received: ${bookData.pageCount}. Defaulting to ${pageCountValue}.`);
    }

    // 2) build document
    const bookObj = {
      title: bookData.title,
      authors: authorIds,
      commentators: commentatorids,
      editors: editorIds,
      caretakers: caretakerIds,
      muhashis: muhashisIds,
      category: categoryId,
      subject: subjectId,
      publishers: publisherIds,
      numberOfVolumes: bookData.numberOfVolumes,
      editionNumber: bookData.editionNumber,
      publicationYear: bookData.publicationYear,
      pageCount: pageCountValue, // Use the parsed/validated value
      address: {
        roomNumber: bookData.address?.roomNumber,
        shelfNumber: bookData.address?.shelfNumber,
        wallNumber: bookData.address?.wallNumber,
        bookNumber: bookData.address?.bookNumber
      },
      imageUrl: bookData.imagePath || '',
      notes: bookData.notes || ''
    };

    // 3) save
    const book = new BookModel(bookObj);
    await book.save();
    return this.getBookById(book._id);
  }
  async getAllBooks(searchOption = '', searchTerm = '') {
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

    // Search logic
    if (searchTerm.trim()) {
      const specificFieldsMap = {
        title: 'title',
        authors: 'authorData.name',
        commentators: 'commentatorData.name',
        editors: 'editorData.name',
        caretakers: 'caretakerData.name',
        muhashis: 'muhashiData.name',
        publishers: 'publisherData.title',
        category: 'categoryData.title',
        subcategory: 'subjectData.title',
        roomNumber: 'address.roomNumber',
        shelfNumber: 'address.shelfNumber',
        wallNumber: 'address.wallNumber',
        bookNumber: 'address.bookNumber'
      };

      const numericFields = ['numberOfVolumes', 'editionNumber', 'publicationYear'];

      if (specificFieldsMap[searchOption]) {
        matchStage.push({
          [specificFieldsMap[searchOption]]: {
            $regex: searchTerm,
            $options: 'i'
          }
        });
      } else if (numericFields.includes(searchOption)) {
        matchStage.push({
          $expr: {
            $regexMatch: {
              input: { $toString: `$${searchOption}` },
              regex: searchTerm,
              options: 'i'
            }
          }
        });
      } else {
        matchStage.push({
          $or: [
            { title: { $regex: searchTerm, $options: 'i' } },
            { 'address.roomNumber': { $regex: searchTerm, $options: 'i' } },
            { 'address.wallNumber': { $regex: searchTerm, $options: 'i' } },
            { 'address.shelfNumber': { $regex: searchTerm, $options: 'i' } },
            { 'address.bookNumber': { $regex: searchTerm, $options: 'i' } },
            { 'authorData.name': { $regex: searchTerm, $options: 'i' } },
            { 'commentatorData.name': { $regex: searchTerm, $options: 'i' } },
            { 'editorData.name': { $regex: searchTerm, $options: 'i' } },
            { 'caretakerData.name': { $regex: searchTerm, $options: 'i' } },
            { 'muhashiData.name': { $regex: searchTerm, $options: 'i' } },
            { 'publisherData.title': { $regex: searchTerm, $options: 'i' } },
            { 'categoryData.title': { $regex: searchTerm, $options: 'i' } },
            { 'subjectData.title': { $regex: searchTerm, $options: 'i' } },
            { $expr: { $regexMatch: { input: { $toString: "$numberOfVolumes" }, regex: searchTerm, options: 'i' } } },
            { $expr: { $regexMatch: { input: { $toString: "$editionNumber" }, regex: searchTerm, options: 'i' } } },
            { $expr: { $regexMatch: { input: { $toString: "$publicationYear" }, regex: searchTerm, options: 'i' } } }
          ]
        });
      }
    }

    // Final pipeline for books
    const booksPipeline = [
      ...lookupStages,
      ...(matchStage.length > 0 ? [{ $match: matchStage.length === 1 ? matchStage[0] : { $and: matchStage } }] : []),
      {
        $project: {
          title: 1,
          numberOfVolumes: 1,
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
      }
    ];

    // Pipeline for counts
    const countsPipeline = [
      ...lookupStages,
      ...(matchStage.length > 0 ? [{ $match: matchStage.length === 1 ? matchStage[0] : { $and: matchStage } }] : []),
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
      BookModel.aggregate(booksPipeline),
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
    let category = await Category.findOne({ title });
    if (!category) {
      category = new Category({ title });
      await category.save();
    }
    return category;
  }

  async getsubjects() {
    return await Subject.find();
  }

  async createSubject(subjectData) {
    const { title } = subjectData;
    let subject = await Subject.findOne({ title });
    if (!subject) {
      subject = new Subject({ title });
      await subject.save();
    }
    return subject;
  }

  async getPeople() {
    return await Author.find();
  }

  async createPerson(personData) {
    const { name, type } = personData;
    let person = await Author.findOne({ name, type });
    if (!person) {
      person = new Author({ name, type });
      await person.save();
    }
    return person;
  }

  async getPublishers() {
    return await Publisher.find();
  }

  async createPublisher(publisherData) {
    const { title } = publisherData;
    let publisher = await Publisher.findOne({ title });
    if (!publisher) {
      publisher = new Publisher({ title });
      await publisher.save();
    }
    return publisher;
  }
}


module.exports = {
  BookService: new BookService(),
};