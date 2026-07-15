import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import Order from '../models/Order';
import Shop from '../models/Shop';
import s3, { BUCKET_NAME } from '../config/s3';
import { processOrderFiles } from '../services/conversionService';
import { getIO } from '../utils/socket';
import Razorpay from 'razorpay';
import crypto from 'crypto';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!
});

// Helper: Generate a cryptographically secure 4-digit pickup code
const generatePickupCode = (): string => {
  return (crypto.randomInt(1000, 9999)).toString();
};

// @desc    Create new print order
// @route   POST /api/orders
// @access  Private (User)
export const createOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { shopId, items } = req.body;

    // 1. Validate input
    if (!shopId || !items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ message: 'shopId and at least one item are required' });
      return;
    }

    // 2. Fetch Shop Rules
    const shop = await Shop.findById(shopId);
    if (!shop) {
      res.status(404).json({ message: 'Shop not found' });
      return;
    }

    if (shop.status === 'CLOSED') {
      res.status(400).json({ message: 'This shop is currently closed. Cannot place an order.' });
      return;
    }

    // 3. Prepare Order
    const newOrder = new Order({
      shop: shopId,
      user: req.user?._id,
      items: [],
      totalAmount: 0,
      pickupCode: generatePickupCode(),
      paymentStatus: 'PENDING',
      orderStatus: 'QUEUED'
    });

    // 4. Process Items & Move Files + Server-side cost calculation (never trust frontend cost)
    let grandTotal = 0;
    const processedItems = [];

    const safeShopName = shop.name.replace(/[^a-zA-Z0-9]/g, '_');
    const shopFolder = `${safeShopName}_${shop._id}`;
    const safeUserName = req.user?.name.replace(/[^a-zA-Z0-9]/g, '_') || 'Guest';
    const orderFolder = `${safeUserName}_${newOrder._id}`;

    for (const item of items) {
      const isColor = item.config.color === 'color';
      const isDouble = item.config.side === 'double';
      const size = item.config.paperSize || 'A4';
      const copies = Math.max(1, parseInt(item.config.copies) || 1);
      const pageCount = Math.max(1, parseInt(item.pageCount) || 1);

      let rate = 0;

      // Handle Large Formats (A3, A2, A1)
      if (size !== 'A4' && shop.pricing.otherSizes && (shop.pricing.otherSizes as any)[size]) {
        const sizePricing = (shop.pricing.otherSizes as any)[size];
        rate = isColor ? sizePricing.color : sizePricing.bw;
        // Double sided large format = 2x rate (per page)
        if (isDouble) rate = rate * 2;
      } else {
        // Standard A4 Logic
        const totalSheets = pageCount * copies;
        const bulk = shop.pricing.bulkDiscount;
        if (bulk && bulk.enabled && totalSheets >= bulk.threshold) {
          rate = isColor ? bulk.colorPrice : bulk.bwPrice;
        } else {
          if (isColor) {
            rate = isDouble ? shop.pricing.color.double : shop.pricing.color.single;
          } else {
            rate = isDouble ? shop.pricing.bw.double : shop.pricing.bw.single;
          }
        }
      }

      const totalSheets = pageCount * copies;
      const fileCost = rate * totalSheets;
      grandTotal += fileCost;

      // Move File in MinIO: temp -> order folder
      const oldKey = item.storageKey;
      const newKey = `${shopFolder}/${orderFolder}/${item.originalName}`;

      try {
        await s3.copyObject({
          Bucket: BUCKET_NAME,
          CopySource: `/${BUCKET_NAME}/${oldKey}`,
          Key: newKey
        }).promise();

        // Delete old temp file (Async, don't wait)
        s3.deleteObject({ Bucket: BUCKET_NAME, Key: oldKey }).promise().catch(console.error);

        processedItems.push({
          ...item,
          pageCount,
          storageKey: newKey,
          calculatedCost: fileCost  // Always server-calculated, never trust frontend
        });
      } catch (err) {
        console.error(`Failed to move file ${oldKey} to ${newKey}`, err);
        // Fallback: keep old key if move fails
        processedItems.push({
          ...item,
          pageCount,
          calculatedCost: fileCost
        });
      }
    }

    // 5. Minimum amount guard (Razorpay requires >= ₹1)
    if (grandTotal < 1) {
      res.status(400).json({ message: 'Order total must be at least ₹1. Please check shop pricing.' });
      return;
    }

    newOrder.items = processedItems;
    newOrder.totalAmount = Math.round(grandTotal * 100) / 100; // Round to 2 decimal places
    await newOrder.save();

    res.status(201).json(newOrder);

  } catch (error) {
    console.error('[createOrder] Error:', error);
    res.status(500).json({ message: 'Order creation failed' });
  }
};

