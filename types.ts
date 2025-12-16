
export enum PlanTier {
  BASIC = 'BASIC',
  PRO = 'PRO',
  ELITE = 'ELITE',
  NONE = 'NONE' // Pay per use
}

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN'
}

export interface Transaction {
  id: string;
  date: number;
  amount: number;
  description: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  paymentMethod: string; // e.g., "Visa ending in 4242"
}

export interface Payout {
  id: string;
  date: number;
  amount: number;
  method: 'PAYPAL' | 'BANK_TRANSFER';
  destination: string; // Email or Account Number
  status: 'PROCESSED' | 'PENDING';
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  plan: PlanTier;
  credits: number;
  isAuthenticated: boolean;
  hasUsedFreeGen: boolean; // Tracks if the one-time free preview is used
  joinedAt: number;
  isActive: boolean; // For admin deactivation
  isEmailVerified: boolean; // Email verification status
  verificationCode?: string; // For mock verification logic
  transactions: Transaction[];
}

export interface ImageRecord {
  id: string;
  userId: string; // Link image to user
  originalImageBase64: string;
  generatedImageBase64: string | null; // Null if pending
  prompt: string;
  timestamp: number;
  isUnlocked: boolean; // True if paid/credit used
  isFreePreview: boolean; // True if generated via free trial
}

export interface PricingPlan {
  id: PlanTier;
  name: string;
  price: number;
  credits: number;
  features: string[];
  isSubscription: boolean;
  paymentLink: string; // The Stripe URL
}

export interface SupportTicket {
  id: string;
  userId: string | null; // Null if guest
  firstName: string;
  lastName: string;
  email: string;
  tier: PlanTier | 'GUEST';
  message: string;
  status: 'NEW' | 'IN_PROGRESS' | 'RESOLVED';
  timestamp: number;
  adminReplies: string[];
}

// INSTRUCTIONS FOR STRIPE CONFIGURATION:
// 1. Create Payment Links in your Stripe Dashboard for each plan below.
// 2. Paste the generated URL (starting with 'https://buy.stripe.com/...') into the 'paymentLink' fields below.
// 3. CRITICAL: In the Stripe Dashboard, for EACH payment link:
//    - Go to "After payment" settings.
//    - Select "Redirect customers to your website".
//    - Enter this URL: https://www.upscaleimageryai.com/#/payment-success
//    - This ensures users are returned to the app to unlock their credits/features.

export const PLANS: PricingPlan[] = [
  {
    id: PlanTier.NONE,
    name: 'One-Time',
    price: 3.99,
    credits: 5, // 5 variations
    features: ['1 Upload', '5 Prompt Variations', 'High Res Download'],
    isSubscription: false,
    paymentLink: 'https://buy.stripe.com/8x28wIc9d1o8bkQagf9oc00' 
  },
  {
    id: PlanTier.BASIC,
    name: 'Basic',
    price: 9.99,
    credits: 25,
    features: ['25 Edit Credits/mo', 'Priority Support'], // No rollover
    isSubscription: true,
    paymentLink: 'https://buy.stripe.com/cNi14gddhc2M4Ws3RR9oc01'
  },
  {
    id: PlanTier.PRO,
    name: 'Pro',
    price: 19.99,
    credits: 50,
    features: ['50 Edit Credits/mo', 'Roll-over credits', 'Faster Processing'],
    isSubscription: true,
    paymentLink: 'https://buy.stripe.com/4gM00c0qvd6QdsY0FF9oc02'
  },
  {
    id: PlanTier.ELITE,
    name: 'Elite',
    price: 34.99,
    credits: 100,
    features: ['100 Edit Credits/mo', 'Roll-over credits', 'Commercial License'],
    isSubscription: true,
    paymentLink: 'https://buy.stripe.com/eVq28k0qv7Mwex23RR9oc03'
  }
];
