import mongoose, { Schema, Document } from 'mongoose';

export interface ISignal {
  _id: string;
  owner_type: 'user' | 'business' | 'agent';
  owner_id: string;
  type: 'presence' | 'intent' | 'offer' | 'event' | 'update' | 'proof';
  title: string;
  description?: string;
  category: string;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  radius: number;
  visibility: 'public' | 'circle' | 'private';
  verified: boolean;
  trust_score_snapshot: number;
  status: 'active' | 'expired' | 'hidden' | 'suppressed';
  starts_at: Date;
  expires_at: Date;
  metadata: Record<string, unknown>;
  created_at: Date;
}

const SignalSchema = new Schema<ISignal>(
  {
    _id: { type: String, default: () => `signal_${new mongoose.Types.ObjectId().toString()}` },
    owner_type: { type: String, enum: ['user', 'business', 'agent'], required: true },
    owner_id: { type: String, required: true },
    type: { type: String, enum: ['presence', 'intent', 'offer', 'event', 'update', 'proof'], required: true },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String },
    category: { type: String, required: true },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
    },
    radius: { type: Number, default: 300 },
    visibility: { type: String, enum: ['public', 'circle', 'private'], default: 'public' },
    verified: { type: Boolean, default: false },
    trust_score_snapshot: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'expired', 'hidden', 'suppressed'], default: 'active' },
    starts_at: { type: Date, default: Date.now },
    expires_at: { type: Date, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    created_at: { type: Date, default: Date.now },
  },
  { _id: false, timestamps: false }
);

SignalSchema.index({ location: '2dsphere' });
SignalSchema.index({ type: 1, status: 1, expires_at: 1 });
SignalSchema.index({ owner_id: 1, status: 1 });
SignalSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.Signal || mongoose.model<ISignal>('Signal', SignalSchema);
