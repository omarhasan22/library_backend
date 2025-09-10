/**
 * migrate_follow_name_id_with_subject.js
 *
 * For each Book:
 *  - Authors arrays: for each authorId referenced, if Author.name is an ObjectId-like string
 *    (e.g. "64a..."), replace the book reference with that ID (resolved to an existing Author).
 *    If that referenced Author also has name as an ObjectId-like string, follow the chain
 *    up to maxDepth.
 *  - Category: same logic using Category.title -> follow chain and replace Book.category with final id.
 *  - Subject: same logic using Subject.title -> follow chain and replace Book.subject with final id.
 *
 * Usage:
 *   node migrate_follow_name_id_with_subject.js --uri="mongodb://..." --dry-run
 *   node migrate_follow_name_id_with_subject.js --uri="mongodb://..."
 *
 * IMPORTANT: backup DB before running.
 */

const mongoose = require('mongoose');
const argv = require('minimist')(process.argv.slice(2));
const MONGO_URI = process.env.MONGO_URI_PROD

const DRY_RUN = argv['dry-run'] || false;
const MAX_CHAIN_DEPTH = 10;

// adjust require paths to your project
const Author = require('../models/author.model');
const Book = require('../models/book.model');
const Category = require('../models/category.model');
const Subject = require('../models/subject.model'); // <--- added Subject model
const Publisher = require('../models/publisher.model'); // <-- added

function looksLikeObjectId(str) {
   return typeof str === 'string' && /^[0-9a-fA-F]{24}$/.test(str);
}

async function resolveChain(model, startIdOrStr, nameField) {
   // Follow chain model[nameField] when it's an ObjectId-like string.
   let currentId = startIdOrStr ? String(startIdOrStr) : null;
   let lastFoundId = null;

   for (let depth = 0; depth < MAX_CHAIN_DEPTH; depth++) {
      if (!currentId || !looksLikeObjectId(currentId)) break;
      const doc = await model.findById(currentId).lean().catch(() => null);
      if (!doc) break;
      lastFoundId = String(doc._id);
      const nextCandidate = doc[nameField];
      if (typeof nextCandidate === 'string' && looksLikeObjectId(nextCandidate)) {
         currentId = nextCandidate;
         continue;
      } else {
         return lastFoundId;
      }
   }
   return lastFoundId;
}

function normalizeOrigIdsFromArray(arr) {
   return (Array.isArray(arr) ? arr : (arr == null ? [] : [arr]))
      .map(x => {
         if (typeof x === 'string' && looksLikeObjectId(x)) return String(x);
         if (x && typeof x === 'object' && (x._id || x.name || x.title)) {
            if (x._id && looksLikeObjectId(String(x._id))) return String(x._id);
            if (x.name && looksLikeObjectId(String(x.name))) return String(x.name);
            if (x.title && looksLikeObjectId(String(x.title))) return String(x.title);
            return null;
         }
         if (mongoose.Types.ObjectId.isValid(x)) return String(x);
         return null;
      })
      .filter(Boolean);
}

