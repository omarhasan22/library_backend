// migrations/add-database-indexes.js
const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI_PROD || process.env.MONGO_URI_LOCAL;

if (!MONGO_URI) {
  console.error('❌ Database URI is missing!');
  process.exit(1);
}

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('✅ Connected to MongoDB');
    addIndexes();
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

async function addIndexes() {
  try {
    console.log('🚀 Starting index creation migration...\n');

    const db = mongoose.connection.db;

    // Book collection indexes
    console.log('📚 Creating indexes for books collection...');
    const booksCollection = db.collection('books');
    
    await booksCollection.createIndex({ normalizedTitle: 1 });
    console.log('   ✓ Created index: normalizedTitle');
    
    await booksCollection.createIndex({ category: 1 });
    console.log('   ✓ Created index: category');
    
    await booksCollection.createIndex({ subject: 1 });
    console.log('   ✓ Created index: subject');
    
    await booksCollection.createIndex({ publicationYear: 1 });
    console.log('   ✓ Created index: publicationYear');
    
    await booksCollection.createIndex({ 'address.roomNumber': 1 });
    console.log('   ✓ Created index: address.roomNumber');
    
    await booksCollection.createIndex({ 'address.shelfNumber': 1 });
    console.log('   ✓ Created index: address.shelfNumber');
    
    await booksCollection.createIndex({ 'address.wallNumber': 1 });
    console.log('   ✓ Created index: address.wallNumber');
    
    await booksCollection.createIndex({ 'address.bookNumber': 1 });
    console.log('   ✓ Created index: address.bookNumber');
    
    await booksCollection.createIndex({ authors: 1 });
    console.log('   ✓ Created index: authors');
    
    await booksCollection.createIndex({ publishers: 1 });
    console.log('   ✓ Created index: publishers');
    
    await booksCollection.createIndex({ category: 1, subject: 1 });
    console.log('   ✓ Created compound index: category + subject');
    
    await booksCollection.createIndex({ normalizedTitle: 1, category: 1 });
    console.log('   ✓ Created compound index: normalizedTitle + category');
    console.log('   ✅ Books collection: 12 indexes created\n');

    // Author collection indexes
    console.log('👤 Creating indexes for authors collection...');
    const authorsCollection = db.collection('authors');
    
    await authorsCollection.createIndex({ normalizedName: 1 });
    console.log('   ✓ Created index: normalizedName');
    
    await authorsCollection.createIndex({ type: 1 });
    console.log('   ✓ Created index: type');
    
    await authorsCollection.createIndex({ normalizedName: 1, type: 1 });
    console.log('   ✓ Created compound index: normalizedName + type');
    console.log('   ✅ Authors collection: 3 indexes created\n');

    // Borrow collection indexes
    console.log('📖 Creating indexes for borrows collection...');
    const borrowsCollection = db.collection('borrows');
    
    await borrowsCollection.createIndex({ book: 1 });
    console.log('   ✓ Created index: book');
    
    await borrowsCollection.createIndex({ user: 1 });
    console.log('   ✓ Created index: user');
    
    await borrowsCollection.createIndex({ returned: 1 });
    console.log('   ✓ Created index: returned');
    
    await borrowsCollection.createIndex({ endDate: 1 });
    console.log('   ✓ Created index: endDate');
    
    await borrowsCollection.createIndex({ book: 1, returned: 1 });
    console.log('   ✓ Created compound index: book + returned');
    
    await borrowsCollection.createIndex({ user: 1, returned: 1 });
    console.log('   ✓ Created compound index: user + returned');
    
    await borrowsCollection.createIndex({ returned: 1, endDate: 1 });
    console.log('   ✓ Created compound index: returned + endDate');
    
    await borrowsCollection.createIndex({ returned: 1, endDate: 1, emailNotificationSent: 1 });
    console.log('   ✓ Created compound index: returned + endDate + emailNotificationSent');
    console.log('   ✅ Borrows collection: 8 indexes created\n');

    // Category collection indexes
    console.log('📁 Creating indexes for categories collection...');
    const categoriesCollection = db.collection('categories');
    
    await categoriesCollection.createIndex({ normalizedTitle: 1 });
    console.log('   ✓ Created index: normalizedTitle');
    console.log('   ✅ Categories collection: 1 index created\n');

    // Publisher collection indexes
    console.log('🏢 Creating indexes for publishers collection...');
    const publishersCollection = db.collection('publishers');
    
    await publishersCollection.createIndex({ normalizedTitle: 1 });
    console.log('   ✓ Created index: normalizedTitle');
    console.log('   ✅ Publishers collection: 1 index created\n');

    // Subject collection indexes
    console.log('📑 Creating indexes for subjects collection...');
    const subjectsCollection = db.collection('subjects');
    
    await subjectsCollection.createIndex({ normalizedTitle: 1 });
    console.log('   ✓ Created index: normalizedTitle');
    console.log('   ✅ Subjects collection: 1 index created\n');

    // Summary
    console.log('📊 Migration Summary:');
    console.log('   Books: 12 indexes');
    console.log('   Authors: 3 indexes');
    console.log('   Borrows: 8 indexes');
    console.log('   Categories: 1 index');
    console.log('   Publishers: 1 index');
    console.log('   Subjects: 1 index');
    console.log('   Total: 26 indexes created\n');

    console.log('🎉 Index creation migration finished successfully!');
    console.log('ℹ️  Note: This script is idempotent - safe to run multiple times.');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}
