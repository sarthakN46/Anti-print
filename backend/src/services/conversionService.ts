import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn } from 'child_process';
import s3, { BUCKET_NAME } from '../config/s3';
import Order from '../models/Order';
import { v4 as uuidv4 } from 'uuid';
import { getIO } from '../utils/socket';

const runConverter = (inputPath: string, outputPath: string): Promise<void> => {
   return new Promise((resolve, reject) => {
      // Use process.cwd() for reliable path resolution in Render/Docker
      const scriptPath = path.join(process.cwd(), 'dist/scripts/convert.py');
      console.log(`[Converter] Script: ${scriptPath}`);
      console.log(`[Converter] Input: ${inputPath}`);
      
      const pyProcess = spawn('python3', [scriptPath, inputPath, outputPath]);
      
      let stderr = '';
      
      pyProcess.stdout.on('data', (d) => console.log(`[Converter stdout]: ${d}`));
      pyProcess.stderr.on('data', (d) => {
         console.error(`[Converter stderr]: ${d}`);
         stderr += d.toString();
      });

      pyProcess.on('close', (code) => {
         console.log(`[Converter] Exited with code ${code}`);
         if (code === 0) resolve();
         else reject(new Error(`Converter exited with code ${code}. Error: ${stderr}`));
      });
   });
};

export const processOrderFiles = async (orderId: string) => {
    try {
        console.log(`[ConversionService] Starting for Order ${orderId}`);
        const order = await Order.findById(orderId);
        if (!order) return;

        let updated = false;

        for (const item of order.items) {
            // Skip if already converted or if it is already a PDF/Image (and we treat images as ready-to-print or handled separately)
            // Actually, images might need conversion to PDF for consistent printing? 
            // Previous logic: PDF is PDF. Images are printed via print-js 'image' type.
            // Office docs need conversion.
            const ext = item.originalName.split('.').pop()?.toLowerCase();
            
            // If it's a PDF, we don't strictly *need* to convert it, but we could copy it to 'converted' folder for consistency if we wanted.
            // But let's only convert non-PDFs (Office docs).
            if (['pdf', 'png', 'jpg', 'jpeg'].includes(ext || '')) continue;
            
            // Check if already processed (retry logic)
            if (item.convertedKey) continue;

            try {
                // 1. Download
                console.log(`[ConversionService] Converting ${item.originalName}`);
                const s3Obj = await s3.getObject({ Bucket: BUCKET_NAME, Key: item.storageKey }).promise();
                
                const tempInput = path.join(os.tmpdir(), `conv_in_${uuidv4()}.${ext}`);
                const tempOutput = path.join(os.tmpdir(), `conv_out_${uuidv4()}.pdf`);
                
                fs.writeFileSync(tempInput, s3Obj.Body as Buffer);

                // 2. Convert
                await runConverter(tempInput, tempOutput);

                // 3. Upload Converted
                const fileBuffer = fs.readFileSync(tempOutput);
                
                // Construct new key: same folder structure but inside a 'converted' subfolder or suffix?
                // Current structure: Shop_ID/User_ID/Filename.ext
                // New structure: Shop_ID/User_ID/converted/Filename.pdf
                const dir = path.dirname(item.storageKey);
                const name = path.basename(item.storageKey, `.${ext}`);
                const newKey = `${dir}/converted/${name}.pdf`;

                await s3.upload({
                    Bucket: BUCKET_NAME,
                    Key: newKey,
                    Body: fileBuffer,
                    ContentType: 'application/pdf'
                }).promise();

                // 4. Update Item
                item.convertedKey = newKey;
                updated = true;

                // Cleanup
                if(fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
                if(fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);

            } catch (err) {
                console.error(`[ConversionService] Failed to convert item ${item.originalName}`, err);
                // Continue to next item, don't crash
            }
        }

        // Processing Complete: Move to QUEUED and Notify
        order.orderStatus = 'QUEUED';
        await order.save();
        
        // Populate User details so Frontend can display them
        await order.populate('user', 'name email');
        
        console.log(`[ConversionService] Completed for Order ${orderId}. Status: QUEUED`);

        try {
            const io = getIO();
            
            // Safe ID Extraction Helper
            const getStrId = (val: any) => {
               if (!val) return null;
               if (typeof val === 'string') return val;
               if (val._id) return val._id.toString(); // Populated object
               return val.toString(); // ObjectId
            };

            const shopId = getStrId(order.shop);
            const userId = getStrId(order.user);

            if (shopId) {
               console.log(`[ConversionService] Emitting new_order to Shop Room: ${shopId}`);
               io.to(shopId).emit('new_order', order);
            }
            
            if (userId) {
               console.log(`[ConversionService] Emitting order_status_updated to User Room: ${userId}`);
               io.to(userId).emit('order_status_updated', order);
               io.to(userId).emit('order_updated', order); 
            }

        } catch (e) {
            console.error('[ConversionService] Failed to emit socket event', e);
        }

    } catch (err) {
        console.error(`[ConversionService] Fatal error for Order ${orderId}`, err);
    }
};
