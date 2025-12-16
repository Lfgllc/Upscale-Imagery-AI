import { User, PlanTier, ImageRecord, PLANS, UserRole, SupportTicket, Transaction, Payout } from '../types';
import { supabase } from './supabaseClient';

// Keys for Local Caching (Performance/Sync access)
const USER_KEY = 'upscale_user';
const IMAGES_KEY = 'upscale_images';
const PENDING_TXN_KEY = 'upscale_pending_transaction';

const INITIAL_USER: User = {
  id: 'guest',
  name: 'Guest',
  email: '',
  role: UserRole.USER,
  plan: PlanTier.NONE,
  credits: 0,
  isAuthenticated: false,
  hasUsedFreeGen: false,
  joinedAt: Date.now(),
  isActive: true,
  isEmailVerified: false,
  transactions: []
};

// --- SUPABASE MAPPING HELPERS ---
const mapProfileToUser = (profile: any, email?: string): User => ({
  id: profile.id,
  name: profile.full_name || 'User',
  email: profile.email || email || '',
  role: (profile.role as UserRole) || UserRole.USER,
  plan: (profile.plan as PlanTier) || PlanTier.NONE,
  credits: profile.credits || 0,
  isAuthenticated: true,
  hasUsedFreeGen: false, // In real app, calculate this from images count
  joinedAt: profile.joined_at || Date.now(),
  isActive: profile.is_active ?? true,
  isEmailVerified: true, // Supabase handles this
  transactions: []
});

