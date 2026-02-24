import express from 'express';
import multer from 'multer';
import { uploadFile, getPreviewPdf } from '../controllers/uploadController'; 
import { protect, authorize } from '../middlewares/authMiddleware';

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

router.post('/', protect, upload.single('file'), uploadFile);

// NEW ROUTE: Get PDF Preview
router.post('/preview-pdf', protect, authorize('OWNER', 'EMPLOYEE'), getPreviewPdf); 

export default router;