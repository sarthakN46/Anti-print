import AWS from 'aws-sdk';

const s3 = new AWS.S3({
  accessKeyId: process.env.MINIO_ROOT_USER || 'minioadmin',
  secretAccessKey: process.env.MINIO_ROOT_PASSWORD || 'minioadmin',
  endpoint: `http://localhost:${process.env.MINIO_PORT || 9000}`,
  s3ForcePathStyle: true, // Needed for MinIO
  signatureVersion: 'v4',
});

export const BUCKET_NAME = process.env.MINIO_DEFAULT_BUCKET || 'anti-print';

// Check if bucket exists, if not, create it (Safety check)
const initBucket = async () => {
  try {
    await s3.headBucket({ Bucket: BUCKET_NAME }).promise();
    console.log(`✅ Storage Bucket '${BUCKET_NAME}' is ready.`);
  } catch (err) {
    console.log(`⚠️ Bucket '${BUCKET_NAME}' not found. Creating...`);
    try {
      await s3.createBucket({ Bucket: BUCKET_NAME }).promise();
      console.log(`✅ Bucket '${BUCKET_NAME}' created.`);
    } catch (createErr) {
      console.error('❌ Failed to create bucket:', createErr);
    }
  }
};

initBucket();

export default s3;