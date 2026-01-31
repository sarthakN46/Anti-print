import { Request, Response } from 'express';
import s3, { BUCKET_NAME } from '../config/s3';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import os from 'os';

// Type definition for Multer file (Standard Express type)
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

// Helper: Run Python Script
const runAnalyzer = (filePath: string): Promise<{ pageCount: number, type: string }> => {
   return new Promise((resolve, reject) => {
      // Use process.cwd() for reliable path resolution in Render/Docker
      const scriptPath = path.join(process.cwd(), 'dist/scripts/analyze.py');
      
      // DEBUG: Log paths
      console.log('--- DEBUG PATHS ---');
      console.log('CWD:', process.cwd());
      console.log('Script Path:', scriptPath);
      try {
         console.log('Contents of dist:', fs.readdirSync(path.join(process.cwd(), 'dist')));
         console.log('Contents of dist/scripts:', fs.readdirSync(path.join(process.cwd(), 'dist/scripts')));
      } catch (e) {
         console.log('Error reading dirs:', e);
      }
      // -----------------

      const pyProcess = spawn('python3', [scriptPath, filePath]);
      
      let dataString = '';
      
      pyProcess.stdout.on('data', (data) => {
         dataString += data.toString();
      });

      pyProcess.stderr.on('data', (data) => {
         console.error(`[Analyzer Error]: ${data}`);
      });

      pyProcess.on('close', (code) => {
         if (code !== 0) {
            console.error(`Analyzer exited with code ${code}`);
            resolve({ pageCount: 1, type: 'unknown' }); // Fallback
         } else {
            try {
               const result = JSON.parse(dataString);
               resolve(result);
            } catch (e) {
               console.error('Failed to parse analyzer output', e);
               resolve({ pageCount: 1, type: 'unknown' });
            }
         }
      });
   });
};

// @desc    Upload file to MinIO and get Hash
// @route   POST /api/upload
// @access  Private (User)
export const uploadFile = async (req: MulterRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }

    // 1. Generate SHA-256 Hash (The "Fingerprint")
    const fileBuffer = req.file.buffer;
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    const fileHash = hashSum.digest('hex');

    // 2. Determine Folder Path
    const fileExt = req.file.originalname.split('.').pop();
    const fileUuid = uuidv4();
    let storageKey = '';

    const shopId = req.body.shopId;

    if (shopId) {
       storageKey = `${shopId}/temp/${fileUuid}.${fileExt}`;
    } else {
       storageKey = `temp/${fileUuid}.${fileExt}`;
    }

    // --- NEW: Analyze File (Page Count) ---
    // Save buffer to temp disk
    const tempFilePath = path.join(os.tmpdir(), `upload_${fileUuid}.${fileExt}`);
    fs.writeFileSync(tempFilePath, fileBuffer);

    let analysis = { pageCount: 1, type: 'unknown' };
    try {
       analysis = await runAnalyzer(tempFilePath);
    } catch (e) {
       console.error('Analysis failed', e);
    } finally {
       // Cleanup temp file
       if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    }
    // --------------------------------------

    // 3. Upload to MinIO (S3)
    const params = {
      Bucket: BUCKET_NAME,
      Key: storageKey,
      Body: fileBuffer,
      ContentType: req.file.mimetype,
    };

    const uploadResult = await s3.upload(params).promise();

    // 4. Return the Keys + Analysis to Frontend
    res.status(201).json({
      message: 'File uploaded successfully',
      originalName: req.file.originalname,
      storageKey: uploadResult.Key, 
      fileHash: fileHash,           
      location: uploadResult.Location,
      pageCount: analysis.pageCount, // <--- Sent to frontend
      fileType: analysis.type        // <--- Sent to frontend
    });

  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ message: 'File upload failed' });
  }
};

// ... existing imports
// Add this import if missing:
// import s3, { BUCKET_NAME } from '../config/s3';

// Helper: Run Converter
const runConverter = (inputPath: string, outputPath: string): Promise<void> => {
   return new Promise((resolve, reject) => {
      const scriptPath = path.join(__dirname, '../scripts/convert.py');
      const pyProcess = spawn('python3', [scriptPath, inputPath, outputPath]);
      
      pyProcess.on('close', (code) => {
         if (code === 0) resolve();
         else reject(new Error(`Converter exited with code ${code}`));
      });
   });
};

// @desc    Get PDF Preview (Converts if necessary)
// @route   POST /api/upload/preview-pdf
// @access  Private (Owner only)
export const getPreviewPdf = async (req: Request, res: Response): Promise<void> => {
  try {
    const { storageKey } = req.body;
    if (!storageKey) {
       res.status(400).json({ message: 'Key required' });
       return;
    }

    // 1. Download File from S3 to Temp
    const s3Obj = await s3.getObject({ Bucket: BUCKET_NAME, Key: storageKey }).promise();
    const ext = storageKey.split('.').pop()?.toLowerCase();
    const tempInput = path.join(os.tmpdir(), `preview_${uuidv4()}.${ext}`);
    const tempOutput = path.join(os.tmpdir(), `preview_${uuidv4()}.pdf`);

    fs.writeFileSync(tempInput, s3Obj.Body as Buffer);

    // 2. Check Type & Convert
    if (ext === 'pdf') {
       // Already PDF, just return it
       res.setHeader('Content-Type', 'application/pdf');
       res.send(s3Obj.Body);
       fs.unlinkSync(tempInput); // cleanup
       return;
    } 
    
    if (['jpg', 'jpeg', 'png'].includes(ext || '')) {
       // Images: We should convert to PDF for print-js to handle easily?
       // OR frontend handles images. 
       // User asked for "Universal No Download". print-js handles images too.
       // Let's return the image as is? No, let's keep it simple.
       res.setHeader('Content-Type', `image/${ext}`);
       res.send(s3Obj.Body);
       fs.unlinkSync(tempInput);
       return;
    }

    // 3. Convert Office Docs
    try {
       await runConverter(tempInput, tempOutput);
       
       const pdfBuffer = fs.readFileSync(tempOutput);
       res.setHeader('Content-Type', 'application/pdf');
       res.send(pdfBuffer);
       
       // Cleanup
       fs.unlinkSync(tempInput);
       fs.unlinkSync(tempOutput);

    } catch (err) {
       console.error('Conversion Failed', err);
       res.status(500).json({ message: 'Conversion failed' });
       if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Preview failed' });
  }
};