// @desc    Initiate Payment (Razorpay)
// @route   POST /api/orders/checkout
// @access  Private (User)
export const createPaymentOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      res.status(400).json({ message: 'orderId is required' });
      return;
    }

    const order = await Order.findById(orderId);
    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    // Security: Ensure this order belongs to the requesting user
    if (order.user.toString() !== req.user?._id.toString()) {
      res.status(403).json({ message: 'Not authorized to checkout this order' });
      return;
    }

    // Prevent duplicate Razorpay orders for already-paid orders
    if (order.paymentStatus === 'PAID') {
      res.status(400).json({ message: 'This order has already been paid.' });
      return;
    }

    const amountInPaise = Math.round(order.totalAmount * 100);

    // Razorpay minimum: 100 paise (₹1)
    if (amountInPaise < 100) {
      res.status(400).json({ message: `Order amount ₹${order.totalAmount} is below the minimum ₹1 required for payment.` });
      return;
    }

    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: `rcpt_${order._id.toString().slice(-12)}`,
    };

    const razorpayOrder = await razorpay.orders.create(options);

    if (!razorpayOrder) {
      res.status(500).json({ message: 'Razorpay order creation failed' });
      return;
    }

    res.json({
      id: razorpayOrder.id,
      currency: razorpayOrder.currency,
      amount: razorpayOrder.amount,
      keyId: process.env.RAZORPAY_KEY_ID
    });

  } catch (error) {
    console.error("[createPaymentOrder] Razorpay Error:", error);
    res.status(500).json({ message: 'Payment initiation failed' });
  }
};

// @desc    Verify Payment & Notify Shop
// @route   POST /api/orders/verify
// @access  Private (User)
export const verifyPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { orderId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    if (!orderId || !razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      res.status(400).json({ message: 'Missing payment verification parameters' });
      return;
    }

    const order = await Order.findById(orderId);
    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    // Prevent double-processing
    if (order.paymentStatus === 'PAID') {
      res.json({ status: 'success', order, message: 'Payment already verified' });
      return;
    }

    // Verify Razorpay Signature (HMAC-SHA256)
    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      // Mark as FAILED but do NOT cancel — let admin investigate
      order.paymentStatus = 'FAILED';
      await order.save();
      res.status(400).json({ message: 'Payment verification failed: Invalid signature. Contact support.' });
      return;
    }

    // Payment verified: Mark PAID → PROCESSING (no way back — no cancellation after this point)
    order.paymentStatus = 'PAID';
    order.paymentId = razorpay_payment_id;
    order.orderStatus = 'PROCESSING'; // Will return to QUEUED after conversion
    await order.save();

    // Populate User for Socket Emission
    await order.populate('user', 'name email');

    // Notify user that payment was received and we're processing
    try {
      const io = getIO();
      const userId = order.user && (order.user as any)._id
        ? (order.user as any)._id.toString()
        : order.user?.toString();

      if (userId) {
        io.to(userId).emit('order_status_updated', order);
        io.to(userId).emit('notification', {
          message: `Payment confirmed! Your order #${order._id.toString().slice(-4)} is being prepared for ${(order.shop as any)?.name || 'the shop'}.`,
          type: 'success'
        });
      }
    } catch (e) {
      console.error('[verifyPayment] Socket emission failed', e);
    }

    // Trigger Background Conversion (Fire & Forget)
    processOrderFiles(order._id.toString());

    res.json({ status: 'success', order });

  } catch (error) {
    console.error("[verifyPayment] Error:", error);
    res.status(500).json({ message: 'Payment verification failed' });
  }
};

