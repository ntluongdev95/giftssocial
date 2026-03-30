export const isFormData = (val: unknown): val is FormData =>
  typeof FormData !== 'undefined' && val instanceof FormData;
export const isArrayBuffer = (val: unknown): val is ArrayBuffer => val instanceof ArrayBuffer;
export const isBlob = (val: unknown): val is Blob =>
  typeof Blob !== 'undefined' && val instanceof Blob;
export const isFile = (val: unknown): val is File =>
  typeof File !== 'undefined' && val instanceof File;
export const isURLSearchParams = (val: unknown): val is URLSearchParams =>
  typeof URLSearchParams !== 'undefined' && val instanceof URLSearchParams;
export const isArrayBufferView = (val: unknown): val is ArrayBufferView =>
  ArrayBuffer.isView(val) && !(val instanceof DataView);
export const isObject = (val: unknown): val is object => val !== null && typeof val === 'object';
export const isUndefined = (val: unknown): val is undefined => typeof val === 'undefined';
export const isBuffer = (val: unknown): val is Buffer =>
  typeof Buffer !== 'undefined' && val instanceof Buffer;
export const isStream = (val: unknown): val is NodeJS.ReadableStream =>
  typeof val === 'object' && val !== null && 'read' in val;