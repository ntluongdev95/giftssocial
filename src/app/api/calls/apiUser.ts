
import { components } from "../schema-user";
import { apiRequest } from "../UserApiClient";


// Types
type UserInfoResponse = components['schemas']['models.UserInfoResponse'];
type UpdateUserRequest = components['schemas']['models.UpdateUserRequest'];

export const getMe = async (): Promise<UserInfoResponse | null> => {
  try {
    const { data } = await apiRequest({
      method: 'get',
      url: '/api/v1/users/me',
    });
    return (data as { data: UserInfoResponse }).data ?? null;
  } catch (error) {
    console.error('Error get me', error);
    return null;
  }
};

/**
 * Update current user's profile
 */
export const updateUserApi = async (
  userId: string,
  payload: UpdateUserRequest,
): Promise<UserInfoResponse | null> => {
  try {
    const { data } = await apiRequest({
      method: 'put',
      url: '/api/v1/users/{id}',
      urlParams: [{ key: 'id', value: userId }],
      data: payload as never,
    });
    return (data as unknown as { data: UserInfoResponse }).data ?? null;
  } catch (error) {
    console.error('Error updating user', error);
    throw error;
  }
};