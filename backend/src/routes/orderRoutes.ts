import express from 'express';
import {
  createOrder,
  getShopOrders,
  updateOrderStatus,
  createPaymentOrder,
  verifyPayment,
  cancelOrder,
  getShopHistory,
  getMyOrders
} from '../controllers/orderController';
import { protect, authorize } from '../middlewares/authMiddleware';

const router = express.Router();

router.use(protect); // All order routes require login

router.post('/', createOrder);
router.post('/checkout', createPaymentOrder);
router.post('/verify', verifyPayment);

router.get('/shop', authorize('OWNER', 'EMPLOYEE'), getShopOrders);
router.get('/history', authorize('OWNER', 'EMPLOYEE'), getShopHistory);
router.get('/my', getMyOrders); // <--- New Route for Users
router.put('/:id/status', authorize('OWNER', 'EMPLOYEE'), updateOrderStatus);
router.put('/:id/cancel', cancelOrder); // <--- New Route (User or Staff)

export default router;