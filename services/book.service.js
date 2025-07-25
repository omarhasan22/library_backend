const mongoose = require('mongoose');
const BookModel = require('../models/book.model');
const Category = require('../models/category.model');
const Subject = require('../models/subject.model');
const Author = require('../models/author.model');
const Publisher = require('../models/publisher.model');


class BookService {
  async resolveEntity(data, Model, field, filter = {}) {
    if (!data) return null;

    const dataArray = Array.isArray(data) ? data : [data];
    const ids = [];

    for (const item of dataArray) {
      // إذا كان يحتوي على _id موجود، نستخدمه مباشرة
      if (item._id) {
        ids.push(item._id);
      } else if (item[field]) {
        const query = { [field]: item[field], ...filter };
        let doc = await Model.findOne(query);
        if (!doc) {
          doc = await new Model({ ...filter, [field]: item[field] }).save();
        }
        ids.push(doc._id);
      }
    }

    // إذا كان الأصل قيمة مفردة، أرجع _id مفرد
    return Array.isArray(data) ? ids : ids[0];
  }

  async createBook(bookData) {
    // 1) resolve IDs
    const categoryId = await this.resolveEntity(bookData.category, Category, 'title');
    const subjectId = await this.resolveEntity(bookData.subject, Subject, 'title');
    const publisherIds = await this.resolveEntity(bookData.publishers, Publisher, 'title');
    const authorIds = await this.resolveEntity(bookData.authors, Author, 'name', { type: 'author' });
    const commentatorids = await this.resolveEntity(bookData.commentator, Author, 'name', { type: 'commentator' });
    const editorIds = await this.resolveEntity(bookData.editors, Author, 'name', { type: 'editor' });
    const caretakerIds = await this.resolveEntity(bookData.caretakers, Author, 'name', { type: 'caretaker' });

    console.log("editorIds ", editorIds);

    // 2) build document
    const bookObj = {
      title: bookData.title,
      authors: authorIds,
      commentator: commentatorids,
      editors: editorIds,
      caretakers: caretakerIds,
      category: categoryId,
      subject: subjectId,
      publishers: publisherIds,
      numberOfVolumes: bookData.numberOfVolumes,
      editionNumber: bookData.editionNumber,
      publicationYear: bookData.publicationYear,
      pageCount: bookData.pageCount,
      address: {
        roomNumber: bookData.address?.roomNumber,
        shelfNumber: bookData.address?.shelfNumber,
        wallNumber: bookData.address?.wallNumber,
        bookNumber: bookData.address?.bookNumber
      },
      imageUrl: bookData.imagePath || ''
    };

    // 3) save
    const book = new BookModel(bookObj);
    await book.save();
    return this.getBookById(book._id);
  }


  async getAllBooks(query = '') {
    const pipeline = [
      // Lookup all related collections
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
          localField: 'commentator',
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
            { 'commentatorData.name': { $regex: query, $options: 'i' } },
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
        authors: '$authorData',
        commentator: '$commentatorData',
        editors: '$editorData',
        caretakers: '$caretakerData',
        publishers: '$publisherData',
        category: { $arrayElemAt: ['$categoryData', 0] },
        subject: { $arrayElemAt: ['$subjectData', 0] },
      }
    });

    return await BookModel.aggregate(pipeline);
  }

  async getBookById(id) {
    return await BookModel.findById(id).populate([
      { path: 'category', select: 'title' },
      { path: 'subject', select: 'title' },
      { path: 'authors', select: 'name type' },    // type helps if you want to show role
      { path: 'editors', select: 'name type' },
      { path: 'caretakers', select: 'name type' },
      { path: 'publishers', select: 'title' },
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
