/**
 * XeroxSaaS — Database Reset Script
 * 
 * Drops ALL collections in the database and recreates the schema structure.
 * Usage: npx ts-node scripts/resetDB.ts
 * 
 * ⚠️  WARNING: This will PERMANENTLY DELETE all data!
 */

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import readline from 'readline';

// Import models to recreate indexes/structure
import User from '../src/models/User';
import Shop from '../src/models/Shop';
import Order from '../src/models/Order';

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ FATAL: MONGO_URI is not defined in .env');
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askConfirmation(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

async function resetDatabase() {
  console.log('');
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   ⚠️  XeroxSaaS — DATABASE RESET SCRIPT ⚠️    ║');
  console.log('╠════════════════════════════════════════════════╣');
  console.log('║  This will PERMANENTLY DELETE:                ║');
  console.log('║    • All Users                                ║');
  console.log('║    • All Shops                                ║');
  console.log('║    • All Orders                               ║');
  console.log('║  And recreate empty collections with indexes. ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Target DB: ${MONGO_URI}`);
  console.log('');

  const confirmed = await askConfirmation('Type "yes" to confirm database reset: ');

  if (!confirmed) {
    console.log('❌ Aborted. No changes made.');
    rl.close();
    process.exit(0);
  }

  try {
    // 1. Connect to MongoDB
    console.log('\n🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI!);
    console.log('✅ Connected successfully.\n');

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }

    // 2. Get existing collections
    const collections = await db.listCollections().toArray();
    console.log(`📦 Found ${collections.length} collection(s):`);
    collections.forEach(c => console.log(`   • ${c.name}`));

    // 3. Drop ALL collections
    console.log('\n🗑️  Dropping all collections...');
    for (const collection of collections) {
      await db.dropCollection(collection.name);
      console.log(`   ✓ Dropped: ${collection.name}`);
    }
    console.log('✅ All collections dropped.\n');

    // 4. Recreate schema structure by syncing indexes
    console.log('🏗️  Recreating collection schemas & indexes...');

    // User collection
    await User.createCollection();
    await User.syncIndexes();
    console.log('   ✓ Users collection created (with unique email index)');

    // Shop collection
    await Shop.createCollection();
    await Shop.syncIndexes();
    console.log('   ✓ Shops collection created (with owner ref index)');

    // Order collection
    await Order.createCollection();
    await Order.syncIndexes();
    console.log('   ✓ Orders collection created (with shop/user ref indexes)');

    // 5. Verify
    const newCollections = await db.listCollections().toArray();
    console.log(`\n✅ Database reset complete! ${newCollections.length} collection(s) recreated:`);
    newCollections.forEach(c => console.log(`   • ${c.name}`));

    console.log('\n🎉 Database is clean and ready for fresh data.');
    console.log('   You can now register new users and shops.\n');

  } catch (error) {
    console.error('\n❌ Reset failed:', error);
  } finally {
    rl.close();
    await mongoose.disconnect();
    process.exit(0);
  }
}

resetDatabase();
