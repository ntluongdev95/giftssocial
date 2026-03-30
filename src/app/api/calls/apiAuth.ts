
import {
  LoginPasskeyRequest,
  PasskeyNonceResponse,
  RegisterNewPasskeyRequest,
  UpdateFCMTokenParams,
} from '@/types/auth-type';
import { apiRequest } from '../AuthApiClient';
import { getRefreshTokenFromLocal } from '@/lib/clients/storage.helper';


// Get nonce for passkey registration/login (using Device-ID header)
export const getPasskeyNonceApi = async (): Promise<PasskeyNonceResponse | undefined> => {
  try {
    const { data } = await apiRequest({
      method: 'get',
      url: '/api/v1/auth/passkey/nonce',
    });
    return data.data;
  } catch (error) {
    console.error('Error get passkey nonce', error);
    throw error;
  }
};

export const passKeyLoginApi = async (loginPasskeyRequest: LoginPasskeyRequest) => {
  try {
    const { data } = await apiRequest({
      method: 'post',
      url: '/api/v1/auth/wallet/login-passkey',
      data: loginPasskeyRequest,
    });
    return data.data;
  } catch (error) {
    console.error('Error passkey login', error);
    return null;
  }
};

export const passKeyRegisterApi = async (registerNewPasskeyRequest: RegisterNewPasskeyRequest) => {
  try {
    const { data } = await apiRequest({
      method: 'post',
      url: '/api/v1/auth/passkey/register',
      data: registerNewPasskeyRequest,
    });
    return data.data;
  } catch (error) {
    console.error('Error passkey register', error);
    return null;
  }
};

export const refreshTokenApi = async () => {
  try {
    const { data } = await apiRequest({
      method: 'post',
      url: '/api/v1/auth/refresh-token',
    });
    return data.data;
  } catch (error) {
    console.error('Error refresh token', error);
    return null;
  }
};

export const logoutApi = async () => {
  try {
    const refreshToken = getRefreshTokenFromLocal();
    const { data } = await apiRequest({
      method: 'post',
      url: '/api/v1/auth/sessions/logout',
      headers: {
        'Refresh-Token': refreshToken || '',
      } as never,
    });
    return data.data;
  } catch (error) {
    console.error('Error logout', error);
    return null;
  }
};

// Get user profiles by passkey ID (from cloud)
export const getProfilesByPasskeyApi = async (passkeyId: string) => {
  try {
    const { data } = await apiRequest({
      method: 'get',
      url: `/api/v1/auth/profiles-by-passkey/${passkeyId}` as '/api/v1/auth/profiles-by-passkey/{passkey_id}',
    });
    return data?.data;
  } catch (error) {
    console.error('Error get profiles by passkey', error);
    return null;
  }
};

// Get wallet detail by address (requires auth)
export const getWalletDetailApi = async (walletAddress: string) => {
  try {
    const { data } = await apiRequest({
      method: 'get',
      url: '/api/v1/auth/wallet/detail',
      params: { wallet_address: walletAddress },
    });
    return data?.data as {
      id?: string;
      user_id?: string;
      wallet_address?: string;
      network_base?: string;
      wallet_provider?: string;
      salt?: string;
      last_login_at?: string;
      created_at?: string;
      updated_at?: string;
    };
  } catch (error) {
    console.error('Error get wallet detail', error);
    return null;
  }
};

/**
 * Update FCM token for push notifications
 */
export const updateFCMTokenApi = async (params: UpdateFCMTokenParams): Promise<void> => {
  try {
    await apiRequest({
      method: 'post',
      url: '/api/v1/auth/fcm-token',
      data: params,
    });
  } catch (error) {
    console.error('Error updating FCM token:', error);
    throw error;
  }
};