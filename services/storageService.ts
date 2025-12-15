import { User, PlanTier, ImageRecord, PLANS, UserRole, SupportTicket, Transaction, Payout } from '../types';

// Mock DB keys
const USER_KEY = 'upscale_user';
const ALL_USERS_KEY = 'upscale_all_users';
const IMAGES_KEY = 'upscale_images';
const SUPPORT_KEY = 'upscale_support_tickets';
const ANALYTICS_KEY = 'upscale_analytics';
const PAYOUTS_KEY = 'upscale_payouts';
const PENDING_TXN_KEY = 'upscale_pending_transaction';

// CONFIG: Set this to true when backend server (server.js) is running
const USE_REAL_BACKEND = false; 
const BACKEND_URL = 'http://localhost:3001/api';

// Initial Mock User
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

interface AnalyticsEvent {
  type: 'GENERATION_SUCCESS' | 'GENERATION_FAILURE' | 'CONVERSION' | 'FREE_USAGE' | 'PAYMENT_FAILURE' | 'SUBSCRIPTION_CHANGE' | 'SUBSCRIPTION_CANCEL';
  timestamp: number;
  details?: string;
}

interface PendingTransaction {
    planId: PlanTier;
    imageId?: string; // Optional: Only for one-time unlocks
    timestamp: number;
}

interface PaymentDetails {
  cardNumber: string;
  expiry: string;
  cvc: string;
  name: string;
  email: string;
}

