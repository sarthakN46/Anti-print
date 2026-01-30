import s3, { BUCKET_NAME } from '../config/s3';

// Manual trigger for the cleanup logic (Dry Run or Real)
const manualCleanup = async () => {
  console.log('🧹 Triggering Manual Cleanup...');
  try {
    const listParams = { Bucket: BUCKET_NAME };
    const listedObjects = await s3.listObjectsV2(listParams).promise();

    if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
        console.log('✅ Bucket is empty or no matching files.');
        return;
    }

    const deleteList: any[] = [];
    // Set a very short threshold for testing (e.g., 0ms - delete everything except profiles)
    // Change this if you want to test specific ages.
    const now = Date.now();
    const AGE_THRESHOLD = 0; 

    listedObjects.Contents.forEach((obj) => {
      if (!obj.Key) return;
      const parts = obj.Key.split('/');
      
      // 1. Root files (ignore)
      if (parts.length < 2) return;

      // 2. Temp files -> Check Age
      if (parts[0] === 'temp' || (parts.length > 1 && parts[1] === 'temp')) {
         // Proceed to age check
      }
      // 3. Profiles: ShopFolder/profile-name.jpg -> KEEP
      else if (parts.length === 2 && parts[1].startsWith('profile-')) {
         console.log(`🛡️ Skipping Profile: ${obj.Key}`);
         return; 
      }
      // 4. Order Files: ShopFolder/OrderFolder/File -> Check Age
      else if (parts.length >= 3) {
         // Proceed
      } else {
         return;
      }

      // Check file age
      if (obj.LastModified) {
          const age = now - obj.LastModified.getTime();
          if (age >= AGE_THRESHOLD) {
            deleteList.push({ Key: obj.Key });
          }
      }
    });

    if (deleteList.length > 0) {
      console.log(`🗑️ Deleting ${deleteList.length} files...`);
      // console.log(deleteList.map(i => i.Key)); // Uncomment to see exact files

      // S3 deleteObjects limit is 1000
      const batchSize = 1000;
      for (let i = 0; i < deleteList.length; i += batchSize) {
          const batch = deleteList.slice(i, i + batchSize);
          await s3.deleteObjects({
            Bucket: BUCKET_NAME,
            Delete: { Objects: batch }
          }).promise();
      }
      console.log('✅ Manual Cleanup complete.');
    } else {
        console.log('✨ No files to delete.');
    }

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
};

manualCleanup();