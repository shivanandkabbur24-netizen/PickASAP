import { initializeApp } from 'firebase/app';
import { 
  initializeFirestore, 
  setLogLevel,
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  increment,
  query, 
  orderBy, 
  limit, 
  where,
  writeBatch,
  onSnapshot
} from 'firebase/firestore';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { 
  Product, 
  ClickRecord, 
  UserProfile, 
  PriceSnapshot, 
  PriceSubmission, 
  SubmissionStatus, 
  ApprovalMethod, 
  RiskLevel 
} from '../types';
import initialProductsRaw from '../data/initialProducts.json';

export const parsePriceToNumber = (priceStr: string | number | undefined | null): number => {
  if (typeof priceStr === 'number') return priceStr;
  if (!priceStr) return 0;
  const cleaned = String(priceStr).replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

export const formatPriceDisplay = (price: number | string | undefined | null, currency: string = '₹'): string => {
  if (price === undefined || price === null || price === '') return `${currency}0`;
  const str = String(price).trim();
  if (str.startsWith(currency)) {
    return str;
  }
  const num = typeof price === 'number' ? price : parsePriceToNumber(price);
  if (num === 0 && (!price || price === '')) return `${currency}0`;
  return `${currency}${num.toLocaleString('en-IN')}`;
};

// Baseline products guaranteed to show up on the home screen immediately on frame zero
const INITIAL_PRODUCTS: Product[] = (initialProductsRaw as Product[]).map((p) => {
  const numPrice = p.currentPrice ?? parsePriceToNumber(p.price);
  const formattedPrice = formatPriceDisplay(p.price);
  const formattedMrp = p.mrp ? formatPriceDisplay(p.mrp) : p.originalPrice ? formatPriceDisplay(p.originalPrice) : undefined;
  const formattedOrigPrice = p.originalPrice ? formatPriceDisplay(p.originalPrice) : p.mrp ? formatPriceDisplay(p.mrp) : undefined;
  return {
    ...p,
    price: formattedPrice,
    currentPrice: numPrice,
    marketplace: p.marketplace || p.store,
    productUrl: p.productUrl || p.affiliateUrl,
    mrp: formattedMrp,
    originalPrice: formattedOrigPrice,
    discount: p.discount ?? p.discountPercent,
    dealStatus: p.dealStatus || 'verified',
    lastUpdated: p.lastUpdated || p.createdAt,
  };
});

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore with databaseId as prescribed by Firebase Integration Skill
export const db = initializeFirestore(
  app,
  {},
  firebaseConfig.firestoreDatabaseId
);

// Silence internal Firestore SDK transport warnings from bubbling to console
setLogLevel('silent');

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Google Auth Provider - force account selection prompt so user sees account chooser dialog
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Listen to auth state changes to synchronize session automatically
if (typeof window !== 'undefined') {
  onAuthStateChanged(auth, (fbUser) => {
    if (fbUser) {
      const email = (fbUser.email || '').toLowerCase().trim();
      const isAdmin =
        email === 'shivanandkabbur24@gmail.com' ||
        email.includes('admin') ||
        fbUser.uid === 'DTORVHWkRQRBLp1vS7JfdVIvVBr1';
      const users = getStoredUsers();
      const existing = users.find(
        (u) => u.id === fbUser.uid || (u.email && u.email.toLowerCase().trim() === email)
      );

      const userProfile: UserProfile = {
        id: fbUser.uid,
        email: fbUser.email || email,
        name: fbUser.displayName || existing?.name || (isAdmin ? 'Shivanand Kabbur' : 'Affiliate Partner'),
        role: isAdmin ? 'admin' : (existing?.role || 'creator'),
        avatarUrl: fbUser.photoURL || existing?.avatarUrl || undefined,
        isTrustedContributor: isAdmin || existing?.isTrustedContributor || false,
        approvedSubmissionCount: existing?.approvedSubmissionCount || (isAdmin ? 16 : 0),
        rejectedSubmissionCount: existing?.rejectedSubmissionCount || 0,
        trustScore: existing?.trustScore || (isAdmin ? 100 : 70),
        trustedSince: existing?.trustedSince || (isAdmin ? '2026-01-01T00:00:00.000Z' : undefined),
      };

      localStorage.setItem(STORAGE_USER, JSON.stringify(userProfile));
      window.dispatchEvent(new CustomEvent('pickasap:auth_changed', { detail: userProfile }));
    }
  });
}

// Error Handling Infrastructure as mandated by Firebase Integration Guidelines
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Local storage key constants for fast caching and offline resilience
const STORAGE_PRODUCTS = 'pickasap_products_v1';
const STORAGE_CLICKS = 'pickasap_clicks_v1';
const STORAGE_USER = 'pickasap_current_user_v2';
const STORAGE_FAVORITES = 'pickasap_favorites_v1';
const STORAGE_PRICE_HISTORY_PREFIX = 'pickasap_price_history_v1_';

export const getStoredPriceHistory = (productId: string): PriceSnapshot[] => {
  // 1. Try reading stored snapshots from localStorage
  try {
    const raw = localStorage.getItem(`${STORAGE_PRICE_HISTORY_PREFIX}${productId}`);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) {
        // If the stored snapshots are NOT the legacy identical auto-generated items, return them
        const isLegacyFakeInit = list.every((s: PriceSnapshot) => s.id && s.id.startsWith('snap_init_'));
        if (!isLegacyFakeInit) {
          return list;
        }
      }
    }
  } catch (e) {
    console.warn('Price history storage read notice:', e);
  }

  // 2. Check if background Gemini price intelligence has already cached milestones
  try {
    const intelRaw = localStorage.getItem(`pickasap_price_intel_${productId}`);
    if (intelRaw) {
      const intel = JSON.parse(intelRaw);
      if (Array.isArray(intel?.milestones) && intel.milestones.length > 0) {
        const converted: PriceSnapshot[] = intel.milestones.map((m: any, idx: number) => ({
          id: `snap_intel_${productId}_${idx}_${new Date(m.date).getTime()}`,
          productId,
          price: m.price,
          recordedAt: new Date(m.date).toISOString(),
          source: 'background_intelligence',
          note: m.note + (m.dropPercentage ? ` (${m.dropPercentage})` : ''),
          dropPercentage: m.dropPercentage,
        }));
        converted.sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
        setStoredPriceHistory(productId, converted);
        return converted;
      }
    }
  } catch (e) {
    console.warn('Intelligence storage read notice:', e);
  }

  // 3. If no history or intelligence is cached yet, return a single current snapshot
  const products = getStoredProducts();
  const product = products.find((p) => p.id === productId);
  if (product) {
    const current = product.currentPrice ?? parsePriceToNumber(product.price);
    if (current > 0) {
      const initialSnapshot: PriceSnapshot[] = [
        {
          id: `snap_live_${productId}_${Date.now()}`,
          productId,
          price: current,
          recordedAt: new Date().toISOString(),
          source: 'admin_verified',
          note: 'Current verified price point',
        },
      ];
      return initialSnapshot;
    }
  }

  return [];
};

export const setStoredPriceHistory = (productId: string, snapshots: PriceSnapshot[]) => {
  try {
    localStorage.setItem(`${STORAGE_PRICE_HISTORY_PREFIX}${productId}`, JSON.stringify(snapshots));
  } catch (e) {
    console.warn('Price history storage write notice:', e);
  }
};

