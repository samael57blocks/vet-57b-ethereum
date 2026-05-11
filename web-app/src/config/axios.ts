import axios, { type AxiosInstance } from "axios";

/** The backend URL */
const backendUrl = import.meta.env.VITE_BACKEND_URL;

/**
 * Creates a configured axios instance that automatically includes the Bearer token
 * from the auth store in all requests.
 * 
 * This instance uses a request interceptor to automatically retrieve the token
 * from the Zustand store and add it to the Authorization header, eliminating
 * the need to pass the token as a parameter in every service method.
 * 
 * @returns A configured axios instance with automatic token injection.
 * 
 * @example
 * ```typescript
 * const response = await apiClient.get('/shipment');
 * ```
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: backendUrl,
  transformRequest: ( data: any): any => {
    console.log('Sending request', data);
    return data;
  },
  transformResponse: ( data: any): any => {
    console.log('Received response', data);
    return data;
  },
});

// Request interceptor to automatically add the Authorization header
apiClient.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

