import mongoose, { Document, Schema } from 'mongoose';

export interface IUploadMetadata extends Document {
  storageKey: string;
  pageCount: number;
  originalName: string;
  fileHash: string;
  createdAt: Date;
}

const UploadMetadataSchema = new Schema<IUploadMetadata>({
  storageKey: { type: String, required: true, unique: true },
  pageCount: { type: Number, required: true, min: 1 },
  originalName: { type: String, required: true },
  fileHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 86400 } // Auto-delete after 24 hours (86400s)
});

export default mongoose.model<IUploadMetadata>('UploadMetadata', UploadMetadataSchema);
