import mongoose from 'mongoose';
import readline from 'readline';
import AWS from 'aws-sdk';
import dotenv from 'dotenv';
import path from 'path';
import { createClient } from 'redis';

// Import models to recreate indexes/structure
import User from '../models/User';
import Shop from '../models/Shop';
import Order from '../models/Order';
import UploadMetadata from '../models/UploadMetadata';

// Load local env as default
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function readMultilineEnv(): Promise<string> {
  console.log('\n--- Paste your Production environment variables below ---');
  console.log('Type "DONE" on a new line and press Enter when finished:\n');
  let envString = '';
  return new Promise((resolve) => {
    const onLine = (line: string) => {
      if (line.trim().toUpperCase() === 'DONE') {
        rl.removeListener('line', onLine);
        resolve(envString);
      } else {
        envString += line + '\n';
      }
    };
    rl.on('line', onLine);
  });
}

async function askConfirmation(question: string): Promise<boolean> {
  const answer = await askQuestion(question);
  return answer.toLowerCase() === 'yes';
}

async function resetDatabase() {
  console.log('');
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║               SYSTEM RESET UTILITY             ║');
  console.log('╠════════════════════════════════════════════════╣');
  console.log('║  WARNING: This will permanently destroy:       ║');
  console.log('║    • All Users                                 ║');
  console.log('║    • All Shops                                 ║');
  console.log('║    • All Orders                                ║');
  console.log('║    • All Storage (S3/Backblaze B2/MinIO)       ║');
  console.log('║    • All Cached Data (Redis)                   ║');
  console.log('║  And recreate empty collections with indexes.  ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  console.log('Select Environment to Reset:');
  console.log('1. Local (uses variables from your local .env file)');
  console.log('2. Custom / Production (paste your remote .env variables)\n');

  const choice = await askQuestion('Enter choice (1 or 2): ');
  
  let MONGO_URI = process.env.MONGO_URI;
  let REDIS_URL = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;
  let S3_ENDPOINT = process.env.MINIO_ENDPOINT || (!process.env.NODE_ENV || process.env.NODE_ENV !== 'production' ? `http://localhost:${process.env.MINIO_PORT || 9000}` : undefined);
  let S3_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || 'minioadmin';
  let S3_SECRET_KEY = process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || 'minioadmin';
  let BUCKET_NAME = process.env.MINIO_BUCKET_NAME || process.env.MINIO_DEFAULT_BUCKET || 'anti-print';
  let S3_REGION = process.env.AWS_REGION || 'us-east-1';
  let S3_FORCE_PATH_STYLE = process.env.S3_FORCE_PATH_STYLE === 'true' || process.env.NODE_ENV !== 'production';

  if (choice === '2') {
    const pastedEnv = await readMultilineEnv();
    const parsedEnv = dotenv.parse(pastedEnv);
    
    // Override local env with pasted env
    MONGO_URI = parsedEnv.MONGO_URI?.replace(/['"]/g, ''); // Strip quotes if any
    REDIS_URL = parsedEnv.REDIS_URL;
    S3_ENDPOINT = parsedEnv.MINIO_ENDPOINT ? (parsedEnv.MINIO_ENDPOINT.startsWith('http') ? parsedEnv.MINIO_ENDPOINT : `https://${parsedEnv.MINIO_ENDPOINT}`) : undefined;
    S3_ACCESS_KEY = parsedEnv.MINIO_ACCESS_KEY;
    S3_SECRET_KEY = parsedEnv.MINIO_SECRET_KEY;
    BUCKET_NAME = parsedEnv.MINIO_BUCKET_NAME;
    S3_REGION = parsedEnv.AWS_REGION || 'us-east-1';
    S3_FORCE_PATH_STYLE = parsedEnv.S3_FORCE_PATH_STYLE === 'true';
  } else if (choice !== '1') {
    console.log('❌ Invalid choice. Aborting.');
    process.exit(1);
  }

  if (!MONGO_URI) {
    console.error('\n❌ FATAL: MONGO_URI is missing or not defined.');
    process.exit(1);
  }

  console.log(`\n--- TARGET SUMMARY ---`);
  console.log(`Mongo URI: ${MONGO_URI.split('@')[1] ? '...@' + MONGO_URI.split('@')[1] : MONGO_URI}`);
  if (REDIS_URL) console.log(`Redis:     ${REDIS_URL}`);
  if (BUCKET_NAME) console.log(`Storage:   Bucket '${BUCKET_NAME}' at ${S3_ENDPOINT}`);
  console.log('----------------------\n');

  const confirmed = await askConfirmation('Type "yes" to confirm PERMANENT RESET of this environment: ');

  if (!confirmed) {
    console.log('❌ Aborted. No changes made.');
    process.exit(0);
  }

  try {
    // 1. Connect to MongoDB
    console.log('\n🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected successfully.\n');

    const db = mongoose.connection.db;
    if (!db) throw new Error('Database connection not established');

    // 2. Get existing collections
    const collections = await db.listCollections().toArray();
    
    // 3. Drop all existing collections
    if (collections.length > 0) {
      console.log(`🗑️  Dropping ${collections.length} collection(s)...`);
      for (const collection of collections) {
        await db.dropCollection(collection.name);
      }
    } else {
      console.log('ℹ️  Database is already empty.');
    }

    // 4. Recreate schema structure by syncing indexes
    console.log('\n🏗️  Recreating collection schemas & indexes...');
    
    await User.createCollection(); 
    await User.syncIndexes(); 
    console.log('   ✓ Users collection created');
    
    await Shop.createCollection(); 
    await Shop.syncIndexes(); 
    console.log('   ✓ Shops collection created');
    
    await Order.createCollection(); 
    await Order.syncIndexes(); 
    console.log('   ✓ Orders collection created');

    await UploadMetadata.createCollection(); 
    await UploadMetadata.syncIndexes(); 
    console.log('   ✓ UploadMetadata collection created');

    // 5. Clear Redis cache
    if (REDIS_URL) {
      console.log('\n🧹 Clearing Redis Cache...');
      try {
        const redisClient = createClient({ url: REDIS_URL });
        await redisClient.connect();
        await redisClient.flushAll();
        await redisClient.disconnect();
        console.log('   ✓ Redis cache completely flushed');
      } catch (err: any) {
        console.warn('   ⚠️ Could not connect to Redis to flush it (Expected if internal Render URL):', err.message);
      }
    }

    // 6. Clear S3/B2 Bucket
    if (BUCKET_NAME && S3_ACCESS_KEY && S3_SECRET_KEY) {
      console.log(`\n☁️  Emptying Storage Bucket: ${BUCKET_NAME}...`);
      const s3 = new AWS.S3({
        accessKeyId: S3_ACCESS_KEY,
        secretAccessKey: S3_SECRET_KEY,
        endpoint: S3_ENDPOINT,
        s3ForcePathStyle: S3_FORCE_PATH_STYLE,
        signatureVersion: 'v4',
        region: S3_REGION
      });

      try {
        let listedObjects;
        let deletedCount = 0;
        do {
          listedObjects = await s3.listObjectsV2({ Bucket: BUCKET_NAME }).promise();
          if (listedObjects.Contents && listedObjects.Contents.length > 0) {
            const deleteParams: AWS.S3.DeleteObjectsRequest = {
              Bucket: BUCKET_NAME,
              Delete: { Objects: [] as {Key: string}[] }
            };
            listedObjects.Contents.forEach(({ Key }) => {
              if (Key) deleteParams.Delete.Objects.push({ Key });
            });
            const deleted = await s3.deleteObjects(deleteParams).promise();
            deletedCount += deleted.Deleted?.length || 0;
          }
        } while (listedObjects.IsTruncated);
        console.log(`   ✓ Storage bucket cleared. Removed ${deletedCount} files.`);
      } catch (err: any) {
        console.warn('   ⚠️ Could not clear S3 bucket:', err.message);
      }
    }

    // 7. Verify
    const newCollections = await db.listCollections().toArray();
    console.log(`\n✅ Database reset complete! ${newCollections.length} collection(s) recreated.`);

    console.log('\n🎉 Database is clean and ready for fresh data.');
    console.log('   You can now register new users and shops.\n');

  } catch (error) {
    console.error('\n❌ Reset failed:', error);
  } finally {
    process.exit(0);
  }
}

resetDatabase();