export const StorageService = {
  // --- SYNCHRONOUS READS (From Cache) ---
  getUser: (): User => {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : INITIAL_USER;
  },

  getImages: (): ImageRecord[] => {
    const stored = localStorage.getItem(IMAGES_KEY);
    return stored ? JSON.parse(stored) : [];
  },

  // --- ASYNC ACTIONS (Supabase) ---
  
  // 1. Sync User State
  syncUser: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
        // Fetch profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
        
        if (profile) {
            const user = mapProfileToUser(profile, session.user.email);
            localStorage.setItem(USER_KEY, JSON.stringify(user));
            return user;
        }
    } else {
        localStorage.removeItem(USER_KEY);
    }
    return INITIAL_USER;
  },

  // 2. Fetch Images
  fetchImages: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    const { data, error } = await supabase
        .from('images')
        .select('*')
        .order('timestamp', { ascending: false });

    if (data) {
        const mappedImages: ImageRecord[] = data.map((img: any) => ({
            id: img.id,
            userId: img.user_id,
            originalImageBase64: img.original_image_base64,
            generatedImageBase64: img.generated_image_base64,
            prompt: img.prompt,
            timestamp: img.timestamp,
            isUnlocked: img.is_unlocked,
            isFreePreview: img.is_free_preview
        }));
        localStorage.setItem(IMAGES_KEY, JSON.stringify(mappedImages));
        return mappedImages;
    }
    return [];
  },

  signup: async (email: string, name: string): Promise<boolean> => {
    const { data, error } = await supabase.auth.signUp({
        email,
        password: 'temporaryPassword123!', 
        options: {
            data: { full_name: name }
        }
    });

    if (error) throw new Error(error.message);
    return true;
  },

  login: async (email: string): Promise<User> => {
    return await StorageService.syncUser();
  },

  logout: async () => {
    await supabase.auth.signOut();
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(IMAGES_KEY);
  },

  saveImage: async (image: ImageRecord): Promise<ImageRecord> => {
    const user = StorageService.getUser();
    
    // If user is authenticated, save to DB first to get the real UUID
    if (user.isAuthenticated) {
        const { data, error } = await supabase.from('images').insert({
            user_id: user.id,
            original_image_base64: image.originalImageBase64,
            generated_image_base64: image.generatedImageBase64,
            prompt: image.prompt,
            timestamp: image.timestamp,
            is_unlocked: image.isUnlocked,
            is_free_preview: image.isFreePreview
        }).select().single();

        if (data) {
            // Use the real ID from database
            const savedImage = { ...image, id: data.id };
            
            // Update Local Cache with the Real ID
            const stored = localStorage.getItem(IMAGES_KEY);
            const allImages: ImageRecord[] = stored ? JSON.parse(stored) : [];
            const updated = [savedImage, ...allImages];
            localStorage.setItem(IMAGES_KEY, JSON.stringify(updated));
            
            return savedImage;
        }
    }
    
    // Fallback for guest or offline (uses temporary timestamp ID)
    const stored = localStorage.getItem(IMAGES_KEY);
    const allImages: ImageRecord[] = stored ? JSON.parse(stored) : [];
    const updated = [image, ...allImages];
    localStorage.setItem(IMAGES_KEY, JSON.stringify(updated));
    return image;
  },

  updateImage: async (imageId: string, updates: Partial<ImageRecord>) => {
     // 1. Cache update
    const stored = localStorage.getItem(IMAGES_KEY);
    let allImages: ImageRecord[] = [];
    if (stored) {
        allImages = JSON.parse(stored);
        const index = allImages.findIndex(img => img.id === imageId);
        if (index !== -1) {
            allImages[index] = { ...allImages[index], ...updates };
            localStorage.setItem(IMAGES_KEY, JSON.stringify(allImages));
        }
    }

    // 2. DB Update
    // Only attempt DB update if we are logged in and it looks like a valid UUID (length > 20)
    // Supabase IDs are 36 chars. Timestamp IDs are ~13 chars.
    const user = StorageService.getUser();
    if (user.isAuthenticated && imageId.length > 20) {
        const dbUpdates: any = {};
        // Note: Credits are now ONLY updated via Server. Images can still be updated (unlocked) if logic permits.
        if (updates.isUnlocked !== undefined) dbUpdates.is_unlocked = updates.isUnlocked;
        
        if (Object.keys(dbUpdates).length > 0) {
            await supabase.from('images').update(dbUpdates).eq('id', imageId);
        }
    }
  },
  
  deleteImage: async (imageId: string) => {
      // Cache
      const stored = localStorage.getItem(IMAGES_KEY);
      if (!stored) return;
      const allImages: ImageRecord[] = JSON.parse(stored);
      const filtered = allImages.filter(img => img.id !== imageId);
      localStorage.setItem(IMAGES_KEY, JSON.stringify(filtered));

      // DB
      if (imageId.length > 20) {
        await supabase.from('images').delete().eq('id', imageId);
      }
  },

  // --- STRIPE / PAYMENT HELPERS ---
  setPendingTransaction: (planId: PlanTier, imageId?: string) => {
      const pending = { planId, imageId, timestamp: Date.now() };
      localStorage.setItem(PENDING_TXN_KEY, JSON.stringify(pending));
  },

  getPendingTransaction: () => {
      const stored = localStorage.getItem(PENDING_TXN_KEY);
      return stored ? JSON.parse(stored) : null;
  },

  clearPendingTransaction: () => {
      localStorage.removeItem(PENDING_TXN_KEY);
  },

  // NOTE: finalizePurchase has been removed. 
  // Payment verification is now handled by the backend /api/verify-checkout endpoint.
  
  // --- MOCK / UNUSED METHODS (Kept to prevent TS errors in other files) ---
  deductCredit: async () => false, // Deprecated: Server handles this now
  saveUser: (user: User) => localStorage.setItem(USER_KEY, JSON.stringify(user)),
  getAllUsers: () => [] as User[], 
  updateGlobalUserList: () => {},

  // Stubbed for Admin Dashboard - In real production these should call secure backend endpoints
  toggleUserStatus: (userId: string, isActive: boolean) => {
      console.log(`[Storage] Toggling status for ${userId} to ${isActive}`);
  },

  // Stubbed for Admin Dashboard - In real production these should call secure backend endpoints
  adjustUserCredits: (userId: string, credits: number) => {
      console.log(`[Storage] Adjusting credits for ${userId} to ${credits}`);
  },

  verifyEmail: () => StorageService.getUser(), 
  resendVerification: async () => {}, 
  processPayment: async () => ({ id: '1', date: Date.now(), amount: 0, description: '', status: 'SUCCESS', paymentMethod: '' }),
  cancelSubscription: () => StorageService.getUser(),
  
  recordFreeUsage: () => {
      const user = StorageService.getUser();
      const updated = { ...user, hasUsedFreeGen: true };
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      return updated;
  },

  logEvent: (event: any) => {
      console.log('Event Logged:', event);
  },

  getAnalytics: () => [],
  
  createTicket: (ticket: Partial<SupportTicket>) => ({ 
      id: '1', 
      timestamp: Date.now(), 
      status: 'NEW', 
      adminReplies: [], 
      message: '', 
      email: '', 
      firstName: '', 
      lastName: '', 
      userId: '', 
      tier: 'GUEST',
      ...ticket 
  } as SupportTicket),

  getTickets: () => [] as SupportTicket[],

  updateTicket: (ticketId: string, updates: Partial<SupportTicket>) => {
      console.log(`Updated ticket ${ticketId}`, updates);
  },

  getPayouts: () => [] as Payout[],

  processPayout: (amount: number, method: string, destination: string) => ({ 
      id: '1', 
      date: Date.now(), 
      amount, 
      method: method as any, 
      destination, 
      status: 'PROCESSED' as const 
  }),

  getMetrics: () => ({ 
      totalUsers: 0, newUsersToday: 0, activeSubs: { BASIC: 0, PRO: 0, ELITE: 0 }, 
      mrr: 0, totalRevenue: 0, oneTimeRevenue: 0, oneTimeSalesCount: 0, conversionRate: 0, 
      totalGenerations: 0, failedGenerations: 0, freeGenerations: 0, ticketsNew: 0, 
      totalWithdrawn: 0, availableBalance: 0 
  })
};