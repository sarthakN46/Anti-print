import cron from 'node-cron';
import s3, { BUCKET_NAME } from './config/s3';
import Order from './models/Order';
import Razorpay from 'razorpay';
import dotenv from 'dotenv';
dotenv.config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID as string,
  key_secret: process.env.RAZORPAY_KEY_SECRET as string,
});

// Run every hour: '0 * * * *'
const runCleanup = () => {
  console.log('⏰ Initializing cleanup cron job...');
  
  cron.schedule('0 * * * *', async () => {
    console.log('🧹 Running scheduled cleanup...');
    try {
      const now = Date.now();
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
      const twentyFourHoursAgo = new Date(now - TWENTY_FOUR_HOURS);

      // 1. CLEANUP DB: Delete abandoned PENDING_PAYMENT orders older than 24h
      const deletedAbandoned = await Order.deleteMany({ 
        orderStatus: 'PENDING_PAYMENT', 
        createdAt: { $lt: twentyFourHoursAgo } 
      });
      if (deletedAbandoned.deletedCount > 0) {
        console.log(`🗑️ Deleted ${deletedAbandoned.deletedCount} abandoned PENDING_PAYMENT orders from DB.`);
      }

      // 1.5. CLEANUP STUCK ORDERS: Refund & Delete QUEUED orders > 60 hours
      const SIXTY_HOURS = 60 * 60 * 60 * 1000;
      const sixtyHoursAgo = new Date(now - SIXTY_HOURS);
      
      const stuckOrders = await Order.find({
        orderStatus: 'QUEUED',
        createdAt: { $lt: sixtyHoursAgo }
      });

      if (stuckOrders.length > 0) {
        console.log(`⚠️ Found ${stuckOrders.length} stuck orders older than 60 hours. Cancelling & Deleting...`);
        for (const order of stuckOrders) {
           // Refund if paid
           if (order.paymentStatus === 'PAID' && order.paymentId) {
              try {
                await razorpay.payments.refund(order.paymentId, { speed: 'normal' });
                console.log(`✅ Refunded stuck order: ${order._id}`);
              } catch (e) {
                console.error(`❌ Refund failed for stuck order ${order._id}:`, e);
              }
           }
           // Delete from DB. (S3 cron logic below will automatically purge its files since it's no longer in DB)
           await Order.findByIdAndDelete(order._id);
        }
      }

      // 2. PROTECT ACTIVE FILES: Fetch all active orders to protect their files
      const activeOrders = await Order.find({
        orderStatus: { $in: ['QUEUED', 'PROCESSING', 'PRINTING', 'READY'] }
      });

      const protectedKeys = new Set<string>();
      activeOrders.forEach(order => {
        order.items.forEach(item => {
          if (item.storageKey) protectedKeys.add(item.storageKey);
          if (item.convertedKey) protectedKeys.add(item.convertedKey);
        });
      });

      // 3. CLEANUP S3: Delete files older than 24h that are NOT protected
      const listParams = { Bucket: BUCKET_NAME };
      const listedObjects = await s3.listObjectsV2(listParams).promise();

      if (!listedObjects.Contents || listedObjects.Contents.length === 0) return;

      const deleteList: any[] = [];

      listedObjects.Contents.forEach((obj) => {
        if (!obj.Key) return;
        
        // Protect files belonging to active orders regardless of age!
        if (protectedKeys.has(obj.Key)) {
          return; // Skip deletion
        }

        // Profiles: ShopFolder/profile-name.jpg (Keep forever)
        const parts = obj.Key.split('/');
        if (parts.length === 2 && parts[1].startsWith('profile-')) {
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
        console.log(`🗑️ Deleting ${deleteList.length} old/orphaned files from S3...`);
        // S3 deleteObjects limit is 1000
        const batchSize = 1000;
        for (let i = 0; i < deleteList.length; i += batchSize) {
           const batch = deleteList.slice(i, i + batchSize);
           await s3.deleteObjects({
             Bucket: BUCKET_NAME,
             Delete: { Objects: batch }
           }).promise();
        }
        console.log('✅ S3 Cleanup complete.');
      } else {
        console.log('✅ No S3 files to clean up.');
      }

    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  });
};

export default runCleanup;