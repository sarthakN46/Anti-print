import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import Order from '../models/Order';
import Shop from '../models/Shop';
import s3, { BUCKET_NAME } from '../config/s3';
import { processOrderFiles } from '../services/conversionService';

// Helper: Generate a random 4-digit pickup code
const generatePickupCode = () => Math.floor(1000 + Math.random() * 9000).toString();

// @desc    Create new print order
// @route   POST /api/orders
// @access  Private (User)
export const createOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { shopId, items } = req.body;

    // 1. Fetch Shop Rules
    const shop = await Shop.findById(shopId);
    if (!shop) {
      res.status(404).json({ message: 'Shop not found' });
      return;
    }

    // Prepare Order ID (MongoDB ID is generated on instantiation)
    const newOrder = new Order({
      shop: shopId,
      user: req.user?._id,
      items: [], // Will fill after processing
      totalAmount: 0,
      pickupCode: generatePickupCode(),
      paymentStatus: 'PENDING',
      orderStatus: 'QUEUED'
    });

    // 2. Process Items & Move Files
    let grandTotal = 0;
    const processedItems = [];

    // Folder Name: <ShopName>_<ShopID>
    // Sanitize Shop Name for folder safety
    const safeShopName = shop.name.replace(/[^a-zA-Z0-9]/g, '_');
    const shopFolder = `${safeShopName}_${shop._id}`;

    // Orderer Name
    const safeUserName = req.user?.name.replace(/[^a-zA-Z0-9]/g, '_') || 'Guest';
    const orderFolder = `${safeUserName}_${newOrder._id}`;

    for (const item of items) {
       const isColor = item.config.color === 'color';
       const isDouble = item.config.side === 'double';
       const size = item.config.paperSize || 'A4'; // Default to A4
       
       let fileCost = 0;
       
       // Calculate Total Sheets (Logical Pages)
       const totalSheets = item.pageCount * item.config.copies;

       let rate = 0;

       // Handle Large Formats (A3, A2, A1)
       if (size !== 'A4' && shop.pricing.otherSizes && (shop.pricing.otherSizes as any)[size]) {
           const sizePricing = (shop.pricing.otherSizes as any)[size];
           rate = isColor ? sizePricing.color : sizePricing.bw;
           
           // Match frontend logic: Double sided large format = 2x rate (per page)
           if (isDouble) rate = rate * 2;

       } else {
           // Standard A4 Logic
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
       
       fileCost = rate * totalSheets;
       grandTotal += fileCost;

       // Move File in MinIO
       // Current Key: <ShopID>/temp/<UUID>.<ext>
       // Target Key: <ShopName_ShopID>/<UserName_OrderID>/<OriginalName>
       
       const oldKey = item.storageKey;
       
       const newKey = `${shopFolder}/${orderFolder}/${item.originalName}`;

       try {
          await s3.copyObject({
             Bucket: BUCKET_NAME,
             CopySource: `/${BUCKET_NAME}/${oldKey}`, // CopySource requires Bucket/Key
             Key: newKey
          }).promise();

          // Delete old temp file (Async, don't wait)
          s3.deleteObject({ Bucket: BUCKET_NAME, Key: oldKey }).promise().catch(console.error);

          processedItems.push({
             ...item,
             storageKey: newKey,
             calculatedCost: fileCost
          });

       } catch (err) {
          console.error(`Failed to move file ${oldKey} to ${newKey}`, err);
          // Fallback: keep old key if move fails
          processedItems.push({
             ...item,
             calculatedCost: fileCost
          });
       }
    }

    newOrder.items = processedItems;
    newOrder.totalAmount = grandTotal;
    
    await newOrder.save();

    res.status(201).json(newOrder);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Order creation failed' });
  }
};

// @desc    Initiate Payment (Mock Razorpay)
// @route   POST /api/orders/checkout
// @access  Private (User)
export const createPaymentOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);
    
    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    // Mock Razorpay Order ID
    const razorpayOrderId = `order_mock_${Math.floor(Math.random() * 1000000)}`;

    res.json({
      id: razorpayOrderId,
      currency: 'INR',
      amount: order.totalAmount * 100 // Rupees to Paise
    });

  } catch (error) {
    res.status(500).json({ message: 'Payment initiation failed' });
  }
};

// @desc    Verify Payment & Notify Shop
// @route   POST /api/orders/verify
// @access  Private (User)
export const verifyPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { orderId, paymentId } = req.body;
    
    const order = await Order.findById(orderId);
    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    // Update Order
    order.paymentStatus = 'PAID';
    order.paymentId = paymentId || `pay_mock_${Date.now()}`;
    await order.save();

    // Populate User for Socket Emission
    await order.populate('user', 'name email');

    // Emit Socket Event (Only after payment success)
    const io = req.app.get('io');
    if (io) {
      io.to(order.shop.toString()).emit('new_order', order);
    }

    // Trigger Background Conversion (Fire & Forget)
    processOrderFiles(order._id.toString());

    res.json({ status: 'success', order });

  } catch (error) {
    res.status(500).json({ message: 'Payment verification failed' });
  }
};