export const StorageService = {
  getUser: (): User => {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : INITIAL_USER;
  },

  saveUser: (user: User) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    StorageService.updateGlobalUserList(user);
  },

  updateGlobalUserList: (user: User) => {
    const allUsers = StorageService.getAllUsers();
    const index = allUsers.findIndex(u => u.email === user.email);
    if (index >= 0) {
      allUsers[index] = user;
    } else {
      if (user.id !== 'guest') {
        allUsers.push(user);
      }
    }
    localStorage.setItem(ALL_USERS_KEY, JSON.stringify(allUsers));
  },

  getAllUsers: (): User[] => {
    const stored = localStorage.getItem(ALL_USERS_KEY);
    return stored ? JSON.parse(stored) : [];
  },

  toggleUserStatus: (userId: string, isActive: boolean) => {
    const allUsers = StorageService.getAllUsers();
    const index = allUsers.findIndex(u => u.id === userId);
    if (index >= 0) {
      allUsers[index].isActive = isActive;
      localStorage.setItem(ALL_USERS_KEY, JSON.stringify(allUsers));
      
      const currentUser = StorageService.getUser();
      if (currentUser.id === userId) {
        localStorage.setItem(USER_KEY, JSON.stringify(allUsers[index]));
      }
      console.log(`[ADMIN ACTION] User ${userId} status changed to ${isActive}`);
    }
  },

  adjustUserCredits: (userId: string, newCredits: number) => {
    const allUsers = StorageService.getAllUsers();
    const index = allUsers.findIndex(u => u.id === userId);
    if (index >= 0) {
      allUsers[index].credits = newCredits;
      localStorage.setItem(ALL_USERS_KEY, JSON.stringify(allUsers));
      
      const currentUser = StorageService.getUser();
      if (currentUser.id === userId) {
        localStorage.setItem(USER_KEY, JSON.stringify(allUsers[index]));
      }
      console.log(`[ADMIN ACTION] User ${userId} credits adjusted to ${newCredits}`);
    }
  },

  signup: (email: string, name: string): boolean => {
    const allUsers = StorageService.getAllUsers();
    const existingUser = allUsers.find(u => u.email === email);
    
    if (existingUser) {
      throw new Error("Account already exists. Please log in.");
    }

    // Demo Admin Account Logic
    const role = email === 'admin@upscale.ai' ? UserRole.ADMIN : UserRole.USER;
    const verificationCode = '123456'; 

    const newUser: User = {
      id: `user_${Date.now()}`,
      name: name || email.split('@')[0],
      email,
      role,
      plan: PlanTier.NONE,
      credits: role === UserRole.ADMIN ? 999999 : 0, // Admin gets unlimited credits
      isAuthenticated: false,
      hasUsedFreeGen: false,
      joinedAt: Date.now(),
      isActive: true,
      isEmailVerified: false,
      verificationCode: verificationCode,
      transactions: []
    };

    StorageService.updateGlobalUserList(newUser);
    console.log(`%c[EMAIL SERVICE] Verification code for ${email}: ${verificationCode}`, "color: #c19a6b; font-weight: bold; font-size: 14px;");
    
    return true;
  },

  verifyEmail: (email: string, code: string): User => {
    const allUsers = StorageService.getAllUsers();
    const user = allUsers.find(u => u.email === email);

    if (!user) throw new Error("User not found.");
    if (user.verificationCode !== code) throw new Error("Invalid verification code.");

    user.isEmailVerified = true;
    user.isAuthenticated = true;
    
    StorageService.updateGlobalUserList(user);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    
    console.log(`[EMAIL SENT] Welcome to Upscale Imagery AI, ${user.email}!`);
    return user;
  },

  resendVerification: (email: string) => {
    const allUsers = StorageService.getAllUsers();
    const user = allUsers.find(u => u.email === email);
    if (user && !user.isEmailVerified) {
       console.log(`%c[EMAIL SERVICE] Resent verification code for ${email}: ${user.verificationCode}`, "color: #c19a6b; font-weight: bold; font-size: 14px;");
       return true;
    }
    return false;
  },

  login: (email: string): User => {
    const allUsers = StorageService.getAllUsers();
    const existingUser = allUsers.find(u => u.email === email);

    if (!existingUser) {
      throw new Error("Account does not exist. Please sign up.");
    }

    if (!existingUser.isActive) {
      throw new Error("Account deactivated. Please contact support.");
    }

    if (!existingUser.isEmailVerified) {
       throw new Error("Email not verified");
    }

    const sessionUser = { ...existingUser, isAuthenticated: true };
    localStorage.setItem(USER_KEY, JSON.stringify(sessionUser));
    return sessionUser;
  },

  logout: () => {
    localStorage.removeItem(USER_KEY);
  },

  getImages: (): ImageRecord[] => {
    const stored = localStorage.getItem(IMAGES_KEY);
    const allImages: ImageRecord[] = stored ? JSON.parse(stored) : [];
    const user = StorageService.getUser();
    
    if (user.isAuthenticated) {
        return allImages.filter(img => img.userId === user.id);
    }
    return allImages.filter(img => img.userId === 'guest');
  },

  saveImage: (image: ImageRecord) => {
    const stored = localStorage.getItem(IMAGES_KEY);
    const allImages: ImageRecord[] = stored ? JSON.parse(stored) : [];
    const updated = [image, ...allImages];
    localStorage.setItem(IMAGES_KEY, JSON.stringify(updated));
  },

  updateImage: (imageId: string, updates: Partial<ImageRecord>) => {
    const stored = localStorage.getItem(IMAGES_KEY);
    const allImages: ImageRecord[] = stored ? JSON.parse(stored) : [];
    const index = allImages.findIndex(img => img.id === imageId);
    if (index !== -1) {
      allImages[index] = { ...allImages[index], ...updates };
      localStorage.setItem(IMAGES_KEY, JSON.stringify(allImages));
    }
  },

  deleteImage: (imageId: string) => {
    const stored = localStorage.getItem(IMAGES_KEY);
    if (!stored) return;
    const allImages: ImageRecord[] = JSON.parse(stored);
    const filtered = allImages.filter(img => img.id !== imageId);
    localStorage.setItem(IMAGES_KEY, JSON.stringify(filtered));
  },

  // --- STRIPE REDIRECT LOGIC ---
  setPendingTransaction: (planId: PlanTier, imageId?: string) => {
      const pending: PendingTransaction = {
          planId,
          imageId,
          timestamp: Date.now()
      };
      localStorage.setItem(PENDING_TXN_KEY, JSON.stringify(pending));
  },

  getPendingTransaction: (): PendingTransaction | null => {
      const stored = localStorage.getItem(PENDING_TXN_KEY);
      if (!stored) return null;
      
      const pending: PendingTransaction = JSON.parse(stored);
      // Expire pending transactions after 1 hour to prevent stale state issues
      if (Date.now() - pending.timestamp > 3600000) {
          localStorage.removeItem(PENDING_TXN_KEY);
          return null;
      }
      return pending;
  },

  clearPendingTransaction: () => {
      localStorage.removeItem(PENDING_TXN_KEY);
  },

  // Secure Payment Processing (Legacy Form Logic - kept for compatibility)
  processPayment: async (paymentDetails: PaymentDetails, planId: PlanTier): Promise<Transaction> => {
    // ... existing mock logic ...
    const plan = PLANS.find(p => p.id === planId);
    if (!plan) throw new Error("Invalid plan configuration.");
    
    // Simulating Success
    await new Promise(resolve => setTimeout(resolve, 1500));
    return {
        id: `txn_${Date.now()}`,
        date: Date.now(),
        amount: plan.price,
        description: plan.isSubscription ? `Subscription: ${plan.name}` : `One-Time: ${plan.name}`,
        status: 'SUCCESS',
        paymentMethod: `Card ending in ${paymentDetails.cardNumber.slice(-4)}`
    };
  },

  finalizePurchase: (transaction: Transaction, planId: PlanTier) => {
    const user = StorageService.getUser();
    const plan = PLANS.find(p => p.id === planId);
    
    if (!plan) return user;

    // Calculate new credits
    const newCredits = user.credits + plan.credits;

    // Determine new plan
    // If it's a one-time purchase (NONE), don't change the user's base subscription plan
    const newPlan = plan.isSubscription ? planId : user.plan;

    const updatedUser = {
      ...user,
      plan: newPlan,
      credits: newCredits,
      transactions: [...(user.transactions || []), transaction]
    };
    
    StorageService.saveUser(updatedUser);
    
    // Trigger Emails
    console.log(`[EMAIL SENT] Receipt for ${transaction.description} ($${transaction.amount}) sent to ${user.email}.`);
    if (plan.isSubscription) {
        console.log(`[EMAIL SENT] Subscription active: ${plan.name}. Next billing cycle in 30 days.`);
    } else {
        console.log(`[EMAIL SENT] One-time purchase confirmed. ${plan.credits} credits added.`);
    }
    
    StorageService.logEvent({ type: 'CONVERSION', timestamp: Date.now(), details: plan.name });

    return updatedUser;
  },

  cancelSubscription: () => {
    const user = StorageService.getUser();
    if (user.plan === PlanTier.NONE) return user; // Already none

    // Revert to Pay-Per-Use
    const updatedUser = { ...user, plan: PlanTier.NONE };
    StorageService.saveUser(updatedUser);
    
    console.log(`[EMAIL SENT] Subscription cancelled for ${user.email}. Account downgraded to Pay-Per-Use.`);
    StorageService.logEvent({ type: 'SUBSCRIPTION_CANCEL', timestamp: Date.now() });

    return updatedUser;
  },

  deductCredit: (): boolean => {
    const user = StorageService.getUser();
    
    // ADMIN UNLIMITED CREDITS LOGIC
    if (user.role === UserRole.ADMIN) {
        return true;
    }

    if (user.credits > 0) {
      const updatedUser = { ...user, credits: user.credits - 1 };
      StorageService.saveUser(updatedUser);
      if (updatedUser.credits === 0) {
          console.log(`[EMAIL SENT] You are out of credits, ${user.email}. Upgrade now!`);
      }
      return true;
    }
    return false;
  },

  recordFreeUsage: () => {
    const user = StorageService.getUser();
    const updatedUser = { ...user, hasUsedFreeGen: true };
    StorageService.saveUser(updatedUser);
    StorageService.logEvent({ type: 'FREE_USAGE', timestamp: Date.now() });
    return updatedUser;
  },

  logEvent: (event: AnalyticsEvent) => {
      const stored = localStorage.getItem(ANALYTICS_KEY);
      const events: AnalyticsEvent[] = stored ? JSON.parse(stored) : [];
      events.push(event);
      localStorage.setItem(ANALYTICS_KEY, JSON.stringify(events));
  },

  getAnalytics: () => {
      const stored = localStorage.getItem(ANALYTICS_KEY);
      return (stored ? JSON.parse(stored) : []) as AnalyticsEvent[];
  },

  createTicket: (ticket: Omit<SupportTicket, 'id' | 'timestamp' | 'adminReplies' | 'status'>) => {
    const tickets = StorageService.getTickets();
    const newTicket: SupportTicket = {
      ...ticket,
      id: `ticket_${Date.now()}`,
      timestamp: Date.now(),
      status: 'NEW',
      adminReplies: []
    };
    tickets.push(newTicket);
    localStorage.setItem(SUPPORT_KEY, JSON.stringify(tickets));
    console.log(`[EMAIL SENT] Admin Alert: New Support Ticket from ${ticket.email}`);
    return newTicket;
  },

  getTickets: (): SupportTicket[] => {
    const stored = localStorage.getItem(SUPPORT_KEY);
    return stored ? JSON.parse(stored) : [];
  },

  updateTicket: (ticketId: string, updates: Partial<SupportTicket>) => {
    const tickets = StorageService.getTickets();
    const index = tickets.findIndex(t => t.id === ticketId);
    if (index !== -1) {
      tickets[index] = { ...tickets[index], ...updates };
      localStorage.setItem(SUPPORT_KEY, JSON.stringify(tickets));
    }
  },

  // Payout System
  getPayouts: (): Payout[] => {
    const stored = localStorage.getItem(PAYOUTS_KEY);
    return stored ? JSON.parse(stored) : [];
  },

  processPayout: (amount: number, method: 'PAYPAL' | 'BANK_TRANSFER', destination: string) => {
     // Check available balance
     const metrics = StorageService.getMetrics();
     if (amount > metrics.availableBalance) {
         throw new Error(`Insufficient funds. Available: $${metrics.availableBalance.toFixed(2)}`);
     }

     const payout: Payout = {
         id: `payout_${Date.now()}`,
         date: Date.now(),
         amount,
         method,
         destination,
         status: 'PROCESSED' // In real life, might be PENDING first
     };

     const payouts = StorageService.getPayouts();
     payouts.push(payout);
     localStorage.setItem(PAYOUTS_KEY, JSON.stringify(payouts));
     return payout;
  },

  // Enhanced Metrics for Admin Dashboard
  getMetrics: () => {
    const users = StorageService.getAllUsers();
    const tickets = StorageService.getTickets();
    const analytics = StorageService.getAnalytics();
    const payouts = StorageService.getPayouts();

    // Calculate Revenue
    let totalRevenue = 0;
    let oneTimeRevenue = 0;
    
    users.forEach(user => {
        if (user.transactions) {
            user.transactions.forEach(txn => {
                if (txn.status === 'SUCCESS') {
                    totalRevenue += txn.amount;
                    if (txn.description.includes('One-Time')) {
                        oneTimeRevenue += txn.amount;
                    }
                }
            });
        }
    });

    // Calculate Payouts
    const totalWithdrawn = payouts.reduce((acc, p) => acc + p.amount, 0);

    // Calculate MRR (Monthly Recurring Revenue) - Sum of prices of active subscriptions
    const mrr = users.reduce((acc, user) => {
      const plan = PLANS.find(p => p.id === user.plan);
      return acc + (plan && plan.isSubscription ? plan.price : 0);
    }, 0);

    // Conversion Rate
    const usersWithFreeUsage = users.filter(u => u.hasUsedFreeGen).length;
    const usersPaid = users.filter(u => u.transactions && u.transactions.length > 0).length;
    const conversionRate = usersWithFreeUsage > 0 ? (usersPaid / usersWithFreeUsage) * 100 : 0;

    return {
      totalUsers: users.length,
      newUsersToday: users.filter(u => Date.now() - u.joinedAt < 86400000).length,
      activeSubs: {
        BASIC: users.filter(u => u.plan === PlanTier.BASIC).length,
        PRO: users.filter(u => u.plan === PlanTier.PRO).length,
        ELITE: users.filter(u => u.plan === PlanTier.ELITE).length,
      },
      mrr,
      totalRevenue,
      oneTimeRevenue,
      oneTimeSalesCount: users.reduce((acc, u) => acc + (u.transactions?.filter(t => t.description.includes('One-Time')).length || 0), 0),
      conversionRate,
      totalGenerations: analytics.filter(e => e.type === 'GENERATION_SUCCESS').length + analytics.filter(e => e.type === 'FREE_USAGE').length,
      failedGenerations: analytics.filter(e => e.type === 'GENERATION_FAILURE').length,
      freeGenerations: usersWithFreeUsage,
      ticketsNew: tickets.filter(t => t.status === 'NEW').length,
      totalWithdrawn,
      availableBalance: totalRevenue - totalWithdrawn
    };
  }
};