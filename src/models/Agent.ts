import mongoose, { Schema, Document } from 'mongoose';

export interface IAgent {
  _id: string;
  name: string;
  type: 'system' | 'merchant' | 'personal' | 'circle';
  owner_type: 'business' | 'user' | 'gao' | 'community';
  owner_id: string;
  verified: boolean;
  trust_score: number;
  trust_level: 'new' | 'verified' | 'trusted' | 'highly_trusted';
  capabilities: string[];
  permission_scope: {
    can_suggest: boolean;
    can_prepare_action: boolean;
    execute_with_approval: string[];
    auto_execute: string[];
    requires_user_approval: boolean;
    can_access_payment: boolean;
  };
  location?: {
    type: 'Point';
    coordinates: [number, number];
  };
  map_visible: boolean;
  status: 'active' | 'idle' | 'executing' | 'paused';
  created_at: Date;
  updated_at: Date;
}

const AgentSchema = new Schema<IAgent>(
  {
    _id: { type: String, default: () => `agent_${new mongoose.Types.ObjectId().toString()}` },
    name: { type: String, required: true },
    type: { type: String, enum: ['system', 'merchant', 'personal', 'circle'], required: true },
    owner_type: { type: String, enum: ['business', 'user', 'gao', 'community'], required: true },
    owner_id: { type: String, required: true },
    verified: { type: Boolean, default: false },
    trust_score: { type: Number, default: 0 },
    trust_level: { type: String, enum: ['new', 'verified', 'trusted', 'highly_trusted'], default: 'new' },
    capabilities: [String],
    permission_scope: {
      can_suggest: { type: Boolean, default: true },
      can_prepare_action: { type: Boolean, default: true },
      execute_with_approval: [String],
      auto_execute: { type: [String], default: [] },
      requires_user_approval: { type: Boolean, default: true },
      can_access_payment: { type: Boolean, default: false },
    },
    location: {
      type: { type: String, enum: ['Point'] },
      coordinates: [Number],
    },
    map_visible: { type: Boolean, default: true },
    status: { type: String, enum: ['active', 'idle', 'executing', 'paused'], default: 'active' },
  },
  { _id: false, timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

AgentSchema.index({ location: '2dsphere' });
AgentSchema.index({ type: 1, trust_score: -1 });

export default mongoose.models.Agent || mongoose.model<IAgent>('Agent', AgentSchema);
