/**
 * delete_ghost_models.js
 *
 * Deletes ghost documents from Author, Publisher, Category, Subject
 * where `name` or `title` is just an ObjectId-like string.
 *
 * Usage:
 *   node delete_ghost_models.js --uri="mongodb://localhost:27017/mylib" --dry-run
 */

const mongoose = require('mongoose');
const argv = require('minimist')(process.argv.slice(2));

const MONGO_URI = process.env.MONGO_URI_PROD

const DRY_RUN = !!argv['dry-run'];

const Author = require('../models/author.model');
const Publisher = require('../models/publisher.model');
const Category = require('../models/category.model');
const Subject = require('../models/subject.model');

function looksLikeObjectId(str) {
   return typeof str === 'string' && /^[0-9a-fA-F]{24}$/.test(str);
}

async function deleteGhosts(model, modelName, field) {
   const ghosts = await model.find({
      [field]: { $regex: '^[0-9a-fA-F]{24}$' }
   }).lean();

   console.log(`[INFO] ${modelName}: found ${ghosts.length} ghosts`);

   for (const g of ghosts) {
      if (!looksLikeObjectId(g[field])) continue;
      console.log(`[${DRY_RUN ? 'DRY' : 'DELETE'}] ${modelName} ghost _id=${g._id} ${field}=${g[field]}`);
      if (!DRY_RUN) {
         await model.deleteOne({ _id: g._id });
      }
   }
}

async function main() {
   await mongoose.connect(MONGO_URI);
   console.log('Connected to', MONGO_URI, 'DRY_RUN =', DRY_RUN);

   await deleteGhosts(Author, 'Author', 'name');
   await deleteGhosts(Publisher, 'Publisher', 'title');
   await deleteGhosts(Category, 'Category', 'title');
   await deleteGhosts(Subject, 'Subject', 'title');

   await mongoose.disconnect();
   console.log('Done. Disconnected.');
}

main().catch(err => {
   console.error(err);
   process.exit(1);
});
