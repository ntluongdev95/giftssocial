
import { apiRequest } from '../PayiiApiClient';
import { components } from '../schema-payii';


// Types
type CreateAccountRequest = components['schemas']['dto.CreateAccountRequest'];
type CreateAccountResponse = components['schemas']['dto.CreateAccountReponse'];
type CheckAccountResponse = components['schemas']['dto.CheckAccountResponse'];

/**
 * Normalize account status from API to frontend format
 * API returns: "reject", "pending", "complete", "active", "approved"
 * Frontend expects: "rejected", "pending", "complete"
 */
function normalizeAccountStatus(
  status: string | undefined,
): 'pending' | 'rejected' | 'complete' | undefined {
  if (!status) return undefined;

  const normalized = status.toLowerCase();

  // Map API statuses to frontend statuses
  if (normalized === 'reject' || normalized === 'rejected') {
    return 'rejected';
  }
  if (normalized === 'complete' || normalized === 'approved' || normalized === 'active') {
    return 'complete';
  }
  // Default to pending for any other status
  return undefined;
}

/**
 * Normalize KYB status from API to frontend format
 * API returns: pending, rejected, complete, null
 */
function normalizeKYBStatus(
  status: string | undefined,
): 'pending' | 'rejected' | 'complete' | undefined {
  return status as 'pending' | 'rejected' | 'complete' | undefined;
}

/**
 * Get account information by user ID from token
 */
export const getAccountApi = async (): Promise<CreateAccountResponse | null> => {
  const { data } = await apiRequest({
    method: 'get',
    url: '/v1/accounts',
  });

  const response = data as { code: string; message: string; data: CreateAccountResponse };

  // code "003" means account not found - return null instead of throwing
  if (response.code === '003') {
    return null;
  }

  const accountData = response.data;

  // Normalize status if account exists
  if (accountData?.status) {
    return {
      ...accountData,
      status: normalizeAccountStatus(accountData.status),
      kyb_status: normalizeKYBStatus(accountData.kyb_status),
    };
  }

  return accountData;
};

/**
 * Create a new business account
 */
export const createAccountApi = async (
  payload: CreateAccountRequest,
): Promise<CreateAccountResponse | undefined> => {
  const { data } = await apiRequest({
    method: 'post',
    url: '/v1/accounts',
    data: payload,
  });

  const response = data as { code: string; message: string; data: CreateAccountResponse };

  // Check for API error (code !== "000" means error)
  if (response.code !== '000') {
    throw new Error(response.message || 'Failed to create account');
  }

  return response.data;
};

/**
 * Check if user has account
 */
export const checkAccountApi = async (): Promise<CheckAccountResponse | undefined> => {
  const { data } = await apiRequest({
    method: 'get',
    url: '/v1/accounts/check',
  });

  const accountData = data.data;

  // Normalize status if account exists
  if (accountData?.status) {
    return {
      ...accountData,
      status: normalizeAccountStatus(accountData.status),
      kyb_status: normalizeKYBStatus(accountData.kyb_status),
    };
  }

  return accountData;
};