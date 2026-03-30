import axios, {
  isAxiosError,
  type AxiosRequestConfig,
  type AxiosRequestHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import JSONBig from 'json-bigint';
import { toast } from 'sonner';

import {
  deleteAccessTokenFromLocal,
  deleteRefreshTokenFromLocal,
  getAccessTokenFromLocal,
  getDeviceID,
  getRefreshTokenFromLocal,
  setAccessTokenToLocal,
  setRefreshTokenToLocal,
} from '@/lib/clients/storage.helper';
import {
  isArrayBuffer,
  isArrayBufferView,
  isBlob,
  isBuffer,
  isFile,
  isFormData,
  isObject,
  isStream,
  isUndefined,
  isURLSearchParams,
} from '@/lib/utils/api-client';

// Check if error is a network error (no response from server)
const isNetworkError = (error: unknown): boolean => {
  if (!isAxiosError(error)) return true;
  // Network error: no response and error code indicates network issue
  return (
    !error.response &&
    (error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNABORTED' ||
      error.code === 'ETIMEDOUT' ||
      error.message === 'Network Error')
  );
};

import type * as schemaHelper from './schemaHelper';
import { AUTH_API_URL, PAYII_API_URL } from '@/types/constants';

const JSONBigStoreAsString = JSONBig({ storeAsString: true });

const setContentTypeIfUnset = (headers: AxiosRequestHeaders | undefined, value: string) => {
  if (typeof headers !== 'undefined' && isUndefined(headers['Content-Type'])) {
    headers['Content-Type'] = value;
  }
};

export const PayiiApiClient = axios.create({
  baseURL: PAYII_API_URL,
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
      if (
        isFormData(data) ||
        isArrayBuffer(data) ||
        isBuffer(data) ||
        isStream(data) ||
        isFile(data) ||
        isBlob(data)
      ) {
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
      // Default Content-Type for requests without data (GET, DELETE, etc.)
      setContentTypeIfUnset(headers, 'application/json;charset=utf-8');
      return data;
    },
  ],
});

PayiiApiClient.interceptors.request.use(
  async (config) => {
    config.headers.set('App-Type', 'payii-o2o');
    config.headers.set('Device-ID', getDeviceID());

    // Check if we're in a browser environment
    if (typeof window !== 'undefined') {
      // check with bearer token
      const token = getAccessTokenFromLocal();
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

PayiiApiClient.interceptors.response.use(
  (response) => {
    // Check if response code is not "000" - treat as error
    const data = response.data as { code?: string; message?: string } | undefined;
    if (data && typeof data.code === 'string' && data.code !== '000') {
      // Create axios-like error to trigger error handler
      const error = new axios.AxiosError(
        data.message || 'Request failed',
        data.code,
        response.config,
        response.request,
        response,
      );
      return Promise.reject(error);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle network error - don't clear token, show network error message
    // if (isNetworkError(error)) {
    //   toast.error('No internet connection. Please check your network.');
    //   return Promise.reject(error);
    // }

    // Check if this might be a 401 error disguised as network error (CORS issue)
    const isLikely401NetworkError =
      isNetworkError(error) && originalRequest?.headers?.Authorization && !originalRequest._retry;

    // Handle 401 - try to refresh token first
    if (
      (isAxiosError(error) && error.response?.status === 401 && !originalRequest._retry) ||
      isLikely401NetworkError
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.set('Authorization', `Bearer ${token}`);
            return PayiiApiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = getRefreshTokenFromLocal();
      if (!refreshToken) {
        isRefreshing = false;
        deleteAccessTokenFromLocal();
        deleteRefreshTokenFromLocal();
        window.location.href = '/login';
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
              'App-Type': 'payii-o2o',
            },
          },
        );

        const { access_token, refresh_token } = response.data.data;
        setAccessTokenToLocal(access_token);
        setRefreshTokenToLocal(refresh_token);

        processQueue(null, access_token);

        originalRequest.headers.set('Authorization', `Bearer ${access_token}`);
        return PayiiApiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        // Don't clear token on network error
        if (isNetworkError(refreshError)) {
          toast.error('No internet connection. Please check your network.');
          return Promise.reject(refreshError);
        }
        deleteAccessTokenFromLocal();
        deleteRefreshTokenFromLocal();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Check response code !== "000" for non-401 errors
    if (isAxiosError(error) && error.response?.data) {
      const data = error.response.data as { code?: string; message?: string };
      if (data.code && data.code !== '000') {
        const customError = new Error(data.message || 'Request failed');
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

  const request = PayiiApiClient.request<
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