// @desc    Get Orders for My Shop
// @route   GET /api/orders/shop
// @access  Private (Owner/Employee)
export const getShopOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // 1. Find the shop
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

    // 2. Get orders, sort by newest
    const orders = await Order.find({ shop: shop._id })
      .populate('user', 'name email') 
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

export const updateOrderStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.body; 
    const order = await Order.findById(req.params.id);

    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    order.orderStatus = status;
    await order.save();

    // Emit Socket Event to User
    const io = req.app.get('io');
    if (io) {
       // We emit to the specific User's room (if we had user rooms) or just general for MVP.
       // Since we don't have user rooms set up in server.ts explicitly for users,
       // we can emit to the SHOP room (which user might not be in) OR
       // we can emit a global event and client filters it? No, that's bad.
       // Better: Let's emit to `order._id`. Client joins `order._id` room?
       // Or simpler: server.ts needs to join user to their userID room.
       
       // For now, let's assume we broadcast and client filters by their ID (Not secure but works for MVP local)
       // OR: let's fix server.ts to join user room.
       io.emit('order_status_updated', order);
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'Update failed' });
  }
};

// @desc    Cancel Order (User or Shop)
// @route   PUT /api/orders/:id/cancel
// @access  Private
export const cancelOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    // Check permissions (User owns it OR Shop owns it)
    const isOwner = order.user.toString() === req.user?._id.toString();
    
    // Check if shop owner/employee
    let isShopStaff = false;
    if (req.user?.role === 'OWNER' || req.user?.role === 'EMPLOYEE') {
       const shop = await Shop.findById(order.shop);
       if (shop && (shop.owner.toString() === req.user._id.toString() || req.user.associatedShop?.toString() === shop._id.toString())) {
          isShopStaff = true;
       }
    }

    if (!isOwner && !isShopStaff) {
       res.status(401).json({ message: 'Not authorized' });
       return;
    }

    // Can only cancel if QUEUED
    if (order.orderStatus !== 'QUEUED') {
       res.status(400).json({ message: 'Cannot cancel order in progress or already completed' });
       return;
    }

    // Refund Logic (Mock)
    if (order.paymentStatus === 'PAID') {
       console.log(`[Refund] Initiating refund for Order ${order._id} Amount: ${order.totalAmount}`);
       // Here we would call Razorpay refund API
       order.paymentStatus = 'REFUNDED'; 
    }

    order.orderStatus = 'CANCELLED';
    await order.save();

    // Populate for response/socket
    await order.populate('user', 'name email');

    // Emit Socket Event
    const io = req.app.get('io');
    if (io) {
      io.emit('order_status_updated', order);
    }

    res.json({ message: 'Order cancelled successfully', order });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Cancellation failed' });
  }
};

// @desc    Get Shop History with Filters
// @route   GET /api/orders/history
// @access  Private (Owner/Employee)
export const getShopHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, search } = req.query;

    // 1. Find Shop
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

    // 2. Build Query
    let query: any = { shop: shopId };

    // Date Filter
    if (startDate || endDate) {
       query.createdAt = {};
       if (startDate) query.createdAt.$gte = new Date(startDate as string);
       if (endDate) query.createdAt.$lte = new Date(new Date(endDate as string).setHours(23,59,59));
    }

    // Search (Complex: Need to search by populated User Name)
    // Mongoose doesn't support direct filtering on populated fields easily in `find`.
    // We can filter AFTER fetch or use Aggregate. For scale, Aggregate is better.
    // For MVP, if search is present, we might need to find users first?
    // Actually, let's keep it simple: Search by Order ID (last 6 chars) or exact match.
    // Or if search string provided, we fetch orders and filter in JS (okay for small scale).
    
    const orders = await Order.find(query)
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    if (search) {
       const searchStr = (search as string).toLowerCase();
       const filtered = orders.filter((o: any) => 
          o.user?.name.toLowerCase().includes(searchStr) || 
          o._id.toString().includes(searchStr)
       );
       res.json(filtered);
       return;
    }

    res.json(orders);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get My Orders (User)
// @route   GET /api/orders/my
// @access  Private (User)
export const getMyOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log(`[getMyOrders] Fetching for user: ${req.user?._id}`);
    const orders = await Order.find({ user: req.user?._id }).sort({ createdAt: -1 });
    console.log(`[getMyOrders] Found ${orders.length} orders`);
    res.json(orders);
  } catch (error) {
    console.error(`[getMyOrders] Error:`, error);
    res.status(500).json({ message: 'Server Error' });
  }
};