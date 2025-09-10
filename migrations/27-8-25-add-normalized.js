// migrations/add-normalized-fields.js
const mongoose = require('mongoose');
const MONGO_URI = process.env.MONGO_URI_PROD

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

// Import models
const Author = require('../models/author.model');
const Book = require('../models/book.model');
const Category = require('../models/category.model');
const Publisher = require('../models/publisher.model');
const Subject = require('../models/subject.model');

normalizeString = (text) => {
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

async function addNormalizedFields() {
   try {
      console.log('🚀 Starting migration...');

      // Books -> normalizedTitle
      const books = await Book.find({});
      for (const book of books) {
         let updated = false;

         // Normalize title
         if (book.title && !book.normalizedTitle) {
            book.normalizedTitle = normalizeString(book.title);
            updated = true;
         }

         // Fix pageCount if less than 1
         if (book.pageCount !== undefined && book.pageCount < 1) {
            book.pageCount = 1;
            updated = true;
         }

         if (updated) {
            await book.save();
         }
      }
      console.log(`✅ Updated ${books.length} books`);

      // Authors -> normalizedName
      const authors = await Author.find({});
      let authorsUpdated = 0;
      for (const author of authors) {
         if (author.name && !author.normalizedName) {
            author.normalizedName = normalizeString(author.name);
            await author.save();
            authorsUpdated++;
         }
      }
      console.log(`✅ Updated ${authorsUpdated}/${authors.length} authors`);

      // Categories -> normalizedTitle
      const categories = await Category.find({});
      let categoriesUpdated = 0;
      for (const category of categories) {
         if (category.title && !category.normalizedTitle) {
            category.normalizedTitle = normalizeString(category.title);
            await category.save();
            categoriesUpdated++;
         }
      }
      console.log(`✅ Updated ${categoriesUpdated}/${categories.length} categories`);

      // Publishers -> normalizedTitle
      const publishers = await Publisher.find({});
      let publishersUpdated = 0;
      for (const publisher of publishers) {
         if (publisher.title && !publisher.normalizedTitle) {
            publisher.normalizedTitle = normalizeString(publisher.title);
            await publisher.save();
            publishersUpdated++;
         }
      }
      console.log(`✅ Updated ${publishersUpdated}/${publishers.length} publishers`);

      // Subjects -> normalizedTitle
      const subjects = await Subject.find({});
      let subjectsUpdated = 0;
      for (const subject of subjects) {
         if (subject.title && !subject.normalizedTitle) {
            subject.normalizedTitle = normalizeString(subject.title);
            await subject.save();
            subjectsUpdated++;
         }
      }
      console.log(`✅ Updated ${subjectsUpdated}/${subjects.length} subjects`);

      // Summary statistics
      console.log('\n📊 Migration Summary:');
      console.log(`   Books: ${books.length} processed`);
      console.log(`   Authors: ${authorsUpdated}/${authors.length} updated`);
      console.log(`   Categories: ${categoriesUpdated}/${categories.length} updated`);
      console.log(`   Publishers: ${publishersUpdated}/${publishers.length} updated`);
      console.log(`   Subjects: ${subjectsUpdated}/${subjects.length} updated`);

      console.log('\n🎉 Migration finished successfully!');
      process.exit(0);
   } catch (err) {
      console.error('❌ Migration failed:', err);
      process.exit(1);
   }
}

addNormalizedFields();