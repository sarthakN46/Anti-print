import express from 'express';
import {
  createOrder,
  getShopOrders,
  updateOrderStatus,
  createPaymentOrder,
  verifyPayment,
  cancelOrder,
  getShopHistory,
  getMyOrders,
  verifyPickupCode
} from '../controllers/orderController';
import { protect, authorize } from '../middlewares/authMiddleware';

const router = express.Router();

router.use(protect); // All order routes require login

// User: Create order and payment
router.post('/', createOrder);
router.post('/checkout', createPaymentOrder);
router.post('/verify', verifyPayment);

// User: View and manage own orders
router.get('/my', getMyOrders);
router.put('/:id/cancel', cancelOrder); // Only cancels UNPAID orders now

// Shop Staff: View orders
router.get('/shop', authorize('OWNER', 'EMPLOYEE'), getShopOrders);
router.get('/history', authorize('OWNER', 'EMPLOYEE'), getShopHistory);

// Shop Staff: Update status
router.put('/:id/status', authorize('OWNER', 'EMPLOYEE'), updateOrderStatus);

// Shop Staff: Verify pickup code (marks order COMPLETED)
router.post('/:id/verify-pickup', authorize('OWNER', 'EMPLOYEE'), verifyPickupCode);

export default router;