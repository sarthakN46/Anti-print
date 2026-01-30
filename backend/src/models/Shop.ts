import mongoose, { Document, Schema } from 'mongoose';

// 1. The TypeScript Interface (The Contract)
export interface IShop extends Document {
  owner: mongoose.Types.ObjectId;
  name: string;
  address: string; // <--- This was missing or mismatched in your type definition
  location: {
    type: string;
    coordinates: number[];
  };
  image?: string; // Shop Profile Photo URL
  status: 'OPEN' | 'CLOSED' | 'BUSY';
  pricing: {
    bw: {
      single: number;
      double: number;
    };
    color: {
      single: number;
      double: number;
    };
    bulkDiscount: {
      enabled: boolean;
      threshold: number; // e.g., 100 pages
      bwPrice: number;   // e.g., 1.5
      colorPrice: number; // e.g., 8
    };
    pptPricing?: {
      single: number;
      two: number;
      four: number;
      six: number;
      nine: number;
    };
  };
}

// 2. The Mongoose Schema (The Database Structure)
const ShopSchema = new Schema<IShop>({
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  address: { type: String, required: true }, 
  location: {
    type: { type: String, default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] } 
  },
  image: { type: String },
  status: { 
    type: String, 
    enum: ['OPEN', 'CLOSED', 'BUSY'], 
    default: 'OPEN' 
  },
  pricing: {
    bw: {
      single: { type: Number, default: 3.0 },
      double: { type: Number, default: 2.0 }
    },
    color: {
      single: { type: Number, default: 10.0 },
      double: { type: Number, default: 8.0 }
    },
    bulkDiscount: {
      enabled: { type: Boolean, default: false },
      threshold: { type: Number, default: 100 },
      bwPrice: { type: Number, default: 1.5 },
      colorPrice: { type: Number, default: 8.0 }
    },
    pptPricing: {
      single: { type: Number, default: 3.0 },
      two: { type: Number, default: 2.5 },
      four: { type: Number, default: 2.0 },
      six: { type: Number, default: 1.5 },
      nine: { type: Number, default: 1.0 }
    }
  }
}, { timestamps: true });

export default mongoose.model<IShop>('Shop', ShopSchema);