import express from 'express';
import { 
  createShop, 
  getMyShop, 
  getAllShops, 
  getShopById, 
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
router.get('/my-shop', authorize('OWNER', 'EMPLOYEE'), getMyShop);

// Toggle Shop Status (Open/Closed)
router.put('/status', authorize('OWNER', 'EMPLOYEE'), toggleShopStatus);

// Add Employee
router.post('/employees', authorize('OWNER'), addEmployee);

// Update Pricing
router.put('/pricing', authorize('OWNER'), updatePricing);

// Update General Shop Info
router.put('/:id', authorize('OWNER'), updateShop);

export default router;
