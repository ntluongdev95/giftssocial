import mongoose, { Schema } from 'mongoose';

// ─── Professional Profile — map-visible resume/portfolio ─────────────────

export interface IExperience {
  title: string;
  company: string;
  start_year: number;
  end_year?: number | null; // null = present
  description?: string;
}

export interface IEducation {
  degree: string;
  school: string;
  year: number;
}

export interface IProfile {
  _id: string;
  user_id: string;
  headline: string;
  bio: string;
  industry: string;
  skills: string[];
  experience: IExperience[];
  education: IEducation[];
  languages: string[];
  location: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  city: string;
  available: boolean;
  work_type: 'remote' | 'onsite' | 'hybrid';
  salary_range?: { min: number; max: number; currency: string };
  portfolio_url?: string;
  contact_visible: boolean;
  trust_score_snapshot: number;
  status: 'active' | 'hidden' | 'suspended';
  created_at: Date;
  updated_at: Date;
}

const ExperienceSchema = new Schema<IExperience>(
  {
    title: { type: String, required: true },
    company: { type: String, required: true },
    start_year: { type: Number, required: true },
    end_year: { type: Number, default: null },
    description: { type: String },
  },
  { _id: false }
);

const EducationSchema = new Schema<IEducation>(
  {
    degree: { type: String, required: true },
    school: { type: String, required: true },
    year: { type: Number, required: true },
  },
  { _id: false }
);

const ProfileSchema = new Schema<IProfile>(
  {
    _id: { type: String, default: () => `profile_${new mongoose.Types.ObjectId().toString()}` },
    user_id: { type: String, required: true, unique: true },
    headline: { type: String, required: true, maxlength: 120 },
    bio: { type: String, maxlength: 1000, default: '' },
    industry: { type: String, required: true },
    skills: { type: [String], default: [] },
    experience: { type: [ExperienceSchema], default: [] },
    education: { type: [EducationSchema], default: [] },
    languages: { type: [String], default: [] },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
    },
    city: { type: String, default: '' },
    available: { type: Boolean, default: true },
    work_type: { type: String, enum: ['remote', 'onsite', 'hybrid'], default: 'onsite' },
    salary_range: {
      type: {
        min: Number,
        max: Number,
        currency: { type: String, default: 'USD' },
      },
      default: undefined,
    },
    portfolio_url: { type: String },
    contact_visible: { type: Boolean, default: false },
    trust_score_snapshot: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'hidden', 'suspended'], default: 'active' },
  },
  { _id: false, timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

// Geo search — find candidates near a location
ProfileSchema.index({ location: '2dsphere' });
// Filter by industry + availability
ProfileSchema.index({ industry: 1, available: 1, status: 1 });
// Filter by skills
ProfileSchema.index({ skills: 1 });
// One profile per user
ProfileSchema.index({ user_id: 1 }, { unique: true });

export default mongoose.models.Profile || mongoose.model<IProfile>('Profile', ProfileSchema);
