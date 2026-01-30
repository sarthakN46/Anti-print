import AWS from 'aws-sdk';

const isProduction = process.env.NODE_ENV === 'production';

const endpoint = process.env.MINIO_ENDPOINT || `http://localhost:${process.env.MINIO_PORT || 9000}`;

const s3 = new AWS.S3({
  accessKeyId: process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || 'minioadmin',
  secretAccessKey: process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || 'minioadmin',
  endpoint: endpoint,
  s3ForcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true' || !isProduction, // True for MinIO, False for AWS
  signatureVersion: 'v4',
  region: process.env.AWS_REGION || 'us-east-1' // Added region support
});

export const BUCKET_NAME = process.env.MINIO_BUCKET_NAME || process.env.MINIO_DEFAULT_BUCKET || 'anti-print';

// Check if bucket exists, if not, create it (Safety check)
const initBucket = async () => {
  try {
    await s3.headBucket({ Bucket: BUCKET_NAME }).promise();
    console.log(`✅ Storage Bucket '${BUCKET_NAME}' is ready at ${endpoint}`);
  } catch (err) {
    console.log(`⚠️ Bucket '${BUCKET_NAME}' not found at ${endpoint}. Attempting creation...`);
    try {
      await s3.createBucket({ Bucket: BUCKET_NAME }).promise();
      console.log(`✅ Bucket '${BUCKET_NAME}' created.`);
    } catch (createErr) {
      console.error('❌ Failed to create/connect to bucket:', createErr);
    }
  }
};

initBucket();

export default s3;