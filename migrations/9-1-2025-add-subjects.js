// migrations/populateCategorySubjects.js
// Usage:
//   MONGO_URI="mongodb://localhost:27017/yourdb" node migrations/populateCategorySubjects.js
// For dry-run (no writes):
//   DRY_RUN=true MONGO_URI="..." node migrations/populateCategorySubjects.js

const mongoose = require('mongoose');
const MONGO_URI = process.env.MONGO_URI_PROD
const DRY_RUN = !!process.env.DRY_RUN;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '1000', 10);

function normalizeTitle(s) {
   if (!s && s !== 0) return '';
   return String(s)
      .normalize('NFKD')              // decompose diacritics
      .replace(/[\u0300-\u036f]/g, '') // remove diacritics
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\p{L}\p{N} \-]/gu, '')   // Unicode-aware character removal
      ;
}

// Adjust these requires/paths to match your project structure
const Category = require('../models/category.model');
const Subject = require('../models/subject.model');
const Book = require('../models/book.model');

async function resolveCategory(book, categoriesById, categoriesByTitle) {
   // Try as ObjectId
   const possible = book.category;
   if (!possible && possible !== 0) return null;

   // If it's an object with _id
   if (possible && typeof possible === 'object' && possible._id) {
      const id = String(possible._id);
      if (categoriesById[id]) return categoriesById[id];
      // otherwise try find in DB by id
      try {
         const cat = await Category.findById(id).lean();
         if (cat) {
            categoriesById[id] = cat;
            if (cat.title) categoriesByTitle[normalizeTitle(cat.title)] = cat;
            return cat;
         }
      } catch (e) { }
   }

   // If it's an ObjectId-like string
   if (typeof possible === 'string' && mongoose.Types.ObjectId.isValid(possible)) {
      const id = possible;
      if (categoriesById[id]) return categoriesById[id];
      const cat = await Category.findById(id).lean();
      if (cat) {
         categoriesById[id] = cat;
         if (cat.title) categoriesByTitle[normalizeTitle(cat.title)] = cat;
         return cat;
      }
   }

   // If string title
   const titleStr = (typeof possible === 'string') ? possible : (possible.title || possible.normalizedTitle || null);
   if (titleStr) {
      const key = normalizeTitle(titleStr);
      if (categoriesByTitle[key]) return categoriesByTitle[key];
      const cat = await Category.findOne({
         $or: [
            { title: new RegExp('^' + escapeRegex(titleStr) + '$', 'i') },
            { normalizedTitle: new RegExp('^' + escapeRegex(titleStr) + '$', 'i') },
         ]
      }).lean();
      if (cat) {
         categoriesById[String(cat._id)] = cat;
         categoriesByTitle[key] = cat;
         return cat;
      }
   }

   return null;
}

async function resolveSubject(book, subjectsById, subjectsByTitle) {
   const possible = book.subject;
   // If embedded object
   if (possible && typeof possible === 'object' && possible._id) {
      const id = String(possible._id);
      if (subjectsById[id]) return subjectsById[id];
      let subj = await Subject.findById(id).lean();
      if (subj) {
         subjectsById[id] = subj;
         subjectsByTitle[normalizeTitle(subj.title)] = subj;
         return subj;
      }
      // fallback to using embedded data
      subj = {
         _id: id,
         title: possible.title || '',
         normalizedTitle: possible.normalizedTitle || normalizeTitle(possible.title || '')
      };
      subjectsById[id] = subj;
      if (subj.title) subjectsByTitle[normalizeTitle(subj.title)] = subj;
      return subj;
   }

   // If an ObjectId-like string
   if (typeof possible === 'string' && mongoose.Types.ObjectId.isValid(possible)) {
      const id = possible;
      if (subjectsById[id]) return subjectsById[id];
      let subj = await Subject.findById(id).lean();
      if (subj) {
         subjectsById[id] = subj;
         subjectsByTitle[normalizeTitle(subj.title)] = subj;
         return subj;
      }
      // not found -> return placeholder object with id only
      subj = { _id: id, title: '', normalizedTitle: '' };
      subjectsById[id] = subj;
      return subj;
   }

   // If embedded object with title or plain string
   let title = null;
   if (possible && typeof possible === 'object') {
      title = possible.title || possible.normalizedTitle || null;
   }
   if (typeof possible === 'string') title = possible;

   if (!title) return null;

   const nTitle = normalizeTitle(title);
   if (subjectsByTitle[nTitle]) return subjectsByTitle[nTitle];

   // try to find existing Subject doc by title or normalizedTitle
   let subj = await Subject.findOne({
      $or: [
         { title: new RegExp('^' + escapeRegex(title) + '$', 'i') },
         { normalizedTitle: new RegExp('^' + escapeRegex(nTitle) + '$', 'i') },
      ]
   }).lean();

   if (subj) {
      subjectsById[String(subj._id)] = subj;
      subjectsByTitle[nTitle] = subj;
      return subj;
   }

   // If not found, create new Subject (unless dry-run)
   const newSubjData = {
      title: String(title).trim(),
      normalizedTitle: nTitle,
   };

   if (DRY_RUN) {
      // create a pseudo id for dry-run
      subj = { _id: '(dry-run)' + nTitle, ...newSubjData };
      subjectsByTitle[nTitle] = subj;
      return subj;
   }

   // Create and return new subject
   const created = await Subject.create(newSubjData);
   const createdLean = created.toObject();
   subjectsById[String(createdLean._id)] = createdLean;
   subjectsByTitle[nTitle] = createdLean;
   return createdLean;
}

