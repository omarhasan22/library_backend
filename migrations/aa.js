// migrate_set_number_of_folders_from_existing.js
//
// Usage:
//   node migrate_set_number_of_folders_from_existing.js --uri="mongodb://..." --dry-run
//   node migrate_set_number_of_folders_from_existing.js --uri="mongodb://..." --room=6
//   node migrate_set_number_of_folders_from_existing.js --uri="mongodb://..." --groupBy=normalizedTitle,title,editionNumber
//
// Behavior:
//  - For each group (groupBy fields): compute maxExisting = max(numberOfFolders) among group (missing -> 0).
//  - If maxExisting > 1 => target = maxExisting
//    else => target = 1
//  - Update all books in the group to set numberOfFolders = target.

const mongoose = require('mongoose');
const argv = require('minimist')(process.argv.slice(2));
const MONGO_URI = process.env.MONGO_URI_PROD
const DRY_RUN = !!argv['dry-run'];
const ROOM_FILTER = (argv.room !== undefined) ? String(argv.room) : null;
const GROUP_BY_ARG = argv.groupBy || null;

// adjust to your path
const Book = require('../models/book.model');

function parseGroupByArg(arg) {
   if (!arg) return null;
   return arg.split(',').map(s => s.trim()).filter(Boolean);
}

function defaultGroupFields() {
   return ['normalizedTitle', 'title', 'editionNumber', 'publicationYear'];
}

async function main() {
   console.log('Connecting to', MONGO_URI);
   await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
   console.log('Connected. DRY_RUN =', DRY_RUN);

   let groupFields = parseGroupByArg(GROUP_BY_ARG);
   if (!groupFields) groupFields = defaultGroupFields();
   console.log('Grouping by:', groupFields.join(', '));

   // Build match (optional room filter)
   const match = {};
   if (ROOM_FILTER !== null) {
      match['$or'] = [
         { 'address.roomNumber': ROOM_FILTER },
         { 'address.roomNumber': Number(ROOM_FILTER) }
      ];
      console.log('Applying room filter address.roomNumber =', ROOM_FILTER);
   }

   // Build aggregation _id dynamically
   const groupId = {};
   for (const f of groupFields) groupId[f] = `$${f}`;

   // Aggregation: collect ids and compute max numberOfFolders (treat null as 0)
   const pipeline = [
      { $match: Object.keys(match).length ? match : {} },
      {
         $group: {
            _id: groupId,
            ids: { $push: '$_id' },
            maxNumberOfFolders: { $max: { $ifNull: ['$numberOfFolders', 0] } },
            countDocs: { $sum: 1 }
         }
      }
   ];

   const groups = await Book.aggregate(pipeline).allowDiskUse(true).exec();
   console.log(`Found ${groups.length} group(s).`);

   let totalWillChange = 0;
   let totalChanged = 0;

   for (const grp of groups) {
      const ids = grp.ids || [];
      if (!ids.length) continue;

      // Normalize max (ensure integer)
      let maxExisting = Number(grp.maxNumberOfFolders) || 0;
      // Ensure integer
      maxExisting = Math.floor(maxExisting);

      const target = (maxExisting > 1) ? maxExisting : 1;

      // Count how many already have that value
      const alreadyMatch = await Book.countDocuments({ _id: { $in: ids }, numberOfFolders: target });

      if (alreadyMatch === ids.length) {
         // all matched already -> skip
         continue;
      }

      const toUpdateCount = ids.length - alreadyMatch;
      if (DRY_RUN) {
         console.log(`[DRY] GROUP ${JSON.stringify(grp._id)} (size ${ids.length}) -> maxExisting=${maxExisting} => would set numberOfFolders=${target} for ${toUpdateCount} document(s).`);
         totalWillChange += toUpdateCount;
      } else {
         const res = await Book.updateMany({ _id: { $in: ids } }, { $set: { numberOfFolders: target } });
         // Mongoose/Node driver versions differ in return fields
         const modified = (res.modifiedCount != null) ? res.modifiedCount : (res.nModified != null ? res.nModified : 0);
         console.log(`[APPLIED] GROUP ${JSON.stringify(grp._id)} -> set numberOfFolders=${target} for ${modified} document(s) (group size ${ids.length}, maxExisting=${maxExisting}).`);
         totalChanged += modified;
      }
   }

   if (DRY_RUN) {
      console.log(`\nDry-run complete. ${totalWillChange} document(s) would be updated.`);
   } else {
      console.log(`\nMigration complete. ${totalChanged} document(s) updated.`);
   }

   await mongoose.disconnect();
   console.log('Disconnected.');
   process.exit(0);
}

main().catch(err => {
   console.error('Fatal error:', err);
   process.exit(1);
});
