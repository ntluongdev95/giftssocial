import axios, {
  isAxiosError,
  type AxiosRequestConfig,
  type AxiosRequestHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import JSONBig from 'json-bigint';
import { toast } from 'sonner';

import { getDeviceID } from '@/lib/clients/storage.helper';
import { useAuthStore } from '@/stores/auth-store';
import {
  isArrayBuffer,
  isArrayBufferView,
  isBlob,
  isFile,
  isFormData,
  isObject,
  isURLSearchParams,
} from '@/lib/utils/api-client';

import type * as schemaHelper from './schemaHelper';
import { APP_TYPE_GAO_DOMAINS, AUTH_API_URL, USER_API_URL } from '@/types/constants';

// Check if error is a network error (no response from server)
const isNetworkError = (error: unknown): boolean => {
  if (!isAxiosError(error)) return true;
  return (
    !error.response &&
    (error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNABORTED' ||
      error.code === 'ETIMEDOUT' ||
      error.message === 'Network Error')
  );
};

const JSONBigStoreAsString = JSONBig({ storeAsString: true });

const setContentTypeIfUnset = (headers: AxiosRequestHeaders | undefined, value: string) => {
  if (typeof headers !== 'undefined' && headers['Content-Type'] === undefined) {
    headers['Content-Type'] = value;
  }
};

export const UserApiClient = axios.create({
  baseURL: USER_API_URL,
  transformResponse: [
    (data: unknown) => {
      if (typeof data === 'string' && data) {
        return JSONBigStoreAsString.parse(data);
      }
      return data;
    },
  ],
  transformRequest: [
    (data, headers) => {
      if (isFormData(data) || isArrayBuffer(data) || isFile(data) || isBlob(data)) {
        return data;
      }

      if (isArrayBufferView(data)) {
        return data.buffer;
      }
      if (isURLSearchParams(data)) {
        setContentTypeIfUnset(headers, 'application/x-www-form-urlencoded;charset=utf-8');
        return data.toString();
      }
      if (isObject(data)) {
        setContentTypeIfUnset(headers, 'application/json;charset=utf-8');
        return JSONBig.stringify(data);
      }
      return data;
    },
  ],
});

UserApiClient.interceptors.request.use(
  async (config) => {
    config.headers.set('App-Type', APP_TYPE_GAO_DOMAINS);
    config.headers.set('Device-ID', getDeviceID());

    // Check if we're in a browser environment
    if (typeof window !== 'undefined') {
      const token = useAuthStore.getState().accessToken;
      if (token) {
        config.headers.set('Authorization', `Bearer ${token}`);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string | null) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

UserApiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle network error - don't clear token, show network error message
    // if (isNetworkError(error)) {
    //   toast.error('No internet connection. Please check your network.');
    //   return Promise.reject(error);
    // }

    // Handle 401 - try to refresh token first
    if (isAxiosError(error) && error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.set('Authorization', `Bearer ${token}`);
            return UserApiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = useAuthStore.getState().refreshToken;
      if (!refreshToken) {
        isRefreshing = false;
        useAuthStore.getState().logout();
        window.location.href = '/';
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(
          `${AUTH_API_URL}/api/v1/auth/refresh-token`,
          {},
          {
            headers: {
              'Refresh-Token': refreshToken,
              'Device-ID': getDeviceID(),
              'App-Type': APP_TYPE_GAO_DOMAINS,
            },
          },
        );

        const { access_token, refresh_token } = response.data.data;
        useAuthStore.getState().setTokens(access_token, refresh_token);

        processQueue(null, access_token);

        originalRequest.headers.set('Authorization', `Bearer ${access_token}`);
        return UserApiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        // Don't clear token on network error
        if (isNetworkError(refreshError)) {
          toast.error('No internet connection. Please check your network.');
          return Promise.reject(refreshError);
        }
        useAuthStore.getState().logout();
        window.location.href = '/';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Extract error message from response for non-401 errors
    if (isAxiosError(error) && error.response?.data) {
      const data = error.response.data as { error?: { message?: string }; message?: string };
      const errorMessage = data.error?.message || data.message;
      if (errorMessage) {
        const customError = new Error(errorMessage);
        (customError as Error & { originalError: unknown }).originalError = error;
        return Promise.reject(customError);
      }
    }

    return Promise.reject(error);
  },
);

export type AxiosConfigWrapper<
  Path extends schemaHelper.UrlPaths,
  Method extends schemaHelper.HttpMethods,
> = {
  url: Path;
  method: Method & schemaHelper.HttpMethodsFilteredByPath<Path>;
  params?: schemaHelper.RequestParameters<Path, Method>;
  data?: schemaHelper.RequestData<Path, Method>;
  headers?: AxiosRequestHeaders;
  urlParams?: { key: string; value: number | string }[];
  paramsSerializer?: unknown;
};

export function apiRequest<
  Path extends schemaHelper.UrlPaths,
  Method extends schemaHelper.HttpMethods,
>(config: AxiosConfigWrapper<Path, Method>) {
  if (config.urlParams) {
    const { urlParams } = config;
    let { url } = config;
    for (let i = 0; urlParams.length > i; i += 1) {
      url = (url as string).replace(
        `{${urlParams[i].key}}`,
        String(urlParams[i].value),
      ) as unknown as Path;
    }
    config.url = url;
  }

  const request = UserApiClient.request<
    schemaHelper.ResponseData<Path, Method>,
    AxiosResponse<schemaHelper.ResponseData<Path, Method>>,
    AxiosConfigWrapper<Path, Method>['data']
  >(config as unknown as AxiosRequestConfig<AxiosConfigWrapper<Path, Method>['data']>);

  return request;
}

export async function apiRequestAwait<
  Path extends schemaHelper.UrlPaths,
  Method extends schemaHelper.HttpMethods,
>(config: AxiosConfigWrapper<Path, Method>) {
  const request = apiRequest(config);
  try {
    const { data } = await request;
    return {
      data,
      error: null,
    };
  } catch (error) {
    if (isAxiosError(error)) {
      return {
        data: null,
        error,
      };
    }
    throw error;
  }
}