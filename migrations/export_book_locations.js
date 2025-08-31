const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const Book = require('../models/book.model'); // Adjust path to your model

const MONGO_URI = 'mongodb+srv://omarhasan22:81195404OMAR@cluster0.e47czbw.mongodb.net/myLibrary?retryWrites=true&w=majority';

// Save inside backend project's ./assets folder
const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) {
   fs.mkdirSync(assetsDir, { recursive: true });
}
const OUT_FILE = path.join(assetsDir, 'books_locations_R4.xlsx');

async function main() {
   await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

   const pipeline = [
      { $match: { "address.roomNumber": '4' } },

      // Lookup subject
      {
         $lookup: {
            from: 'subjects',
            localField: 'subject',
            foreignField: '_id',
            as: 'subject'
         }
      },

      // Lookup category
      {
         $lookup: {
            from: 'categories',
            localField: 'category',
            foreignField: '_id',
            as: 'category'
         }
      },

      // Projection with conditional volume
      {
         $project: {
            title: 1,
            roomNumber: "$address.roomNumber",
            wallNumber: "$address.wallNumber",
            shelfNumber: "$address.shelfNumber",
            bookNumber: "$address.bookNumber",
            volume: {
               $cond: [
                  { $gt: ["$numberOfVolumes", 1] },
                  { $range: [1, { $add: ["$numberOfVolumes", 1] }] },
                  "$$REMOVE" // completely remove field if condition not met
               ]
            },
            categoryAndSubject: {
               $concat: [
                  { $ifNull: [{ $first: "$category.title" }, ""] },
                  " ",
                  { $ifNull: [{ $first: "$subject.title" }, ""] }
               ]
            }
         }
      },

      // Only unwind volumes if it exists
      {
         $unwind: {
            path: "$volume",
            preserveNullAndEmptyArrays: true
         }
      }
   ];

   const rows = await Book.aggregate(pipeline).allowDiskUse(true).exec();
   console.log(rows);

   // Create Excel file (RTL with Arabic headers if needed)
   const wb = new ExcelJS.Workbook();
   const ws = wb.addWorksheet('Book locations', { views: [{ rightToLeft: true }] });

   ws.addRow([
      'العنوان',
      'الفئة - الموضوع',
      'الغرفة',
      'الحائط',
      'الرف',
      'رقم الكتاب',
      'المجلد'
   ]);

   for (const r of rows) {
      ws.addRow([
         r.title || '',
         r.categoryAndSubject || '',
         r.roomNumber || '',
         r.wallNumber || '',
         r.shelfNumber || '',
         r.bookNumber || '',
         r.volume || ''
      ]);
   }

   // Auto column widths
   ws.columns.forEach((col) => {
      let max = 10;
      col.eachCell({ includeEmpty: true }, (cell) => {
         const len = (cell.value || '').toString().length;
         if (len > max) max = len;
      });
      col.width = Math.min(Math.max(max + 2, 15), 120);
   });

   await wb.xlsx.writeFile(OUT_FILE);
   console.log(`Wrote ${rows.length} rows to ${OUT_FILE}`);

   await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
