export const ENV = process.env.NEXT_PUBLIC_ENV;

// Stablecoin name based on environment
export const STABLECOIN_PAY_SYMBOL = ENV !== 'development' ? 'PAY' : 'SBC';
export const STABLECOIN_PAY_NAME = ENV !== 'development' ? 'PAYUSD' : 'SBC';
export const STABLECOIN_USDC_SYMBOL = 'USDC';

export const NETWORK_BASE_SYMBOL = ENV !== 'development' ? 'base' : 'base_sepolia';

export const APP_TYPE_GAO_DOMAINS = 'gao-domains';

// export const AUTH_API_URL = process.env.NEXT_PUBLIC_AUTH_API_URL;
export const AUTH_API_URL = 'https://api-dev.toii.social/auth';
export const PAYII_API_URL = process.env.NEXT_PUBLIC_PAYII_API_URL;
//Domains
export const DOMAINS_API_URL = process.env.NEXT_PUBLIC_DOMAIN_API_URL;
// export const USER_API_URL = process.env.NEXT_PUBLIC_USER_API_URL;
export const USER_API_URL = 'https://api-dev.toii.social/user';
export const NOTI_API_URL = process.env.NEXT_PUBLIC_NOTI_API_URL;

export const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

export const USE_MOCK_API = process.env.NEXT_PUBLIC_USE_MOCK_API === 'true' || false;

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

export const KYC_ENABLED = process.env.NEXT_PUBLIC_KYC_ENABLED === 'true' || false;

export const KYB_ENABLED = process.env.NEXT_PUBLIC_KYB_ENABLED === 'true' || false;

export const IS_DEV = ENV === 'development';

// GAO internal merchant ID — used for domain registration checkout
export const GAO_MERCHANT_ID =
  process.env.NEXT_PUBLIC_GAO_MERCHANT_ID || '11111111-1111-1111-1111-111111111111';

// Firebase Cloud Messaging (FCM)
export const FIREBASE_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
};

export const FIREBASE_VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || '';

// US States for address forms
export const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
  { value: 'DC', label: 'District of Columbia' },
];

export const EXPLORER_NETWORK_URL = {
  base: 'https://basescan.org',
  base_sepolia: 'https://sepolia.basescan.org',
  ethereum: 'https://etherscan.io',
  sepolia: 'https://sepolia.etherscan.io',
  polygon: 'https://polygonscan.com',
  solana: 'https://solana.fm',
  arbitrum: 'https://arbiscan.io',
};

export const getExplorerTxUrl = (txHash?: string, chain?: string): string | null => {
  if (!txHash || !chain) return null;

  const chainLower = chain.toLowerCase();
  const baseUrl = EXPLORER_NETWORK_URL[chainLower as keyof typeof EXPLORER_NETWORK_URL];

  if (!baseUrl) return null;

  // Different chains use different URL patterns
  if (chainLower === 'solana') {
    return `${baseUrl}/tx/${txHash}`;
  }

  return `${baseUrl}/tx/${txHash}`;
};

export const SYSTEM_FEE = {
  mint: {
    wire: 0,
    ach: 0,
    crypto: 0,
  },
  redeem: {
    wire: 0,
    ach: 0,
    crypto: 0,
  },
  swap: 0,
  send: 0,
};
export const TOKENS = {
  USDC: {
    address: '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    decimals: 6,
  },
  USDT: {
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    decimals: 6,
  },
} as const;