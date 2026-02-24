import mongoose, { Document, Schema } from 'mongoose';

// 1. Define the Interface (For TypeScript Autocomplete)
export interface IUser extends Document {
  name: string;
  email: string;
  role: 'USER' | 'OWNER' | 'EMPLOYEE';

  // Auth Fields
  googleId?: string;       // For Users
  password?: string;       // For Shop Owners/Employees
  
  // Relationships
  associatedShop?: mongoose.Types.ObjectId; // If they are an employee, which shop?
  createdAt: Date;
}

// 2. Define the Schema (For MongoDB validation)
const UserSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: {
    type: String,
    enum: ['USER', 'OWNER', 'EMPLOYEE'],
    default: 'USER'
  },
  
  googleId: { type: String, select: false }, // Hidden by default for security
  password: { type: String, select: false }, // Hidden by default
  
  associatedShop: { type: Schema.Types.ObjectId, ref: 'Shop' }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt
});

export default mongoose.model<IUser>('User', UserSchema);