export const getStoredProducts = (): Product[] => {
  try {
    const raw = localStorage.getItem(STORAGE_PRODUCTS);
    let list: Product[] = [];
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          list = parsed;
        }
      } catch (e) {
        console.warn('Storage parse warning:', e);
      }
    }

    // Combine local storage with INITIAL_PRODUCTS baseline so all uploaded items are immediately accessible
    const combined = [...list, ...INITIAL_PRODUCTS];
    const seenIds = new Set<string>();
    const seenCombos = new Set<string>();
    const deduped: Product[] = [];
    for (const item of combined) {
      if (!item || !item.id) continue;
      const comboKey = `${(item.affiliateUrl || '').trim()}::${(item.title || '').trim().toLowerCase()}`;
      if (seenIds.has(item.id) || (item.affiliateUrl && seenCombos.has(comboKey))) {
        continue;
      }
      seenIds.add(item.id);
      if (item.affiliateUrl) seenCombos.add(comboKey);
      deduped.push(item);
    }
    // Sort newest first
    deduped.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return deduped.map((item) => ({
      ...item,
      price: formatPriceDisplay(item.price),
      currentPrice: item.currentPrice ?? parsePriceToNumber(item.price),
      mrp: item.mrp ? formatPriceDisplay(item.mrp) : item.originalPrice ? formatPriceDisplay(item.originalPrice) : undefined,
      originalPrice: item.originalPrice ? formatPriceDisplay(item.originalPrice) : item.mrp ? formatPriceDisplay(item.mrp) : undefined,
    }));
  } catch {
    return INITIAL_PRODUCTS;
  }
};

export const setStoredProducts = (products: Product[]) => {
  try {
    const seenIds = new Set<string>();
    const seenCombos = new Set<string>();
    const deduped: Product[] = [];
    for (const item of products) {
      if (!item || !item.id) continue;
      const comboKey = `${(item.affiliateUrl || '').trim()}::${(item.title || '').trim().toLowerCase()}`;
      if (seenIds.has(item.id) || (item.affiliateUrl && seenCombos.has(comboKey))) {
        continue;
      }
      seenIds.add(item.id);
      if (item.affiliateUrl) seenCombos.add(comboKey);
      deduped.push(item);
    }
    localStorage.setItem(STORAGE_PRODUCTS, JSON.stringify(deduped));
  } catch (e) {
    console.warn('Storage set error:', e);
  }
};

