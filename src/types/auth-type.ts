import { components } from '@/app/api/schema-auth';

export interface UserInfo {
  id: string;
  username: string;
  email: string | null;
  phoneNumber: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  avatarUrl: string;
  avatarKey: string;
  backgroundUrl: string;
  backgroundKey: string;
  bio: string;
  address: string;
  privateAccount: boolean;
  isVerified: boolean;
  walletAddress: string;
  role: string;
  status: string;
  appTypes: string[];
  createdAt: string;
  updatedAt: string;
  followersCount: number;
  followingCount: number;
  friendsCount: number;
}

export interface CompleteRegisterBody {
  appType: 'payii'; // repeated in body per spec
  email?: string;
  phoneNumber?: string;
  registerType: string;
  username: string;
  password: string;
  networkBase?: 'ethereum' | 'base' | string;
  walletAddress?: string;
  walletProvider?: 'metamask' | string;
}

export interface CompleteRegisterResponse {
  access_token: string;
  refresh_token: string;
  expired_at: string;
  is_new_user: boolean;
  require_2fa: boolean;
  tmp_token?: string | null;
}

export type RegisterNewPasskeyRequest = components['schemas']['models.RegisterNewPasskeyRequest'];

export type LoginPasskeyRequest = components['schemas']['models.LoginPasskeyRequest'];
export type PasskeyNonceResponse = components['schemas']['models.PasskeyNonceResponse'];

export type UpdateFCMTokenParams = components['schemas']['models.UpdateFCMTokenRequest'];