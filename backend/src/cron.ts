import cron from 'node-cron';
import s3, { BUCKET_NAME } from './config/s3';

// Run every hour: '0 * * * *'
const runCleanup = () => {
  console.log('⏰ Initializing cleanup cron job...');
  
  cron.schedule('0 * * * *', async () => {
    console.log('🧹 Running scheduled cleanup...');
    try {
      const listParams = { Bucket: BUCKET_NAME };
      const listedObjects = await s3.listObjectsV2(listParams).promise();

      if (!listedObjects.Contents || listedObjects.Contents.length === 0) return;

      const deleteList: any[] = [];
      const now = Date.now();
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

      listedObjects.Contents.forEach((obj) => {
        // Key Structure: <ShopFolder>/<OrderFolder>/<File>
        // Example: MyShop_123/John_Order456/doc.pdf
        
        if (!obj.Key) return;
        
        const parts = obj.Key.split('/');
        
        // 1. Root files (shouldn't exist mostly, but ignore)
        if (parts.length < 2) return;

        // 2. Temp files (Delete if old)
        if (parts[0] === 'temp' || (parts.length > 1 && parts[1] === 'temp')) {
           // Let fall through to age check
        }
        // 3. Profiles: ShopFolder/profile-name.jpg
        else if (parts.length === 2 && parts[1].startsWith('profile-')) {
           return; // KEEP
        }
        // 4. Order Files: ShopFolder/OrderFolder/File
        else if (parts.length >= 3) {
           // Check age and delete
        } else {
           // Unknown structure, skip safety
           return;
        }

        // Check file age
        if (obj.LastModified) {
           const age = now - obj.LastModified.getTime();
           if (age > TWENTY_FOUR_HOURS) {
              deleteList.push({ Key: obj.Key });
           }
        }
      });

      if (deleteList.length > 0) {
        console.log(`🗑️ Deleting ${deleteList.length} old files...`);
        // S3 deleteObjects limit is 1000
        const batchSize = 1000;
        for (let i = 0; i < deleteList.length; i += batchSize) {
           const batch = deleteList.slice(i, i + batchSize);
           await s3.deleteObjects({
             Bucket: BUCKET_NAME,
             Delete: { Objects: batch }
           }).promise();
        }
        console.log('✅ Cleanup complete.');
      }

    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  });
};

export default runCleanup;