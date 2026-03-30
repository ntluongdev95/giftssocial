import { savePasskeyUser } from '../clients/storage.helper';

// WebAuthn configuration
const RP_NAME = 'GAO Social';
const RP_ID = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

// Check if WebAuthn is supported
export const isWebAuthnSupported = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    window.PublicKeyCredential !== undefined &&
    typeof window.PublicKeyCredential === 'function'
  );
};

// Check if error is a user cancel action (NotAllowedError)
export const isPasskeyCancelError = (error: unknown): boolean => {
  if (error instanceof Error) {
    // NotAllowedError: user cancelled or denied the request
    // AbortError: operation was aborted
    return error.name === 'NotAllowedError' || error.name === 'AbortError';
  }
  return false;
};

// Generate challenge from nonce
const generateChallenge = (nonce: string): ArrayBuffer => {
  const encoder = new TextEncoder();
  return encoder.encode(nonce).buffer as ArrayBuffer;
};

// Convert ArrayBuffer to Base64URL string
const arrayBufferToBase64URL = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

// LargeBlob result type
export interface LargeBlobResult {
  supported: boolean;
  written?: boolean;
  blob?: string;
}

// Create passkey credential for registration with largeBlob support
export const createPasskeyCredential = async (
  nonce: string,
  userId: string,
  username: string,
  enableLargeBlob = false,
) => {
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn is not supported in this browser');
  }

  const challenge = generateChallenge(nonce);

  // Build extensions object
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extensions: Record<string, any> = {};
  if (enableLargeBlob) {
    extensions.largeBlob = { support: 'preferred' };
  }

  const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
    challenge,
    rp: {
      name: RP_NAME,
      id: RP_ID,
    },
    user: {
      id: new TextEncoder().encode(userId),
      name: username,
      displayName: username,
    },
    pubKeyCredParams: [
      { alg: -7, type: 'public-key' }, // ES256
      { alg: -257, type: 'public-key' }, // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'required',
      residentKey: 'required', // Required for largeBlob
    },
    timeout: 60000,
    attestation: 'none',
    extensions: enableLargeBlob ? extensions : undefined,
  };

  const credential = (await navigator.credentials.create({
    publicKey: publicKeyCredentialCreationOptions,
  })) as PublicKeyCredential;

  if (!credential) {
    throw new Error('Failed to create passkey credential');
  }

  const response = credential.response as AuthenticatorAttestationResponse;

  // Check largeBlob support
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extResults = credential.getClientExtensionResults() as any;
  const largeBlobSupported = extResults?.largeBlob?.supported ?? false;

  const rawId = arrayBufferToBase64URL(credential.rawId);

  // Save passkey user to localStorage
  savePasskeyUser({
    credentialId: credential.id,
    rawId,
    userId,
    username,
    passkeyUsername: username, // original username when passkey created
    largeBlobSupported,
  });

  return {
    id: credential.id,
    rawId,
    type: credential.type,
    userId, // Return userId for reference
    response: {
      attestationObject: arrayBufferToBase64URL(response.attestationObject),
      clientDataJSON: arrayBufferToBase64URL(response.clientDataJSON),
    },
    largeBlobSupported,
  };
};

// Convert base64url to ArrayBuffer
const base64URLToArrayBuffer = (base64url: string): ArrayBuffer => {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + '='.repeat(padLen);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
};