function escapeRegex(s) {
   return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function main() {
   console.log('Connecting to', MONGO_URI);
   await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
   console.log('Connected.');

   const categoriesById = {};
   const categoriesByTitle = {};
   const subjectsById = {};
   const subjectsByTitle = {};

   // Preload categories & subjects to minimize queries
   console.log('Preloading categories and subjects (for speed)...');
   const cats = await Category.find({}).lean();
   cats.forEach(c => {
      categoriesById[String(c._id)] = c;
      if (c.title) categoriesByTitle[normalizeTitle(c.title)] = c;
      if (c.normalizedTitle) categoriesByTitle[normalizeTitle(c.normalizedTitle)] = c;
   });
   const subs = await Subject.find({}).lean();
   subs.forEach(s => {
      subjectsById[String(s._id)] = s;
      if (s.title) subjectsByTitle[normalizeTitle(s.title)] = s;
      if (s.normalizedTitle) subjectsByTitle[normalizeTitle(s.normalizedTitle)] = s;
   });

   console.log(`Loaded ${Object.keys(categoriesById).length} categories, ${Object.keys(subjectsById).length} subjects.`);

   // Map categoryId -> Map(normalizedSubjectTitle -> subjectObj)
   const resultMap = new Map();

   console.log('Scanning books collection...');
   const cursor = Book.find({}).cursor();
   let processed = 0;
   let booksWithoutCategory = 0;
   let booksWithoutSubject = 0;

   for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      processed++;
      if (processed % BATCH_SIZE === 0) {
         console.log(`Processed ${processed} books...`);
      }

      const book = doc.toObject ? doc.toObject() : doc;

      // Resolve category
      let categoryDoc = null;
      try {
         categoryDoc = await resolveCategory(book, categoriesById, categoriesByTitle);
      } catch (err) {
         console.warn(`Failed resolving category for book ${book._id}: ${err.message}`);
         continue;
      }

      if (!categoryDoc) {
         booksWithoutCategory++;
         continue;
      }

      const catId = String(categoryDoc._id);
      if (!resultMap.has(catId)) resultMap.set(catId, new Map());
      const subjectsMapForCat = resultMap.get(catId);

      // Resolve subject
      let subjDoc = null;
      try {
         subjDoc = await resolveSubject(book, subjectsById, subjectsByTitle);
      } catch (err) {
         console.warn(`Failed resolving subject for book ${book._id}: ${err.message}`);
         continue;
      }

      if (!subjDoc) {
         booksWithoutSubject++;
         continue;
      }

      // Use normalizedTitle as uniqueness key when available, else use id
      const uniqKey = subjDoc.normalizedTitle ? normalizeTitle(subjDoc.normalizedTitle || subjDoc.title) : (subjDoc._id ? String(subjDoc._id) : normalizeTitle(subjDoc.title || ''));

      if (!subjectsMapForCat.has(uniqKey)) {
         // ensure the object shape we will store in Category.subjects
         const subjectObj = {
            _id: subjDoc._id ? subjDoc._id : null,
            title: subjDoc.title ? subjDoc.title : '',
            normalizedTitle: subjDoc.normalizedTitle ? subjDoc.normalizedTitle : normalizeTitle(subjDoc.title || ''),
         };
         subjectsMapForCat.set(uniqKey, subjectObj);
      }
   }

   console.log(`Done scanning books. Processed ${processed} books.`);
   console.log(`Books without category: ${booksWithoutCategory}`);
   console.log(`Books without subject: ${booksWithoutSubject}`);
   console.log(`Preparing updates for ${resultMap.size} categories.`);

   // Apply updates to categories
   let updatedCount = 0;
   for (const [catId, subjMap] of resultMap.entries()) {
      const subjectsArray = Array.from(subjMap.values());

      if (DRY_RUN) {
         console.log(`DRY RUN: Category ${catId} would be updated with ${subjectsArray.length} subjects.`);
         continue;
      }

      // Update Category document
      const updateResult = await Category.findByIdAndUpdate(
         catId,
         { $set: { subjects: subjectsArray } },
         { new: true }
      ).lean();

      if (updateResult) {
         updatedCount++;
         console.log(`Updated category ${catId} -> subjects count: ${subjectsArray.length}`);
      } else {
         console.warn(`Failed updating category ${catId}`);
      }
   }

   console.log(`Migration finished. ${DRY_RUN ? 'DRY RUN - no changes made.' : `Updated ${updatedCount} categories.`}`);

   await mongoose.disconnect();
   console.log('Disconnected. Bye.');
}

main().catch(err => {
   console.error('Migration failed:', err);
   process.exit(1);
});