async function processBook(book) {
   const updates = {};
   const logs = [];
   let changed = false;

   // Generic for author-like arrays
   async function processRefArrayField(fieldName, modelForChain, chainFieldName) {
      const raw = book[fieldName];
      const origNormalized = normalizeOrigIdsFromArray(raw);

      if (origNormalized.length === 0) return;

      const newArrIds = [];
      for (const origId of origNormalized) {
         // try to load referenced doc
         const doc = await modelForChain.findById(origId).lean().catch(() => null);
         if (!doc) {
            // keep orig id as-is
            newArrIds.push(String(origId));
            continue;
         }

         // check chain field (name/title) whether it's an ObjectId-like string
         const chainVal = doc[chainFieldName];
         if (typeof chainVal === 'string' && looksLikeObjectId(chainVal)) {
            const finalId = await resolveChain(modelForChain, chainVal, chainFieldName);
            if (finalId) {
               if (String(finalId) !== String(origId)) {
                  logs.push(`[BOOK ${book._id}] ${fieldName} REPLACED ${origId} -> ${finalId}`);
               }
               newArrIds.push(String(finalId));
            } else {
               // couldn't resolve -> keep original
               newArrIds.push(String(origId));
            }
         } else {
            // normal (no chain) -> keep original
            newArrIds.push(String(origId));
         }
      } // end for

      // dedupe preserving order
      const seen = new Set();
      const deduped = [];
      for (const s of newArrIds) {
         if (!seen.has(s)) {
            seen.add(s);
            deduped.push(s);
         }
      }

      const removed = origNormalized.filter(x => !deduped.includes(x));
      const added = deduped.filter(x => !origNormalized.includes(x));
      for (const r of removed) logs.push(`[BOOK ${book._id}] ${fieldName} REMOVED ${r}`);
      for (const a of added) logs.push(`[BOOK ${book._id}] ${fieldName} ADDED ${a}`);

      const same = deduped.length === origNormalized.length && deduped.every((v, i) => String(v) === String(origNormalized[i]));
      if (!same) {
         updates[fieldName] = deduped.map(x => mongoose.Types.ObjectId(x));
         changed = true;
      }
   }

   // Process author-like fields (Author model, chain on 'name')
   const authorFields = ['authors', 'editors', 'commentators', 'caretakers', 'muhashis'];
   for (const f of authorFields) {
      await processRefArrayField(f, Author, 'name');
   }

   // Process publishers (Publisher model, chain on 'title')
   await processRefArrayField('publishers', Publisher, 'title');

   // Category (single ref) - chain on 'title'
   const catRaw = book.category;
   let catId = null;
   if (catRaw == null) catId = null;
   else if (typeof catRaw === 'string' && looksLikeObjectId(catRaw)) catId = catRaw;
   else if (catRaw && typeof catRaw === 'object') {
      if (catRaw._id && looksLikeObjectId(String(catRaw._id))) catId = String(catRaw._id);
      else if (catRaw.title && looksLikeObjectId(String(catRaw.title))) catId = String(catRaw.title);
   } else if (mongoose.Types.ObjectId.isValid(catRaw)) catId = String(catRaw);

   if (catId) {
      const catDoc = await Category.findById(catId).lean().catch(() => null);
      if (catDoc && typeof catDoc.title === 'string' && looksLikeObjectId(catDoc.title)) {
         const finalCatId = await resolveChain(Category, catDoc.title, 'title');
         if (finalCatId && String(finalCatId) !== String(catId)) {
            logs.push(`[BOOK ${book._id}] category REPLACED ${catId} -> ${finalCatId}`);
            updates['category'] = mongoose.Types.ObjectId(finalCatId);
            changed = true;
         }
      }
   }

   // Subject (single ref) - chain on 'title'
   const subjRaw = book.subject;
   let subjId = null;
   if (subjRaw == null) subjId = null;
   else if (typeof subjRaw === 'string' && looksLikeObjectId(subjRaw)) subjId = subjRaw;
   else if (subjRaw && typeof subjRaw === 'object') {
      if (subjRaw._id && looksLikeObjectId(String(subjRaw._id))) subjId = String(subjRaw._id);
      else if (subjRaw.title && looksLikeObjectId(String(subjRaw.title))) subjId = String(subjRaw.title);
   } else if (mongoose.Types.ObjectId.isValid(subjRaw)) subjId = String(subjRaw);

   if (subjId) {
      const subjDoc = await Subject.findById(subjId).lean().catch(() => null);
      if (subjDoc && typeof subjDoc.title === 'string' && looksLikeObjectId(subjDoc.title)) {
         const finalSubjId = await resolveChain(Subject, subjDoc.title, 'title');
         if (finalSubjId && String(finalSubjId) !== String(subjId)) {
            logs.push(`[BOOK ${book._id}] subject REPLACED ${subjId} -> ${finalSubjId}`);
            updates['subject'] = mongoose.Types.ObjectId(finalSubjId);
            changed = true;
         }
      }
   }

   if (!changed) return null;

   if (DRY_RUN) {
      logs.forEach(l => console.log(`[DRY] ${l}`));
      console.log(`[DRY] [BOOK ${book._id}] WOULD UPDATE =>`, updates);
      return { _id: book._id, updates, logs };
   } else {
      await Book.updateOne({ _id: book._id }, { $set: updates });
      logs.forEach(l => console.log(`[APPLIED] ${l}`));
      console.log(`[APPLIED] [BOOK ${book._id}] UPDATED =>`, updates);
      return { _id: book._id, updates, logs };
   }
}

async function main() {
   console.log('Connecting to', MONGO_URI);
   await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
   console.log('Connected. DRY_RUN =', DRY_RUN);

   // Cursor: only books where address.roomNumber == '1' (string) or 1 (number)
   const cursor = Book.find({
      // $and: [
      $or: [{ 'address.roomNumber': '6' }, { 'address.roomNumber': 6 }]
      // { 'address.wallNumber': 'د' }
      // ]
   }).lean().cursor();

   let processed = 0;
   let changedCount = 0;

   for (let book = await cursor.next(); book != null; book = await cursor.next()) {
      processed++;
      if (processed % 200 === 0) process.stdout.write(`.${processed}`);
      try {
         const res = await processBook(book);
         if (res) changedCount++;
      } catch (e) {
         console.error(`Error processing book ${book._id}:`, e.message || e);
      }
   }

   console.log(`\nDone. Processed ${processed} books (roomNumber=1). Books changed: ${changedCount}`);
   if (DRY_RUN) console.log('Dry-run mode: no DB changes were applied.');
   else console.log('Actual run: updates applied.');

   await mongoose.disconnect();
   console.log('Disconnected.');
   process.exit(0);
}

main().catch(err => {
   console.error('Fatal error', err);
   process.exit(1);
});