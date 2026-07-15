import cron from 'node-cron';
import s3, { BUCKET_NAME } from './config/s3';
import Order from './models/Order';

// Run every hour: '0 * * * *'
const runCleanup = () => {
  console.log('⏰ Initializing cleanup cron job...');

  cron.schedule('0 * * * *', async () => {
    console.log('🧹 Running scheduled cleanup...');
    try {
      // 1. Get all S3 objects
      const listParams = { Bucket: BUCKET_NAME };
      const listedObjects = await s3.listObjectsV2(listParams).promise();

      if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
        console.log('🧹 Nothing to clean up.');
        return;
      }

      // 2. Get all ACTIVE orders (not completed or cancelled) to protect their files
      const activeOrders = await Order.find({
        orderStatus: { $nin: ['COMPLETED', 'CANCELLED'] }
      }).lean();

      // Build a set of protected storage keys from active orders
      const protectedKeys = new Set<string>();
      for (const order of activeOrders) {
        for (const item of order.items) {
          if (item.storageKey) protectedKeys.add(item.storageKey);
          if (item.convertedKey) protectedKeys.add(item.convertedKey);
        }
      }

      console.log(`🛡️ Protecting ${protectedKeys.size} keys from ${activeOrders.length} active orders.`);

      const deleteList: { Key: string }[] = [];
      const now = Date.now();
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

      for (const obj of listedObjects.Contents) {
        if (!obj.Key) continue;

        // Never delete protected active-order files
        if (protectedKeys.has(obj.Key)) continue;

        const parts = obj.Key.split('/');

        // Keep: Root files with < 2 parts (shouldn't exist)
        if (parts.length < 2) continue;

        // Keep: Shop profile images (format: ShopFolder/profile-*.ext)
        if (parts.length === 2 && parts[1].startsWith('profile-')) continue;

        // Keep: Converted subfolder profile images
        if (parts.some((p: string) => p.startsWith('profile-'))) continue;

        // Check file age — delete if older than 24 hours
        if (obj.LastModified) {
          const age = now - obj.LastModified.getTime();
          if (age > TWENTY_FOUR_HOURS) {
            deleteList.push({ Key: obj.Key });
          }
        }
      }

      if (deleteList.length > 0) {
        console.log(`🗑️ Deleting ${deleteList.length} old/expired files...`);
        // S3 deleteObjects limit is 1000
        const batchSize = 1000;
        for (let i = 0; i < deleteList.length; i += batchSize) {
          const batch = deleteList.slice(i, i + batchSize);
          await s3.deleteObjects({
            Bucket: BUCKET_NAME,
            Delete: { Objects: batch }
          }).promise();
        }
        console.log(`✅ Cleanup complete. Deleted ${deleteList.length} files.`);
      } else {
        console.log('✅ Cleanup complete. No expired files found.');
      }

    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  });
};

export default runCleanup;