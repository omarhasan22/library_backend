const mongoose = require('mongoose');
const BookModel = require('../models/book.model');
const Category = require('../models/category.model');
const Subject = require('../models/subject.model');
const Author = require('../models/author.model');
const Publisher = require('../models/publisher.model');


class BookService {
  async resolveEntity(data, Model, field, filter = {}) {
    if (!data || !data[field]) return null;
    const query = { [field]: data[field], ...filter };
    let doc = await Model.findOne(query);
    if (!doc) doc = await new Model({ ...filter, [field]: data[field] }).save();
    return doc._id;
  }

  async createBook(bookData) {
    // 1) resolve IDs
    const categoryId = await this.resolveEntity(bookData.category, Category, 'title');
    const subjectId = await this.resolveEntity(bookData.subject, Subject, 'title');
    const publisherId = await this.resolveEntity(bookData.publisher, Publisher, 'title');

    const authorId = await this.resolveEntity(bookData.author, Author, 'name', { type: 'author' });
    const muhashiId = await this.resolveEntity(bookData.muhashi, Author, 'name', { type: 'muhashi' });
    const editorId = await this.resolveEntity(bookData.editor, Author, 'name', { type: 'editor' });
    const caretakerId = await this.resolveEntity(bookData.caretaker, Author, 'name', { type: 'caretaker' });

    // 2) build document
    const bookObj = {
      title: bookData.title,
      author: authorId,
      muhashi: muhashiId,
      editor: editorId,
      caretaker: caretakerId,
      category: categoryId,
      publisher: publisherId,
      numberOfVolumes: bookData.numberOfVolumes,
      editionNumber: bookData.editionNumber,
      publicationYear: bookData.publicationYear,
      subject: subjectId,
      pageCount: bookData.pageCount,
      address: {
        roomNumber: bookData.address?.roomNumber,
        shelfNumber: bookData.address?.shelfNumber,
        wallNumber: bookData.address?.wallNumber,
        bookNumber: bookData.address?.bookNumber
      },
      imageUrl: bookData.imagePath   // saved by controller
    };

    // 3) save
    const book = new BookModel(bookObj);
    return await book.save();
  }

  async getAllBooks(query = '') {
    const pipeline = [
      // Lookup all related collections
      {
        $lookup: {
          from: 'authors',
          localField: 'author',
          foreignField: '_id',
          as: 'authorData'
        }
      },
      {
        $lookup: {
          from: 'authors',
          localField: 'muhashi',
          foreignField: '_id',
          as: 'muhashiData'
        }
      },
      {
        $lookup: {
          from: 'authors',
          localField: 'editor',
          foreignField: '_id',
          as: 'editorData'
        }
      },
      {
        $lookup: {
          from: 'authors',
          localField: 'caretaker',
          foreignField: '_id',
          as: 'caretakerData'
        }
      },
      {
        $lookup: {
          from: 'publishers',
          localField: 'publisher',
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

    // Add search stage if query provided
    if (query) {
      const searchStage = {
        $match: {
          $or: [
            { title: { $regex: query, $options: 'i' } },
            { 'address.roomNumber': { $regex: query, $options: 'i' } },
            { 'address.wallNumber': { $regex: query, $options: 'i' } },
            { 'address.shelfNumber': { $regex: query, $options: 'i' } },
            { 'address.bookNumber': { $regex: query, $options: 'i' } },
            { 'authorData.name': { $regex: query, $options: 'i' } },
            { 'muhashiData.name': { $regex: query, $options: 'i' } },
            { 'editorData.name': { $regex: query, $options: 'i' } },
            { 'caretakerData.name': { $regex: query, $options: 'i' } },
            { 'publisherData.title': { $regex: query, $options: 'i' } },
            { 'categoryData.title': { $regex: query, $options: 'i' } },
            { 'subjectData.title': { $regex: query, $options: 'i' } }
          ]
        }
      };
      pipeline.push(searchStage);
    }

    // Add projection stage to format the output
    pipeline.push({
      $project: {
        title: 1,
        numberOfVolumes: 1,
        editionNumber: 1,
        publicationYear: 1,
        pageCount: 1,
        address: 1,
        imageUrl: 1,
        author: { $arrayElemAt: ['$authorData', 0] },
        muhashi: { $arrayElemAt: ['$muhashiData', 0] },
        editor: { $arrayElemAt: ['$editorData', 0] },
        caretaker: { $arrayElemAt: ['$caretakerData', 0] },
        publisher: { $arrayElemAt: ['$publisherData', 0] },
        category: { $arrayElemAt: ['$categoryData', 0] },
        subject: { $arrayElemAt: ['$subjectData', 0] }
      }
    });

    return await BookModel.aggregate(pipeline);
  }

  async getBookById(id) {
    return await BookModel.findById(id).populate([
      // { path: 'author' },
      // { path: 'muhashi' },
      // { path: 'editor' },
      // { path: 'caretaker' },
      // { path: 'category' },
      // { path: 'subject' },
      // { path: 'publisher' },

      { path: 'category', select: 'title' },
      { path: 'subject', select: 'title' },
      { path: 'author', select: 'name type' },    // type helps if you want to show role
      { path: 'editor', select: 'name type' },
      { path: 'caretaker', select: 'name type' },
      { path: 'publisher', select: 'title' },
    ]);
  }

  async updateBook(id, bookData) {
    // if new imagePath provided, overwrite imageUrl
    const update = { ...bookData };
    if (bookData.imagePath) update.imageUrl = bookData.imagePath;
    return BookModel.findByIdAndUpdate(id, update, { new: true });
  }

  async deleteBook(id) {
    return await BookModel.findByIdAndDelete(id);
  }
  async getCategories() {
    return await Category.find();
  }

  async getsubjects() {
    return await Subject.find();
  }

  async getPeople() {
    return await Author.find();
  }

  async getPublishers() {
    return await Publisher.find();
  }
}


module.exports = {
  BookService: new BookService(),
};