export const getStoredClicks = (): ClickRecord[] => {
  try {
    const raw = localStorage.getItem(STORAGE_CLICKS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

export const setStoredClicks = (clicks: ClickRecord[]) => {
  localStorage.setItem(STORAGE_CLICKS, JSON.stringify(clicks));
};

const STORAGE_SUBMISSIONS = 'pickasap_price_submissions_v1';
const STORAGE_USERS = 'pickasap_user_profiles_v1';

const SEED_USERS: UserProfile[] = [
  {
    id: 'DTORVHWkRQRBLp1vS7JfdVIvVBr1',
    email: 'shivanandkabbur24@gmail.com',
    name: 'Shivanand Kabbur',
    role: 'admin',
    isTrustedContributor: true,
    approvedSubmissionCount: 16,
    rejectedSubmissionCount: 0,
    trustScore: 100,
    trustedSince: '2026-01-01T00:00:00.000Z',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
  },
  {
    id: 'user_priya_trusted',
    email: 'priya.curates@gmail.com',
    name: 'Priya Sharma',
    role: 'creator',
    isTrustedContributor: true,
    approvedSubmissionCount: 8,
    rejectedSubmissionCount: 0,
    trustScore: 98,
    trustedSince: '2026-01-15T00:00:00.000Z',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
  },
  {
    id: 'user_rahul_regular',
    email: 'rahul.deals@gmail.com',
    name: 'Rahul Verma',
    role: 'user',
    isTrustedContributor: false,
    approvedSubmissionCount: 2,
    rejectedSubmissionCount: 0,
    trustScore: 75,
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
  },
  {
    id: 'user_curator_default',
    email: 'curator@pickasap.com',
    name: 'PickASAP Editorial Curator',
    role: 'creator',
    isTrustedContributor: true,
    approvedSubmissionCount: 12,
    rejectedSubmissionCount: 0,
    trustScore: 95,
    trustedSince: '2026-01-10T00:00:00.000Z',
  },
];

const SEED_SUBMISSIONS: PriceSubmission[] = [
  {
    id: 'sub_seed_1',
    productId: 'prod_1789361402473_jrho5',
    productTitle: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones',
    productStore: 'Amazon',
    productImageUrl: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&auto=format&fit=crop&q=80',
    submittedBy: 'user_priya_trusted',
    submittedByName: 'Priya Sharma',
    submittedByEmail: 'priya.curates@gmail.com',
    submittedPrice: 10917,
    previousApprovedPrice: 11499,
    priceChangePercentage: 5.1,
    note: 'Amazon lightning deal matching app discount voucher',
    source: 'Amazon',
    status: 'approved',
    approvalMethod: 'trusted-user',
    riskLevel: 'low',
    submittedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    reviewedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    reviewedBy: 'trusted-auto',
  },
  {
    id: 'sub_seed_2',
    productId: 'prod_1789361402473_jrho5',
    productTitle: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones',
    productStore: 'Amazon',
    productImageUrl: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&auto=format&fit=crop&q=80',
    submittedBy: 'user_rahul_regular',
    submittedByName: 'Rahul Verma',
    submittedByEmail: 'rahul.deals@gmail.com',
    submittedPrice: 8499,
    previousApprovedPrice: 10917,
    priceChangePercentage: 22.2,
    note: 'ICICI Bank Festive instant discount applied at cart checkout',
    source: 'Amazon',
    status: 'pending',
    approvalMethod: 'admin',
    riskLevel: 'medium',
    submittedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sub_seed_3',
    productId: 'prod_1789361402473_jrho5',
    productTitle: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones',
    productStore: 'Amazon',
    productImageUrl: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&auto=format&fit=crop&q=80',
    submittedBy: 'user_anand_unverified',
    submittedByName: 'Anand K',
    submittedByEmail: 'anand.k@example.com',
    submittedPrice: 4899,
    previousApprovedPrice: 10917,
    priceChangePercentage: 55.1,
    note: 'Saw this price screenshot on deal telegram channel',
    source: 'Telegram deal alert',
    status: 'pending',
    approvalMethod: 'admin',
    riskLevel: 'high',
    submittedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
];

export const getStoredSubmissions = (): PriceSubmission[] => {
  try {
    const raw = localStorage.getItem(STORAGE_SUBMISSIONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Submissions storage read notice:', e);
  }
  setStoredSubmissions(SEED_SUBMISSIONS);
  return SEED_SUBMISSIONS;
};

export const setStoredSubmissions = (submissions: PriceSubmission[]) => {
  try {
    localStorage.setItem(STORAGE_SUBMISSIONS, JSON.stringify(submissions));
  } catch (e) {
    console.warn('Submissions storage write notice:', e);
  }
};

export const getStoredUsers = (): UserProfile[] => {
  try {
    const raw = localStorage.getItem(STORAGE_USERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        let changed = false;
        const normalized = parsed.map((u: UserProfile) => {
          if (u.email && u.email.toLowerCase().trim() === 'shivanandkabbur24@gmail.com') {
            if (u.id !== 'DTORVHWkRQRBLp1vS7JfdVIvVBr1' || u.role !== 'admin' || !u.isTrustedContributor) {
              changed = true;
              return {
                ...u,
                id: 'DTORVHWkRQRBLp1vS7JfdVIvVBr1',
                role: 'admin' as const,
                isTrustedContributor: true,
                trustScore: 100,
              };
            }
          }
          return u;
        });
        if (changed) {
          setStoredUsers(normalized);
        }
        return normalized;
      }
    }
  } catch (e) {
    console.warn('Users storage read notice:', e);
  }
  setStoredUsers(SEED_USERS);
  return SEED_USERS;
};

export const setStoredUsers = (users: UserProfile[]) => {
  try {
    localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
  } catch (e) {
    console.warn('Users storage write notice:', e);
  }
};

// Sanitize any data object to strictly exclude undefined values before writing to Firestore
export const sanitizeFirestoreData = <T extends Record<string, any>>(obj: T): Record<string, any> => {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        result[key] = value.filter((v) => v !== undefined && v !== null);
      } else if (typeof value === 'object' && !(value instanceof Date)) {
        result[key] = sanitizeFirestoreData(value);
      } else {
        result[key] = value;
      }
    }
  }
  return result;
};

// Application Database & Authentication Service
export const databaseService = {
  // Fetch all products from Firestore with cache prioritization
  async getProducts(): Promise<Product[]> {
    const cached = getStoredProducts();
    const path = 'products';
    try {
      const snapshot = await getDocs(collection(db, path));
      const items: Product[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Product;
        if (data && data.id && data.title) {
          items.push(data);
        }
      });
      if (items.length > 0) {
        items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setStoredProducts(items);
        return getStoredProducts();
      }
      return cached;
    } catch (error) {
      console.warn('Firestore getProducts notice, falling back to local cache:', error);
      return cached;
    }
  },

  // Save / Upload new affiliate product to Firestore smoothly
  async addProduct(product: Product): Promise<Product> {
    // 1. Ensure numeric currentPrice and required fields
    if (typeof product.currentPrice !== 'number') {
      product.currentPrice = parsePriceToNumber(product.price);
    }
    product.price = formatPriceDisplay(product.price);
    if (product.mrp) {
      product.mrp = formatPriceDisplay(product.mrp);
    }
    if (product.originalPrice) {
      product.originalPrice = formatPriceDisplay(product.originalPrice);
    }
    if (!product.dealStatus) {
      product.dealStatus = 'verified';
    }
    product.lastUpdated = product.lastUpdated || new Date().toISOString();
    product.marketplace = product.marketplace || product.store;
    product.productUrl = product.productUrl || product.affiliateUrl;

    // 2. Always update local cache optimistically first so user sees their product in 0ms
    const current = getStoredProducts();
    const comboKey = `${(product.affiliateUrl || '').trim()}::${(product.title || '').trim().toLowerCase()}`;
    const filtered = current.filter(
      (p) => p.id !== product.id && `${(p.affiliateUrl || '').trim()}::${(p.title || '').trim().toLowerCase()}` !== comboKey
    );
    const updated = [product, ...filtered];
    setStoredProducts(updated);

    // 3. Record initial price snapshot under products/{productId}/priceHistory
    const initialPrice = product.currentPrice ?? parsePriceToNumber(product.price);
    if (initialPrice > 0) {
      this.addPriceSnapshot(product.id, {
        price: initialPrice,
        recordedAt: product.createdAt || new Date().toISOString(),
        source: 'initial',
        note: 'Initial recorded price on publication',
      }).catch((e) => console.warn('Initial price snapshot notice:', e));
    }

    // 4. Sanitize to remove any undefined properties that cause Firestore setDoc to fail
    const cleanProduct = sanitizeFirestoreData(product);

    // 5. Cloud persistence in background with safe timeout race so UI is never blocked
    const firestoreWrite = setDoc(doc(db, 'products', product.id), cleanProduct).catch((error) => {
      console.warn('Firestore setDoc notice (saved safely to local cache):', error);
    });

    // Don't make the user wait longer than 400ms for cloud confirmation
    const fastTimeout = new Promise((resolve) => setTimeout(resolve, 400));
    await Promise.race([firestoreWrite, fastTimeout]);

    return product;
  },

  // Fetch price history snapshots for a product
  async getPriceHistory(productId: string): Promise<PriceSnapshot[]> {
    const cached = getStoredPriceHistory(productId);
    const path = `products/${productId}/priceHistory`;
    try {
      const q = query(collection(db, path), orderBy('recordedAt', 'asc'));
      const snapshot = await getDocs(q);
      const items: PriceSnapshot[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as PriceSnapshot;
        if (data && typeof data.price === 'number') {
          items.push(data);
        }
      });
      if (items.length > 0) {
        items.sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
        setStoredPriceHistory(productId, items);
        return items;
      }
    } catch (err) {
      console.warn(`Firestore getPriceHistory notice for ${productId}:`, err);
    }

    // If local cache has snapshots, return them
    if (cached.length > 0) {
      return cached;
    }

    // Fallback: If no snapshots exist in Cloud or Local, generate initial baseline snapshot from product
    const products = getStoredProducts();
    const product = products.find((p) => p.id === productId);
    if (product) {
      const initialPrice = product.currentPrice ?? parsePriceToNumber(product.price);
      if (initialPrice > 0) {
        const initialSnap: PriceSnapshot = {
          id: `snap_init_${product.id}`,
          price: initialPrice,
          recordedAt: product.createdAt || new Date().toISOString(),
          source: 'initial',
          note: 'Initial recorded price',
        };
        const initialList = [initialSnap];
        setStoredPriceHistory(productId, initialList);
        return initialList;
      }
    }
    return cached;
  },

  // Subscribe to real-time price history snapshots
  subscribeToPriceHistory(productId: string, onData: (snapshots: PriceSnapshot[]) => void) {
    const cached = getStoredPriceHistory(productId);
    if (cached.length > 0) {
      onData(cached);
    } else {
      const products = getStoredProducts();
      const product = products.find((p) => p.id === productId);
      if (product) {
        const initialPrice = product.currentPrice ?? parsePriceToNumber(product.price);
        if (initialPrice > 0) {
          const initialSnap: PriceSnapshot = {
            id: `snap_init_${product.id}`,
            price: initialPrice,
            recordedAt: product.createdAt || new Date().toISOString(),
            source: 'initial',
            note: 'Initial recorded price',
          };
          onData([initialSnap]);
        }
      }
    }

    const path = `products/${productId}/priceHistory`;
    return onSnapshot(
      collection(db, path),
      (snapshot) => {
        const items: PriceSnapshot[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as PriceSnapshot;
          if (data && typeof data.price === 'number') {
            items.push(data);
          }
        });
        if (items.length > 0) {
          items.sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
          const baseline = getStoredPriceHistory(productId);
          const itemsFlat = items.length <= 1 || Math.max(...items.map((s) => s.price)) === Math.min(...items.map((s) => s.price));
          const baselineRich = baseline.length > 1 && Math.max(...baseline.map((s) => s.price)) > Math.min(...baseline.map((s) => s.price));

          if (itemsFlat && baselineRich) {
            onData(baseline);
          } else {
            setStoredPriceHistory(productId, items);
            onData(items);
          }
        } else {
          // If Firestore has no snapshots recorded yet (e.g. static Cloudflare Pages deployment), serve local baseline
          const fallbackSnaps = getStoredPriceHistory(productId);
          if (fallbackSnaps.length > 0) {
            onData(fallbackSnaps);
          }
        }
      },
      (error) => {
        console.warn(`Firestore priceHistory subscription notice for ${productId}:`, error);
        onData(getStoredPriceHistory(productId));
      }
    );
  },

  // Add an immutable price snapshot under products/{productId}/priceHistory/{snapshotId}
  async addPriceSnapshot(
    productId: string,
    snapshotData: { price: number; recordedAt?: string; source?: string; note?: string }
  ): Promise<PriceSnapshot> {
    const snapId = 'snap_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const newSnapshot: PriceSnapshot = {
      id: snapId,
      price: snapshotData.price,
      recordedAt: snapshotData.recordedAt || new Date().toISOString(),
      source: snapshotData.source || 'admin_verified',
      note: snapshotData.note?.trim() || undefined,
    };

    // Update local cache
    const currentSnaps = getStoredPriceHistory(productId);
    const updatedSnaps = [...currentSnaps, newSnapshot].sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    );
    setStoredPriceHistory(productId, updatedSnaps);

    // Broadcast update
    window.dispatchEvent(
      new CustomEvent('pickasap:price_snapshot_added', {
        detail: { productId, snapshot: newSnapshot, snapshots: updatedSnaps },
      })
    );

    // Cloud write
    try {
      const cleanData = sanitizeFirestoreData(newSnapshot);
      await setDoc(doc(db, `products/${productId}/priceHistory`, snapId), cleanData);
    } catch (err) {
      console.warn('Firestore addPriceSnapshot cloud write notice:', err);
    }

    return newSnapshot;
  },

  // Administrator price and offer update
  async updateProductPriceAndOffer(
    productId: string,
    updateData: {
      price: number;
      mrp?: string;
      discount?: number;
      offerDescription?: string;
      offerExpiry?: string;
      dealStatus?: string;
      note?: string;
      affiliateUrl?: string;
      productUrl?: string;
    }
  ): Promise<{ product: Product; snapshotCreated: boolean }> {
    const products = getStoredProducts();
    const productIndex = products.findIndex((p) => p.id === productId);
    if (productIndex === -1) {
      throw new Error(`Product not found: ${productId}`);
    }

    const existingProduct = products[productIndex];
    const prevPrice = existingProduct.currentPrice ?? parsePriceToNumber(existingProduct.price);
    const newPrice = updateData.price;
    const nowISO = new Date().toISOString();

    const priceChanged = Math.abs(prevPrice - newPrice) > 0.01;
    let snapshotCreated = false;

    // Check existing snapshots to prevent duplicate identical snapshot
    const existingSnaps = getStoredPriceHistory(productId);
    const lastSnap = existingSnaps.length > 0 ? existingSnaps[existingSnaps.length - 1] : null;
    const isDuplicateOfLast = lastSnap && Math.abs(lastSnap.price - newPrice) < 0.01;

    // If new price is different and not duplicate of last snapshot, record snapshot
    if (priceChanged && !isDuplicateOfLast) {
      await this.addPriceSnapshot(productId, {
        price: newPrice,
        recordedAt: nowISO,
        source: 'admin_verified',
        note: updateData.note || 'Verified price update by administrator',
      });
      snapshotCreated = true;
    }

    // Format new price string
    const formattedPrice = formatPriceDisplay(newPrice);

    // Calculate discount if MRP provided
    let calculatedDiscount = updateData.discount ?? existingProduct.discountPercent ?? existingProduct.discount;
    if (updateData.mrp) {
      const mrpNum = parsePriceToNumber(updateData.mrp);
      if (mrpNum > newPrice && mrpNum > 0) {
        calculatedDiscount = Math.round(((mrpNum - newPrice) / mrpNum) * 100);
      }
    }

    const updatedProduct: Product = {
      ...existingProduct,
      currentPrice: newPrice,
      price: formattedPrice,
      mrp: updateData.mrp !== undefined ? updateData.mrp : existingProduct.mrp || existingProduct.originalPrice,
      originalPrice: updateData.mrp !== undefined ? updateData.mrp : existingProduct.originalPrice || existingProduct.mrp,
      discount: calculatedDiscount,
      discountPercent: calculatedDiscount,
      offerDescription: updateData.offerDescription !== undefined ? updateData.offerDescription : existingProduct.offerDescription,
      offerExpiry: updateData.offerExpiry !== undefined ? updateData.offerExpiry : existingProduct.offerExpiry,
      dealStatus: updateData.dealStatus !== undefined ? updateData.dealStatus : existingProduct.dealStatus || 'verified',
      lastUpdated: nowISO,
      affiliateUrl: updateData.affiliateUrl || existingProduct.affiliateUrl,
      productUrl: updateData.productUrl || existingProduct.productUrl || existingProduct.affiliateUrl,
    };

    // Update local cache
    products[productIndex] = updatedProduct;
    setStoredProducts(products);

    // Broadcast global events
    window.dispatchEvent(
      new CustomEvent('pickasap:product_updated', { detail: updatedProduct })
    );

    // Cloud update
    try {
      const cleanUpdate = sanitizeFirestoreData({
        currentPrice: updatedProduct.currentPrice,
        price: updatedProduct.price,
        mrp: updatedProduct.mrp,
        originalPrice: updatedProduct.originalPrice,
        discount: updatedProduct.discount,
        discountPercent: updatedProduct.discountPercent,
        offerDescription: updatedProduct.offerDescription,
        offerExpiry: updatedProduct.offerExpiry,
        dealStatus: updatedProduct.dealStatus,
        lastUpdated: updatedProduct.lastUpdated,
        affiliateUrl: updatedProduct.affiliateUrl,
        productUrl: updatedProduct.productUrl,
      });
      await updateDoc(doc(db, 'products', productId), cleanUpdate);
    } catch (err) {
      console.warn('Firestore updateProductPriceAndOffer notice:', err);
    }

    return { product: updatedProduct, snapshotCreated };
  },

  // Delete product from Firestore smoothly
  async deleteProduct(productId: string): Promise<boolean> {
    // 1. Immediately remove from local storage cache
    const current = getStoredProducts();
    setStoredProducts(current.filter((p) => p.id !== productId));

    // 2. Cloud delete in background
    deleteDoc(doc(db, 'products', productId)).catch((error) => {
      console.warn('Firestore deleteProduct notice (deleted from local cache):', error);
    });

    return true;
  },

  // Record click on an affiliate link in Firestore (Outbound merchant store click)
  async recordClick(product: Product): Promise<{ count: number; record: ClickRecord }> {
    const newRecord: ClickRecord = {
      id: 'click_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      productId: product.id,
      productTitle: product.title,
      store: product.store,
      timestamp: new Date().toISOString(),
      uploaderId: product.uploaderId || '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    };

    const currentMonthKey = new Date().toISOString().substring(0, 7);
    const existingClicks = getStoredClicks();
    const updatedClicksList = [newRecord, ...existingClicks.filter((c) => c.id !== newRecord.id)];
    setStoredClicks(updatedClicksList);

    // Calculate genuine authentic count of ClickRecords for this product
    const newCount = updatedClicksList.filter((c) => c.productId === product.id).length;

    const updatedMonthlyClicks = { ...(product.monthlyClicks || {}) };
    updatedMonthlyClicks[currentMonthKey] = (updatedMonthlyClicks[currentMonthKey] || 0) + 1;

    // Optimistically update local cache
    const products = getStoredProducts();
    const updatedProducts = products.map((p) => {
      if (p.id === product.id) {
        return { ...p, clicksCount: newCount, monthlyClicks: updatedMonthlyClicks };
      }
      return p;
    });
    setStoredProducts(updatedProducts);

    // Dispatch global event for instantaneous UI updates
    window.dispatchEvent(
      new CustomEvent('pickasap:click_recorded', {
        detail: { product, record: newRecord, clicksCount: newCount },
      })
    );

    // Save click record and atomically increment product clicks count in Firestore
    try {
      await setDoc(doc(db, 'clicks', newRecord.id), newRecord);
      await updateDoc(doc(db, 'products', product.id), {
        clicksCount: increment(1),
        [`monthlyClicks.${currentMonthKey}`]: increment(1),
      });
    } catch (err) {
      console.warn('Firestore recordClick background update notice:', err);
    }

    return { count: newCount, record: newRecord };
  },

  // Fetch recent authentic click records from Firestore
  async getClicks(): Promise<ClickRecord[]> {
    const path = 'clicks';
    try {
      const snapshot = await getDocs(collection(db, path));
      const items: ClickRecord[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as ClickRecord);
      });
      items.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
      setStoredClicks(items);
      return items;
    } catch (error) {
      console.warn('Firestore getClicks notice, using local cache:', error);
      return getStoredClicks();
    }
  },

  // Delete an individual click record (admin/uploader)
  async deleteClick(clickId: string): Promise<boolean> {
    try {
      await deleteDoc(doc(db, 'clicks', clickId));
      const current = getStoredClicks().filter((c) => c.id !== clickId);
      setStoredClicks(current);
      window.dispatchEvent(new CustomEvent('pickasap:click_deleted', { detail: { clickId } }));
      return true;
    } catch (err) {
      console.error('Failed to delete click:', err);
      return false;
    }
  },

  // Reset or purge all clicks for a specific product
  async resetProductClicks(productId: string): Promise<boolean> {
    try {
      const q = query(collection(db, 'clicks'), where('productId', '==', productId));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.forEach((d) => batch.delete(d.ref));
      await batch.commit();

      const current = getStoredClicks().filter((c) => c.productId !== productId);
      setStoredClicks(current);

      await updateDoc(doc(db, 'products', productId), {
        clicksCount: 0,
        monthlyClicks: {},
      }).catch(() => {});

      window.dispatchEvent(new CustomEvent('pickasap:product_clicks_reset', { detail: { productId } }));
      return true;
    } catch (err) {
      console.error('Failed to reset product clicks:', err);
      return false;
    }
  },

  // Access cached products synchronously
  getStoredProducts(): Product[] {
    return getStoredProducts();
  },

  // Access cached click records synchronously
  getStoredClicks(): ClickRecord[] {
    return getStoredClicks();
  },

  // Real-time listener for products with instant local cache priming
  subscribeToProducts(onData: (products: Product[]) => void) {
    // 1. Instantly feed stored cache so products appear on frame zero
    const cached = getStoredProducts();
    if (cached.length > 0) {
      onData(cached);
    }

    const path = 'products';
    return onSnapshot(
      collection(db, path),
      (snapshot) => {
        const items: Product[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Product;
          if (data && data.id && data.title) {
            items.push(data);
          }
        });
        if (items.length > 0) {
          items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          setStoredProducts(items);
          onData(getStoredProducts());
        }
      },
      (error) => {
        console.warn('Firestore products subscription notice:', error);
        // Ensure cached items remain visible on connection fluctuations
        onData(getStoredProducts());
      }
    );
  },

  // Real-time listener for clicks with instant cache priming
  subscribeToClicks(onData: (clicks: ClickRecord[]) => void) {
    const cached = getStoredClicks();
    if (cached.length > 0) {
      onData(cached);
    }

    const path = 'clicks';
    return onSnapshot(
      collection(db, path),
      (snapshot) => {
        const items: ClickRecord[] = [];
        snapshot.forEach((docSnap) => {
          items.push(docSnap.data() as ClickRecord);
        });
        items.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
        setStoredClicks(items);
        onData(items);
      },
      (error) => {
        console.warn('Firestore clicks subscription notice:', error);
        onData(getStoredClicks());
      }
    );
  },

  // Current user management: returns null if not logged in (visitor mode)
  getCurrentUser(): UserProfile | null {
    try {
      const raw = localStorage.getItem(STORAGE_USER);
      if (!raw) return null;
      const user = JSON.parse(raw) as UserProfile;
      if (!user || !user.email) return null;

      const cleanEmail = (user.email || '').toLowerCase().trim();
      if (
        cleanEmail === 'shivanandkabbur24@gmail.com' ||
        cleanEmail.includes('admin') ||
        user.id === 'DTORVHWkRQRBLp1vS7JfdVIvVBr1'
      ) {
        user.role = 'admin';
        user.isTrustedContributor = true;
        user.trustScore = 100;
        if (cleanEmail === 'shivanandkabbur24@gmail.com') {
          user.id = 'DTORVHWkRQRBLp1vS7JfdVIvVBr1';
        }
        if (!user.name || user.name === 'Admin' || user.name === 'Affiliate Partner') {
          user.name = 'Shivanand Kabbur';
        }
      }
      return user;
    } catch {
      return null;
    }
  },

  setCurrentUser(user: UserProfile | null) {
    if (user) {
      const cleanEmail = (user.email || '').toLowerCase().trim();
      if (
        cleanEmail === 'shivanandkabbur24@gmail.com' ||
        cleanEmail.includes('admin') ||
        user.id === 'DTORVHWkRQRBLp1vS7JfdVIvVBr1'
      ) {
        user.role = 'admin';
        user.isTrustedContributor = true;
        user.trustScore = 100;
        if (cleanEmail === 'shivanandkabbur24@gmail.com') {
          user.id = 'DTORVHWkRQRBLp1vS7JfdVIvVBr1';
        }
        if (!user.name || user.name === 'Admin' || user.name === 'Affiliate Partner') {
          user.name = 'Shivanand Kabbur';
        }
      }
      localStorage.setItem(STORAGE_USER, JSON.stringify(user));
      // Also register or update in user repository
      this.saveUserProfile(user);
    } else {
      localStorage.removeItem(STORAGE_USER);
    }
    window.dispatchEvent(new CustomEvent('pickasap:auth_changed', { detail: user }));
  },

  // Check if a user is an administrator
  isUserAdmin(user: UserProfile | null | undefined): boolean {
    if (!user) return false;
    const cleanEmail = (user.email || '').toLowerCase().trim();
    return (
      user.role === 'admin' ||
      user.id === 'DTORVHWkRQRBLp1vS7JfdVIvVBr1' ||
      cleanEmail === 'shivanandkabbur24@gmail.com' ||
      cleanEmail.includes('admin')
    );
  },

  // Save or update user profile in local store and Firestore
  saveUserProfile(userProfile: UserProfile): void {
    const users = getStoredUsers();
    const idx = users.findIndex(
      (u) => u.id === userProfile.id || (u.email && u.email.toLowerCase().trim() === userProfile.email.toLowerCase().trim())
    );
    if (idx !== -1) {
      users[idx] = { ...users[idx], ...userProfile };
    } else {
      users.push(userProfile);
    }
    setStoredUsers(users);

    // Only attempt remote Firestore doc write if user is authenticated in Firebase
    if (auth.currentUser) {
      try {
        const clean = sanitizeFirestoreData(userProfile);
        setDoc(doc(db, 'users', userProfile.id), clean, { merge: true }).catch((err) => {
          // Graceful catch for permission boundaries
        });
      } catch (err) {
        // Fallback safely
      }
    }
    window.dispatchEvent(new CustomEvent('pickasap:user_updated', { detail: userProfile }));
  },

  // Retrieve user profile
  getUserProfile(userId: string): UserProfile | null {
    const users = getStoredUsers();
    return users.find((u) => u.id === userId) || null;
  },

  // Retrieve all user profiles
  getAllUsers(): UserProfile[] {
    return getStoredUsers();
  },

  // Real-time listener for user profiles
  subscribeToUsers(onData: (users: UserProfile[]) => void) {
    onData(getStoredUsers());

    const handleUserUpdated = () => {
      onData(getStoredUsers());
    };
    window.addEventListener('pickasap:user_updated', handleUserUpdated);

    let unsub = () => {};
    if (auth.currentUser) {
      try {
        const path = 'users';
        unsub = onSnapshot(
          collection(db, path),
          (snapshot) => {
            const items: UserProfile[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as UserProfile;
              if (data && data.id) {
                items.push(data);
              }
            });
            if (items.length > 0) {
              const merged = [...getStoredUsers()];
              for (const item of items) {
                const idx = merged.findIndex((u) => u.id === item.id);
                if (idx !== -1) {
                  merged[idx] = { ...merged[idx], ...item };
                } else {
                  merged.push(item);
                }
              }
              setStoredUsers(merged);
              onData(merged);
            }
          },
          () => {
            onData(getStoredUsers());
          }
        );
      } catch {
        // Safe fallback
      }
    }

    return () => {
      unsub();
      window.removeEventListener('pickasap:user_updated', handleUserUpdated);
    };
  },

  // Admin manually toggles or updates a contributor's trusted status
  async setUserTrustedStatus(userId: string, isTrusted: boolean, adminUser?: UserProfile): Promise<UserProfile> {
    const users = getStoredUsers();
    const nowISO = new Date().toISOString();
    let targetUser: UserProfile;
    const idx = users.findIndex((u) => u.id === userId);

    if (idx !== -1) {
      targetUser = {
        ...users[idx],
        isTrustedContributor: isTrusted,
        trustedSince: isTrusted ? (users[idx].trustedSince || nowISO) : undefined,
      };
      users[idx] = targetUser;
    } else {
      targetUser = {
        id: userId,
        email: '',
        name: 'User ' + userId.substring(0, 6),
        role: 'user',
        isTrustedContributor: isTrusted,
        trustedSince: isTrusted ? nowISO : undefined,
        trustScore: isTrusted ? 90 : 50,
        approvedSubmissionCount: isTrusted ? 5 : 0,
        rejectedSubmissionCount: 0,
      };
      users.push(targetUser);
    }

    setStoredUsers(users);

    const current = this.getCurrentUser();
    if (current && current.id === userId) {
      this.setCurrentUser({
        ...current,
        isTrustedContributor: targetUser.isTrustedContributor,
        trustedSince: targetUser.trustedSince,
      });
    }

    window.dispatchEvent(new CustomEvent('pickasap:user_updated', { detail: targetUser }));

    try {
      await setDoc(doc(db, 'users', userId), sanitizeFirestoreData(targetUser), { merge: true });
    } catch (err) {
      console.warn('Firestore setUserTrustedStatus cloud notice:', err);
    }

    return targetUser;
  },

  // Record submission outcome (approved or rejected) for reputation tracking
  recordUserSubmissionResult(userId: string, isApproved: boolean) {
    const users = getStoredUsers();
    const idx = users.findIndex((u) => u.id === userId);
    const nowISO = new Date().toISOString();
    let userProfile: UserProfile;

    if (idx !== -1) {
      userProfile = { ...users[idx] };
    } else {
      userProfile = {
        id: userId,
        email: '',
        name: 'Contributor',
        role: 'user',
        approvedSubmissionCount: 0,
        rejectedSubmissionCount: 0,
        trustScore: 50,
        isTrustedContributor: false,
      };
    }

    if (isApproved) {
      userProfile.approvedSubmissionCount = (userProfile.approvedSubmissionCount || 0) + 1;
    } else {
      userProfile.rejectedSubmissionCount = (userProfile.rejectedSubmissionCount || 0) + 1;
    }

    const approved = userProfile.approvedSubmissionCount || 0;
    const rejected = userProfile.rejectedSubmissionCount || 0;
    const total = approved + rejected;
    const score = total > 0 ? Math.round((approved / (approved + rejected * 2)) * 100) : 50;
    userProfile.trustScore = Math.max(0, Math.min(100, score));

    // Automated Promotion Rule: At least 5 approved submissions with 0 rejections
    if (approved >= 5 && rejected === 0 && !userProfile.isTrustedContributor) {
      userProfile.isTrustedContributor = true;
      userProfile.trustedSince = nowISO;
    }

    if (idx !== -1) {
      users[idx] = userProfile;
    } else {
      users.push(userProfile);
    }
    setStoredUsers(users);

    const currentUser = this.getCurrentUser();
    if (currentUser && currentUser.id === userId) {
      this.setCurrentUser({
        ...currentUser,
        isTrustedContributor: userProfile.isTrustedContributor,
        approvedSubmissionCount: userProfile.approvedSubmissionCount,
        rejectedSubmissionCount: userProfile.rejectedSubmissionCount,
        trustScore: userProfile.trustScore,
        trustedSince: userProfile.trustedSince,
      });
    }

    window.dispatchEvent(new CustomEvent('pickasap:user_updated', { detail: userProfile }));

    try {
      setDoc(doc(db, 'users', userId), sanitizeFirestoreData(userProfile), { merge: true }).catch((err) => {
        console.warn('Firestore recordUserSubmissionResult notice:', err);
      });
    } catch (err) {
      console.warn('recordUserSubmissionResult notice:', err);
    }
  },

  // Process and apply an approved price update to the product and price history
  async processApprovedPriceUpdate({
    productId,
    price,
    submittedBy,
    approvalMethod,
    submissionId,
    note,
    source,
  }: {
    productId: string;
    price: number;
    submittedBy?: string;
    approvalMethod: ApprovalMethod;
    submissionId?: string;
    note?: string;
    source?: string;
  }): Promise<{ product: Product; snapshot: PriceSnapshot }> {
    const nowISO = new Date().toISOString();
    const snapId = 'snap_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    // 1. Create immutable snapshot
    const snapshot: PriceSnapshot = {
      id: snapId,
      price,
      recordedAt: nowISO,
      source: source || 'community_update',
      note: note || (approvalMethod === 'trusted-user' ? 'Approved price update (trusted contributor)' : 'Approved price update (auto-verified)'),
      submittedBy,
      approvalMethod,
      submissionId,
    };

    const currentSnaps = getStoredPriceHistory(productId);
    const updatedSnaps = [...currentSnaps, snapshot].sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    );
    setStoredPriceHistory(productId, updatedSnaps);

    try {
      const cleanSnap = sanitizeFirestoreData(snapshot);
      await setDoc(doc(db, `products/${productId}/priceHistory`, snapId), cleanSnap);
    } catch (err) {
      console.warn('Firestore priceHistory write notice:', err);
    }

    window.dispatchEvent(
      new CustomEvent('pickasap:price_snapshot_added', {
        detail: { productId, snapshot, snapshots: updatedSnaps },
      })
    );

    // 2. Update product document
    const products = getStoredProducts();
    const productIndex = products.findIndex((p) => p.id === productId);
    if (productIndex === -1) {
      throw new Error(`Product not found: ${productId}`);
    }

    const existing = products[productIndex];
    let calculatedDiscount = existing.discountPercent ?? existing.discount;
    if (existing.mrp || existing.originalPrice) {
      const mrpNum = parsePriceToNumber(existing.mrp || existing.originalPrice);
      if (mrpNum > price && mrpNum > 0) {
        calculatedDiscount = Math.round(((mrpNum - price) / mrpNum) * 100);
      }
    }

    const updatedProduct: Product = {
      ...existing,
      currentPrice: price,
      price: formatPriceDisplay(price),
      discount: calculatedDiscount,
      discountPercent: calculatedDiscount,
      discountPercentage: calculatedDiscount,
      dealStatus: 'verified',
      lastUpdated: nowISO,
    };

    products[productIndex] = updatedProduct;
    setStoredProducts(products);

    window.dispatchEvent(
      new CustomEvent('pickasap:product_updated', { detail: updatedProduct })
    );

    try {
      const cleanUpdate = sanitizeFirestoreData({
        currentPrice: updatedProduct.currentPrice,
        price: updatedProduct.price,
        discount: updatedProduct.discount,
        discountPercent: updatedProduct.discountPercent,
        discountPercentage: updatedProduct.discountPercentage,
        dealStatus: updatedProduct.dealStatus,
        lastUpdated: updatedProduct.lastUpdated,
      });
      await updateDoc(doc(db, 'products', productId), cleanUpdate);
    } catch (err) {
      console.warn('Firestore product update notice:', err);
    }

    return { product: updatedProduct, snapshot };
  },

  // Submit a price update using hybrid automatic and trusted-user rules
  async submitPriceUpdate({
    productId,
    submittedPrice,
    note,
    source,
    user,
  }: {
    productId: string;
    submittedPrice: number;
    note?: string;
    source?: string;
    user: UserProfile;
  }): Promise<{
    submission: PriceSubmission;
    message: string;
    status: SubmissionStatus;
    approvalMethod: ApprovalMethod;
    riskLevel: RiskLevel;
  }> {
    // 1. Confirm product exists
    const products = getStoredProducts();
    const product = products.find((p) => p.id === productId);
    if (!product) {
      throw new Error('This price update could not be accepted. Product was not found.');
    }

    // 2. Validate price is a valid number greater than zero
    if (
      typeof submittedPrice !== 'number' ||
      isNaN(submittedPrice) ||
      !isFinite(submittedPrice) ||
      submittedPrice <= 0
    ) {
      throw new Error('This price update could not be accepted. Price must be a valid number greater than zero.');
    }

    // 3. Prevent duplicate submission for same product within 10 minutes
    const recentSubmissions = getStoredSubmissions();
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const isDuplicate = recentSubmissions.some(
      (s) =>
        s.productId === productId &&
        s.submittedBy === user.id &&
        Math.abs(s.submittedPrice - submittedPrice) < 0.01 &&
        new Date(s.submittedAt).getTime() > tenMinutesAgo
    );
    if (isDuplicate) {
      throw new Error('You have already submitted this price for this product recently. Please wait a few minutes before submitting again.');
    }

    // 4. Check submitter's trusted status
    const allUsers = getStoredUsers();
    const userProfile = allUsers.find((u) => u.id === user.id || (u.email && u.email === user.email));
    const isTrusted = Boolean(
      user.isTrustedContributor ||
      userProfile?.isTrustedContributor ||
      this.isUserAdmin(user) ||
      ((userProfile?.approvedSubmissionCount || 0) >= 5 && (userProfile?.rejectedSubmissionCount || 0) === 0)
    );

    // 5. Calculate percentage difference from previous approved price
    const prevPrice = product.currentPrice ?? parsePriceToNumber(product.price);
    let status: SubmissionStatus = 'pending';
    let approvalMethod: ApprovalMethod = 'admin';
    let riskLevel: RiskLevel = 'low';
    let message = '';
    let diffPercent = 0;

    if (!prevPrice || prevPrice <= 0) {
      // If product has no previous approved price, send first submission to pending
      status = 'pending';
      approvalMethod = 'admin';
      riskLevel = 'medium';
      diffPercent = 0;
      message = 'Your price update is waiting for admin review.';
    } else {
      diffPercent = Math.abs(submittedPrice - prevPrice) / prevPrice * 100;

      // Risk categorization
      if (diffPercent > 50) {
        riskLevel = 'high';
      } else if (diffPercent > 20) {
        riskLevel = 'medium';
      } else {
        riskLevel = 'low';
      }

      // Hybrid approval routing
      if (diffPercent <= 20) {
        if (isTrusted) {
          status = 'approved';
          approvalMethod = 'trusted-user';
          message = 'Your price update was approved through trusted-contributor status.';
        } else {
          status = 'approved';
          approvalMethod = 'automatic';
          message = 'Your price update was approved automatically.';
        }
      } else {
        // Any change > 20% requires admin review for both normal and trusted users
        status = 'pending';
        approvalMethod = 'admin';
        message = 'Your price update is waiting for admin review.';
      }
    }

    const submissionId = 'sub_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const nowISO = new Date().toISOString();

    const submission: PriceSubmission = {
      id: submissionId,
      productId,
      productTitle: product.title,
      productStore: product.store,
      productImageUrl: product.imageUrl,
      submittedBy: user.id,
      submittedByName: user.name || 'Community Member',
      submittedByEmail: user.email || '',
      submittedPrice,
      previousApprovedPrice: prevPrice || 0,
      priceChangePercentage: parseFloat(diffPercent.toFixed(1)),
      note: note?.trim() || '',
      source: source?.trim() || product.store,
      status,
      approvalMethod,
      riskLevel,
      submittedAt: nowISO,
      reviewedAt: status === 'approved' ? nowISO : null,
      reviewedBy: status === 'approved' ? (approvalMethod === 'trusted-user' ? 'trusted-auto' : 'system-auto') : null,
    };

    // Save in local storage cache
    const updatedSubmissions = [submission, ...recentSubmissions];
    setStoredSubmissions(updatedSubmissions);

    // Persist to Cloud Firestore
    try {
      const cleanSub = sanitizeFirestoreData(submission);
      await setDoc(doc(db, 'priceSubmissions', submissionId), cleanSub);
    } catch (err) {
      console.warn('Firestore priceSubmissions write notice:', err);
    }

    // 6. If approved, process update on product and price history
    if (status === 'approved') {
      await this.processApprovedPriceUpdate({
        productId,
        price: submittedPrice,
        submittedBy: user.id,
        approvalMethod,
        submissionId,
        note: note || (approvalMethod === 'trusted-user' ? 'Approved by trusted-contributor status' : 'Approved automatically'),
        source: source || product.store,
      });

      // Update submitter's trust metrics
      this.recordUserSubmissionResult(user.id, true);
    }

    window.dispatchEvent(new CustomEvent('pickasap:submission_updated', { detail: submission }));

    return {
      submission,
      message,
      status,
      approvalMethod,
      riskLevel,
    };
  },

  // Administrator approval of a pending or flagged submission
  async approveSubmissionByAdmin(
    submissionId: string,
    adminUser: UserProfile,
    adminNote?: string
  ): Promise<PriceSubmission> {
    const submissions = getStoredSubmissions();
    const subIdx = submissions.findIndex((s) => s.id === submissionId);
    if (subIdx === -1) {
      throw new Error('Submission not found.');
    }

    const existing = submissions[subIdx];
    const nowISO = new Date().toISOString();

    const updated: PriceSubmission = {
      ...existing,
      status: 'approved',
      approvalMethod: 'admin',
      reviewedAt: nowISO,
      reviewedBy: adminUser.name || adminUser.id || 'Admin',
      note: adminNote ? `${existing.note ? existing.note + ' • ' : ''}${adminNote}` : existing.note,
    };

    submissions[subIdx] = updated;
    setStoredSubmissions(submissions);

    // Apply approved price update to catalog and price history
    await this.processApprovedPriceUpdate({
      productId: updated.productId,
      price: updated.submittedPrice,
      submittedBy: updated.submittedBy,
      approvalMethod: 'admin',
      submissionId: updated.id,
      note: updated.note || 'Admin approved price update',
      source: updated.source,
    });

    // Reward submitter reputation
    this.recordUserSubmissionResult(updated.submittedBy, true);

    window.dispatchEvent(new CustomEvent('pickasap:submission_updated', { detail: updated }));

    try {
      await updateDoc(doc(db, 'priceSubmissions', submissionId), {
        status: 'approved',
        approvalMethod: 'admin',
        reviewedAt: nowISO,
        reviewedBy: updated.reviewedBy,
        note: updated.note,
      });
    } catch (err) {
      console.warn('Firestore updateDoc submission notice:', err);
    }

    return updated;
  },

  // Administrator rejection of a pending or flagged submission
  async rejectSubmissionByAdmin(
    submissionId: string,
    adminUser: UserProfile,
    reason?: string
  ): Promise<PriceSubmission> {
    const submissions = getStoredSubmissions();
    const subIdx = submissions.findIndex((s) => s.id === submissionId);
    if (subIdx === -1) {
      throw new Error('Submission not found.');
    }

    const existing = submissions[subIdx];
    const nowISO = new Date().toISOString();

    const updated: PriceSubmission = {
      ...existing,
      status: 'rejected',
      reviewedAt: nowISO,
      reviewedBy: adminUser.name || adminUser.id || 'Admin',
      rejectionReason: reason || 'Price update does not match store verification criteria.',
    };

    submissions[subIdx] = updated;
    setStoredSubmissions(submissions);

    // Apply reputation penalty to submitter
    this.recordUserSubmissionResult(updated.submittedBy, false);

    window.dispatchEvent(new CustomEvent('pickasap:submission_updated', { detail: updated }));

    try {
      await updateDoc(doc(db, 'priceSubmissions', submissionId), {
        status: 'rejected',
        reviewedAt: nowISO,
        reviewedBy: updated.reviewedBy,
        rejectionReason: updated.rejectionReason,
      });
    } catch (err) {
      console.warn('Firestore updateDoc submission notice:', err);
    }

    return updated;
  },

  // Get price submissions with optional status or user filter
  getSubmissions(filter?: { status?: string; productId?: string; userId?: string }): PriceSubmission[] {
    let all = getStoredSubmissions();
    if (filter?.status) {
      all = all.filter((s) => s.status === filter.status);
    }
    if (filter?.productId) {
      all = all.filter((s) => s.productId === filter.productId);
    }
    if (filter?.userId) {
      all = all.filter((s) => s.submittedBy === filter.userId);
    }
    return all.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  },

  // Real-time listener for price submissions
  subscribeToSubmissions(
    onData: (submissions: PriceSubmission[]) => void,
    filter?: { status?: string; productId?: string; userId?: string }
  ) {
    onData(this.getSubmissions(filter));

    const handleSubmissionEvent = () => {
      onData(this.getSubmissions(filter));
    };
    window.addEventListener('pickasap:submission_updated', handleSubmissionEvent);

    let unsub = () => {};
    if (auth.currentUser) {
      try {
        const path = 'priceSubmissions';
        unsub = onSnapshot(
          collection(db, path),
          (snapshot) => {
            const items: PriceSubmission[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as PriceSubmission;
              if (data && data.id && data.productId) {
                items.push(data);
              }
            });
            if (items.length > 0) {
              const merged = [...getStoredSubmissions()];
              for (const item of items) {
                const idx = merged.findIndex((s) => s.id === item.id);
                if (idx !== -1) {
                  merged[idx] = { ...merged[idx], ...item };
                } else {
                  merged.push(item);
                }
              }
              setStoredSubmissions(merged);
              onData(this.getSubmissions(filter));
            }
          },
          () => {
            onData(this.getSubmissions(filter));
          }
        );
      } catch {
        // Safe fallback
      }
    }

    return () => {
      unsub();
      window.removeEventListener('pickasap:submission_updated', handleSubmissionEvent);
    };
  },

  // Sign in using Google Auth via Firebase
  async signInWithGoogle(): Promise<UserProfile | null> {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      const email = fbUser.email || '';
      const isAdmin =
        email.toLowerCase().trim() === 'shivanandkabbur24@gmail.com' ||
        email.toLowerCase().includes('admin') ||
        fbUser.uid === 'DTORVHWkRQRBLp1vS7JfdVIvVBr1';
      
      const users = getStoredUsers();
      const existing = users.find(
        (u) => u.id === fbUser.uid || (u.email && u.email.toLowerCase().trim() === email.toLowerCase().trim())
      );

      const userProfile: UserProfile = {
        id: fbUser.uid || 'DTORVHWkRQRBLp1vS7JfdVIvVBr1',
        email,
        name: fbUser.displayName || existing?.name || (isAdmin ? 'Shivanand Kabbur' : 'Affiliate Curator'),
        role: isAdmin ? 'admin' : (existing?.role || 'creator'),
        avatarUrl: fbUser.photoURL || undefined,
        isTrustedContributor: isAdmin || existing?.isTrustedContributor || false,
        approvedSubmissionCount: existing?.approvedSubmissionCount || (isAdmin ? 16 : 0),
        rejectedSubmissionCount: existing?.rejectedSubmissionCount || 0,
        trustScore: existing?.trustScore || (isAdmin ? 100 : 70),
        trustedSince: existing?.trustedSince || (isAdmin ? '2026-01-01T00:00:00.000Z' : undefined),
      };
      this.setCurrentUser(userProfile);
      return userProfile;
    } catch (err: unknown) {
      const authError = err as { code?: string; message?: string };
      // User cancelled or closed the popup window - graceful dismissal
      if (
        authError?.code === 'auth/popup-closed-by-user' ||
        authError?.message?.includes('popup-closed-by-user') ||
        authError?.code === 'auth/cancelled-popup-request'
      ) {
        return null;
      }
      
      console.warn('Google sign-in exception:', authError?.message || err);
      throw err;
    }
  },

  // Sign out
  async signOutUser(): Promise<void> {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Firebase signOut warning:', e);
    }
    this.setCurrentUser(null);
  },

  // Favorites management
  getFavorites(): string[] {
    try {
      const raw = localStorage.getItem(STORAGE_FAVORITES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  toggleFavorite(productId: string): string[] {
    const current = this.getFavorites();
    const exists = current.includes(productId);
    const updated = exists
      ? current.filter((id) => id !== productId)
      : [...current, productId];
    localStorage.setItem(STORAGE_FAVORITES, JSON.stringify(updated));
    window.dispatchEvent(
      new CustomEvent('pickasap:favorites_changed', { detail: updated })
    );
    return updated;
  },
};

// Aliased export for drop-in compatibility
export const database = databaseService;
