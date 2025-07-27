const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Node.js file system module

// Define the destination folder for books
const booksUploadDir = path.join(__dirname, '../assets/books');

// Ensure the directory exists
if (!fs.existsSync(booksUploadDir)) {
  fs.mkdirSync(booksUploadDir, { recursive: true });
}

// Set up storage for uploaded files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // You'll process the image later with sharp, so for now, just save to a temp or main upload folder
    // We'll rename it after processing
    cb(null, booksUploadDir);
  },
  filename: function (req, file, cb) {
    // Use a temporary unique name initially, we'll rename it in the controller/service
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// Filter to allow only specific image types
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 5 // 5 MB file size limit
  }
});

module.exports = upload;