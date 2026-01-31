import express from 'express';
import { 
  createShop, 
  getMyShop, 
  getAllShops, 
  getShopById, // <--- Import
  updateShop, 
  updatePricing,
  toggleShopStatus,
  addEmployee
} from '../controllers/shopController';
import { protect, authorize } from '../middlewares/authMiddleware';

const router = express.Router();

// Public Routes
router.get('/', getAllShops);
router.get('/qr/:id', getShopById); // Public access for QR scanning

// Protected Routes (Require Login)
router.use(protect); 

// Create Shop (One time setup)
router.post('/', authorize('OWNER'), createShop);

// Get My Shop Details
// This route is specific, so it should take precedence if defined before a generic /:id route IF both were in same scope.
// But since /:id is public, we define it *above* protect? 
// Actually, let's keep /:id public but ensure we don't break /my-shop. 
// /my-shop is protected. 
// If we define router.get('/:id', getShopById) at the top, GET /my-shop will match it.
// We should define /:id at the END, but since it needs to be Public, we can't put it after router.use(protect).
// Solution: Use a regex or verify ID format in controller. 
// OR: Just define it here, and in controller check if ID is valid ObjectId. 
// "my-shop" is not a valid ObjectId, so mongoose will throw CastError.

// Let's rely on placement. We move `getMyShop` UP to be before `router.use(protect)`? No, it needs protection.
// We can define the public generic route at the end? No, then it would require auth.

// Correct approach for mixed public/protected with path params:
// 1. Specific Public Routes
// 2. Specific Protected Routes (wrapper)
// 3. Generic Public Routes

// But `protect` middleware is applied via `router.use`.
// So we must define public routes BEFORE `router.use(protect)`.

// Let's modify the structure slightly.