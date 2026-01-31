import mongoose from 'mongoose';
import AWS from 'aws-sdk';
import dotenv from 'dotenv';
import path from 'path';

// 1. Load Env Vars (Local .env)
const envPath = path.resolve(__dirname, '../../.env');
console.log(`Loading .env from: ${envPath}`);
dotenv.config({ path: envPath });

const resetDb = async () => {
  try {
    // --- STEP 1: CLEAR MONGODB ---
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI not found');

    console.log('⏳ Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    
    const collections = await mongoose.connection.db?.collections();
    if (collections) {
      for (let collection of collections) {
        await collection.deleteMany({});
        console.log(`   ✅ Cleared Mongo Collection: ${collection.collectionName}`);
      }
    }

    // --- STEP 2: CLEAR MINIO (S3) ---
    console.log('⏳ Connecting to MinIO Storage...');
    
    const s3 = new AWS.S3({
      accessKeyId: process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || 'minioadmin',
      secretAccessKey: process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || 'minioadmin',
      endpoint: process.env.MINIO_ENDPOINT || `http://localhost:${process.env.MINIO_PORT || 9000}`,
      s3ForcePathStyle: true,
      signatureVersion: 'v4',
    });
    
    const bucketName = process.env.MINIO_BUCKET_NAME || process.env.MINIO_DEFAULT_BUCKET || 'anti-print';
    // List all objects
    try {
      const listedObjects = await s3.listObjectsV2({ Bucket: bucketName }).promise();

      if (listedObjects.Contents && listedObjects.Contents.length > 0) {
        const deleteParams: AWS.S3.DeleteObjectsRequest = {
          Bucket: bucketName,
          Delete: { Objects: [] }
        };

        listedObjects.Contents.forEach(({ Key }) => {
          if (Key) deleteParams.Delete.Objects.push({ Key });
        });

        await s3.deleteObjects(deleteParams).promise();
        console.log(`   ✅ Cleared MinIO Bucket: '${bucketName}' (${listedObjects.Contents.length} files deleted)`);
      } else {
        console.log(`   ℹ️  MinIO Bucket '${bucketName}' was already empty.`);
      }
    } catch (err: any) {
      if (err.code === 'NoSuchBucket') {
        console.log(`   ℹ️  MinIO Bucket '${bucketName}' does not exist yet (Skipping cleanup).`);
      } else {
        throw err; // Re-throw other errors
      }
    }

    console.log('\n✨ SYSTEM RESET COMPLETE ✨');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error resetting system:', error);
    process.exit(1);
  }
};

resetDb();