// Get passkey credential for login (with optional largeBlob read)
export const getPasskeyCredential = async (
  nonce: string,
  credentialId?: string,
  readLargeBlobData = false,
) => {
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn is not supported in this browser');
  }

  const challenge = generateChallenge(nonce);

  // Build extensions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extensions: Record<string, any> = {};
  if (readLargeBlobData) {
    extensions.largeBlob = { read: true };
  }

  const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
    challenge,
    rpId: RP_ID,
    timeout: 60000,
    userVerification: 'required',
    allowCredentials: credentialId
      ? [
          {
            id: base64URLToArrayBuffer(credentialId),
            type: 'public-key',
          },
        ]
      : [],
    extensions: readLargeBlobData ? extensions : undefined,
  };

  const credential = (await navigator.credentials.get({
    publicKey: publicKeyCredentialRequestOptions,
  })) as PublicKeyCredential;

  if (!credential) {
    throw new Error('Failed to get passkey credential');
  }

  const response = credential.response as AuthenticatorAssertionResponse;

  // Get userId from userHandle
  const userId = response.userHandle ? new TextDecoder().decode(response.userHandle) : undefined;

  // Get largeBlob data if requested
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extResults = credential.getClientExtensionResults() as any;
  const largeBlobData = extResults?.largeBlob?.blob
    ? new TextDecoder().decode(extResults.largeBlob.blob)
    : undefined;

  return {
    id: credential.id,
    rawId: arrayBufferToBase64URL(credential.rawId),
    type: credential.type,
    userId, // userId from userHandle - UUID saved during creation
    largeBlobData, // Encrypted wallet key if available
    response: {
      authenticatorData: arrayBufferToBase64URL(response.authenticatorData),
      clientDataJSON: arrayBufferToBase64URL(response.clientDataJSON),
      signature: arrayBufferToBase64URL(response.signature),
      userHandle: response.userHandle ? arrayBufferToBase64URL(response.userHandle) : undefined,
    },
  };
};

// Write data to largeBlob (requires credentialId - must be single credential)
export const writeLargeBlob = async (
  nonce: string,
  credentialId: string,
  data: string,
): Promise<LargeBlobResult> => {
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn is not supported in this browser');
  }

  const challenge = generateChallenge(nonce);
  const dataBytes = new TextEncoder().encode(data);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extensions: Record<string, any> = {
    largeBlob: { write: dataBytes },
  };

  const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
    challenge,
    rpId: RP_ID,
    timeout: 60000,
    userVerification: 'required',
    // largeBlob write requires exactly one credential in allowCredentials
    allowCredentials: [
      {
        id: base64URLToArrayBuffer(credentialId),
        type: 'public-key',
      },
    ],
    extensions,
  };

  const credential = (await navigator.credentials.get({
    publicKey: publicKeyCredentialRequestOptions,
  })) as PublicKeyCredential;

  if (!credential) {
    throw new Error('Failed to get passkey credential for largeBlob write');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extResults = credential.getClientExtensionResults() as any;

  return {
    supported: true,
    written: extResults?.largeBlob?.written ?? false,
  };
};

// Read data from largeBlob (can use credentialId for specific passkey, or empty for picker)
export const readLargeBlob = async (
  nonce: string,
  credentialId?: string,
): Promise<LargeBlobResult & { userId?: string }> => {
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn is not supported in this browser');
  }

  const challenge = generateChallenge(nonce);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extensions: Record<string, any> = {
    largeBlob: { read: true },
  };

  const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
    challenge,
    rpId: RP_ID,
    timeout: 60000,
    userVerification: 'required',
    allowCredentials: credentialId
      ? [
          {
            id: base64URLToArrayBuffer(credentialId),
            type: 'public-key',
          },
        ]
      : [],
    extensions,
  };

  const credential = (await navigator.credentials.get({
    publicKey: publicKeyCredentialRequestOptions,
  })) as PublicKeyCredential;

  if (!credential) {
    throw new Error('Failed to get passkey credential for largeBlob read');
  }

  const response = credential.response as AuthenticatorAssertionResponse;

  // Get userId from userHandle
  const userId = response.userHandle ? new TextDecoder().decode(response.userHandle) : undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extResults = credential.getClientExtensionResults() as any;
  const blobData = extResults?.largeBlob?.blob;

  return {
    supported: true,
    blob: blobData ? new TextDecoder().decode(blobData) : undefined,
    userId,
  };
};