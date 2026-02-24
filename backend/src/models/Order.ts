import mongoose, { Document, Schema } from 'mongoose';

interface IOrderItem {
  storageKey: string;   // MinIO ID
  originalName: string; 
  fileHash: string;     // SHA-256 for Batching
  fileType?: string;    // 'pdf', 'docx', 'pptx', etc.
  pageCount: number;    // Total pages in doc
  convertedKey?: string; // S3 Key for the pre-converted PDF
  config: {
    color: 'bw' | 'color';
    side: 'single' | 'double';
    copies: number;
    paperType: string;
    pageRange?: string;
    orientation?: 'portrait' | 'landscape';
    paperSize?: 'A4' | 'A3' | 'A2' | 'A1';
  };
  calculatedCost: number; // The price for THIS specific file
}

export interface IOrder extends Document {
  shop: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  items: IOrderItem[];
  
  // Financials
  totalAmount: number;
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  paymentId?: string; // Razorpay ID
  
  // Workflow Status
  orderStatus: 'QUEUED' | 'PROCESSING' | 'PRINTING' | 'READY' | 'COMPLETED' | 'CANCELLED';
  
  // Security
  pickupCode: string; // A 4-digit code the user shows to collect
}

const OrderSchema = new Schema<IOrder>({
  shop: { type: Schema.Types.ObjectId, ref: 'Shop', required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  
  items: [{
    storageKey: { type: String, required: true },
    originalName: { type: String, required: true },
    fileHash: { type: String, required: true }, // <--- The Batching Key
    fileType: { type: String }, // New
    pageCount: { type: Number, required: true },
    convertedKey: { type: String }, // New
    config: {
      color: { type: String, enum: ['bw', 'color'], default: 'bw' },
      side: { type: String, enum: ['single', 'double'], default: 'single' },
      copies: { type: Number, default: 1 },
      paperType: { type: String, default: 'A4_75gsm' },
      pageRange: { type: String, default: 'All' },
      orientation: { type: String, enum: ['portrait', 'landscape'], default: 'portrait' },
      paperSize: { type: String, enum: ['A4', 'A3', 'A2', 'A1'], default: 'A4' }
    },
    calculatedCost: { type: Number, required: true }
  }],

  totalAmount: { type: Number, required: true },
  paymentStatus: { 
    type: String, 
    enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'], 
    default: 'PENDING' 
  },
  paymentId: { type: String },

  orderStatus: { 
    type: String, 
    enum: ['QUEUED', 'PROCESSING', 'PRINTING', 'READY', 'COMPLETED', 'CANCELLED'], 
    default: 'QUEUED' 
  },
  
  pickupCode: { type: String, required: true }

}, { timestamps: true });

export default mongoose.model<IOrder>('Order', OrderSchema);