// @desc    Get Orders for My Shop
// @route   GET /api/orders/shop
// @access  Private (Owner/Employee)
export const getShopOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let shop;
    if (req.user?.role === 'EMPLOYEE') {
      shop = await Shop.findById(req.user.associatedShop);
    } else {
      shop = await Shop.findOne({ owner: req.user?._id });
    }

    if (!shop) {
      res.status(404).json({ message: 'Shop not found' });
      return;
    }

    const orders = await Order.find({ shop: shop._id })
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    console.error('[getShopOrders] Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update Order Status (Shop)
// @route   PUT /api/orders/:id/status
// @access  Private (Owner/Employee)
export const updateOrderStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.body;

    const validStatuses = ['QUEUED', 'PROCESSING', 'PRINTING', 'READY', 'COMPLETED'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      return;
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    // Verify shop staff owns this order's shop
    let shop;
    if (req.user?.role === 'EMPLOYEE') {
      shop = await Shop.findById(req.user.associatedShop);
    } else {
      shop = await Shop.findOne({ owner: req.user?._id });
    }

    if (!shop || shop._id.toString() !== order.shop.toString()) {
      res.status(403).json({ message: 'Not authorized to update this order' });
      return;
    }

    if (order.paymentStatus !== 'PAID') {
      res.status(400).json({ message: 'Cannot update status of an unpaid order.' });
      return;
    }

    order.orderStatus = status;
    await order.save();

    // Emit Socket Event to User & Shop
    try {
      const io = getIO();
      const shopId = order.shop.toString();
      const userId = order.user.toString();

      io.to(shopId).emit('order_status_updated', order);
      io.to(userId).emit('order_status_updated', order);

      // Send specific user notifications
      if (status === 'READY') {
        io.to(userId).emit('notification', {
          message: `Order #${order._id.toString().slice(-4)} is READY for pickup! Show your 4-digit code.`,
          type: 'success'
        });
      } else if (status === 'COMPLETED') {
        io.to(userId).emit('notification', {
          message: `Order #${order._id.toString().slice(-4)} completed. Thank you!`,
          type: 'info'
        });
      } else if (status === 'PRINTING') {
        io.to(userId).emit('notification', {
          message: `Your order #${order._id.toString().slice(-4)} is now being printed!`,
          type: 'info'
        });
      }
    } catch (e) {
      console.error('[updateOrderStatus] Socket emission failed', e);
    }

    res.json(order);
  } catch (error) {
    console.error('[updateOrderStatus] Error:', error);
    res.status(500).json({ message: 'Update failed' });
  }
};

// @desc    Cancel Order — ONLY for UNPAID orders (PENDING payment status)
// @route   PUT /api/orders/:id/cancel
// @access  Private
// POLICY: Once payment is PAID, the order cannot be cancelled. 
//         The platform guarantees delivery to the shop.
export const cancelOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    // POLICY ENFORCEMENT: No cancellation after payment
    if (order.paymentStatus === 'PAID') {
      res.status(400).json({
        message: 'Paid orders cannot be cancelled. The platform guarantees your print will be processed. Contact support if there is an issue.'
      });
      return;
    }

    // Prevent double-cancellation
    if (order.orderStatus === 'CANCELLED') {
      res.status(400).json({ message: 'Order is already cancelled.' });
      return;
    }

    // Check permissions (User owns it OR Shop staff)
    const isOwner = order.user.toString() === req.user?._id.toString();

    let isShopStaff = false;
    if (req.user?.role === 'OWNER' || req.user?.role === 'EMPLOYEE') {
      const shop = await Shop.findById(order.shop);
      if (shop && (
        shop.owner.toString() === req.user._id.toString() ||
        req.user.associatedShop?.toString() === shop._id.toString()
      )) {
        isShopStaff = true;
      }
    }

    if (!isOwner && !isShopStaff) {
      res.status(403).json({ message: 'Not authorized to cancel this order' });
      return;
    }

    // Only cancel PENDING (not yet paid) orders
    if (order.orderStatus !== 'QUEUED' || order.paymentStatus !== 'PENDING') {
      res.status(400).json({
        message: 'Only unpaid pending orders can be cancelled.'
      });
      return;
    }

    order.orderStatus = 'CANCELLED';
    await order.save();

    await order.populate('user', 'name email');

    // Notify via Socket
    try {
      const io = getIO();
      const shopId = order.shop.toString();
      const userId = (order.user as any)?._id?.toString() || order.user?.toString();

      io.to(shopId).emit('order_status_updated', order);
      if (userId) {
        io.to(userId).emit('order_status_updated', order);
        io.to(userId).emit('notification', {
          message: `Order #${order._id.toString().slice(-4)} cancelled successfully.`,
          type: 'info'
        });
      }
    } catch (e) {
      console.error('[cancelOrder] Socket emission failed', e);
    }

    res.json({ message: 'Order cancelled successfully', order });

  } catch (error) {
    console.error('[cancelOrder] Error:', error);
    res.status(500).json({ message: 'Cancellation failed' });
  }
};

