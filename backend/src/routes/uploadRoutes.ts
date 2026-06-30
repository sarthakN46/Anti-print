import express from 'express';
import multer from 'multer';
import { uploadFile, getPreviewPdf, getDownloadUrl } from '../controllers/uploadController'; 
import { protect, authorize } from '../middlewares/authMiddleware';

const router = express.Router();

// SECURITY: Whitelist allowed file types
const ALLOWED_MIMES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
];

const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type '${file.mimetype}' is not allowed. Accepted: PDF, Images, Word, PowerPoint, Excel, CSV`));
    }
  },
});

// Custom error handler for Multer errors
const handleUpload = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  upload.single('file')(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'File too large. Maximum size is 50MB.' });
      }
      return res.status(400).json({ message: err.message });
    }
    if (err) {
      return res.status(403).json({ message: err.message });
    }
    next();
  });
};

router.post('/', protect, handleUpload, uploadFile);

// NEW ROUTE: Get PDF Preview
router.post('/preview-pdf', protect, authorize('OWNER', 'EMPLOYEE'), getPreviewPdf); 

// ROUTE: Get Signed Original File Download URL
router.post('/download-url', protect, authorize('OWNER', 'EMPLOYEE'), getDownloadUrl);

export default router;