// @desc    Verify Pickup Code (Shop confirms customer identity)
// @route   POST /api/orders/:id/verify-pickup
// @access  Private (Owner/Employee)
export const verifyPickupCode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { pickupCode } = req.body;

    if (!pickupCode) {
      res.status(400).json({ message: 'Pickup code is required' });
      return;
    }

    const order = await Order.findById(req.params.id).populate('user', 'name email');
    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    // Verify shop staff has access to this shop's orders
    let shop;
    if (req.user?.role === 'EMPLOYEE') {
      shop = await Shop.findById(req.user.associatedShop);
    } else {
      shop = await Shop.findOne({ owner: req.user?._id });
    }

    if (!shop || shop._id.toString() !== order.shop.toString()) {
      res.status(403).json({ message: 'Not authorized for this order' });
      return;
    }

    // Check if order is in READY state
    if (order.orderStatus !== 'READY') {
      res.status(400).json({
        message: `Order is currently ${order.orderStatus}. It must be READY before pickup can be verified.`
      });
      return;
    }

    // Verify the pickup code (timing-safe comparison)
    const isValid = crypto.timingSafeEqual(
      Buffer.from(order.pickupCode, 'utf8'),
      Buffer.from(pickupCode.toString(), 'utf8')
    );

    if (!isValid) {
      res.status(400).json({ message: 'Invalid pickup code. Please ask the customer to check their order.' });
      return;
    }

    // Code is correct — mark as COMPLETED
    order.orderStatus = 'COMPLETED';
    await order.save();

    // Notify user
    try {
      const io = getIO();
      const userId = (order.user as any)?._id?.toString() || order.user?.toString();
      const shopId = order.shop.toString();

      io.to(shopId).emit('order_status_updated', order);
      if (userId) {
        io.to(userId).emit('order_status_updated', order);
        io.to(userId).emit('notification', {
          message: `Order #${order._id.toString().slice(-4)} picked up successfully! Thank you for printing with us.`,
          type: 'success'
        });
      }
    } catch (e) {
      console.error('[verifyPickupCode] Socket emission failed', e);
    }

    res.json({
      message: 'Pickup code verified. Order marked as COMPLETED.',
      order
    });

  } catch (error) {
    console.error('[verifyPickupCode] Error:', error);
    res.status(500).json({ message: 'Pickup verification failed' });
  }
};

// @desc    Get Shop History with Filters
// @route   GET /api/orders/history
// @access  Private (Owner/Employee)
export const getShopHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, search } = req.query;

    let shopId;
    if (req.user?.role === 'EMPLOYEE') {
      shopId = req.user.associatedShop;
    } else {
      const shop = await Shop.findOne({ owner: req.user?._id });
      shopId = shop?._id;
    }

    if (!shopId) {
      res.status(404).json({ message: 'Shop not found' });
      return;
    }

    let query: any = { shop: shopId };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate as string);
      if (endDate) query.createdAt.$lte = new Date(new Date(endDate as string).setHours(23, 59, 59));
    }

    const orders = await Order.find(query)
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    if (search) {
      const searchStr = (search as string).toLowerCase();
      const filtered = orders.filter((o: any) =>
        o.user?.name?.toLowerCase().includes(searchStr) ||
        o._id.toString().includes(searchStr)
      );
      res.json(filtered);
      return;
    }

    res.json(orders);

  } catch (error) {
    console.error('[getShopHistory] Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get My Orders (User)
// @route   GET /api/orders/my
// @access  Private (User)
export const getMyOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orders = await Order.find({ user: req.user?._id })
      .populate('shop', 'name address')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error('[getMyOrders] Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};