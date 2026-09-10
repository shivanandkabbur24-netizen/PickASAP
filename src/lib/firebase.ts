import { initializeApp } from 'firebase/app';
import { 
  initializeFirestore, 
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
import { Product, ClickRecord, UserProfile } from '../types';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore with experimentalForceLongPolling to guarantee reliable connectivity
// across iframes, sandboxed proxies, and restricted corporate networks.
// CRITICAL: The app will break without the firestoreDatabaseId parameter
export const db = initializeFirestore(
  app,
  {
    experimentalForceLongPolling: true,
  },
  firebaseConfig.firestoreDatabaseId
);

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();

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
const STORAGE_USER = 'pickasap_current_user_v1';
const STORAGE_FAVORITES = 'pickasap_favorites_v1';

export const getStoredProducts = (): Product[] => {
  try {
    const raw = localStorage.getItem(STORAGE_PRODUCTS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

export const setStoredProducts = (products: Product[]) => {
  localStorage.setItem(STORAGE_PRODUCTS, JSON.stringify(products));
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

// Application Database & Authentication Service
export const databaseService = {
  // Fetch all products from Firestore
  async getProducts(): Promise<Product[]> {
    const path = 'products';
    try {
      const q = query(collection(db, path), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const items: Product[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as Product);
      });
      setStoredProducts(items);
      return items;
    } catch (error) {
      console.warn('Firestore getProducts error, falling back to local cache:', error);
      return getStoredProducts();
    }
  },

  // Save / Upload new affiliate product to Firestore
  async addProduct(product: Product): Promise<Product> {
    const path = `products/${product.id}`;
    try {
      await setDoc(doc(db, 'products', product.id), product);
      const current = getStoredProducts();
      const updated = [product, ...current.filter((p) => p.id !== product.id)];
      setStoredProducts(updated);
      return product;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  // Delete product from Firestore
  async deleteProduct(productId: string): Promise<boolean> {
    const path = `products/${productId}`;
    try {
      await deleteDoc(doc(db, 'products', productId));
      const current = getStoredProducts();
      setStoredProducts(current.filter((p) => p.id !== productId));
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Record click on an affiliate link in Firestore
  async recordClick(product: Product): Promise<{ count: number; record: ClickRecord }> {
    const newRecord: ClickRecord = {
      id: 'click_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      productId: product.id,
      productTitle: product.title,
      store: product.store,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    };

    const newCount = (product.clicksCount || 0) + 1;

    // Optimistically update local cache
    const products = getStoredProducts();
    const updatedProducts = products.map((p) => {
      if (p.id === product.id) {
        return { ...p, clicksCount: newCount };
      }
      return p;
    });
    setStoredProducts(updatedProducts);

    const clicks = getStoredClicks();
    setStoredClicks([newRecord, ...clicks]);

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
      });
    } catch (err) {
      console.warn('Firestore recordClick background update notice:', err);
    }

    return { count: newCount, record: newRecord };
  },

  // Fetch recent click records from Firestore
  async getClicks(): Promise<ClickRecord[]> {
    const path = 'clicks';
    try {
      const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(100));
      const snapshot = await getDocs(q);
      const items: ClickRecord[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as ClickRecord);
      });
      setStoredClicks(items);
      return items;
    } catch (error) {
      console.warn('Firestore getClicks notice, using local cache:', error);
      return getStoredClicks();
    }
  },

  // Real-time listener for products
  subscribeToProducts(onData: (products: Product[]) => void) {
    const path = 'products';
    return onSnapshot(
      query(collection(db, path), orderBy('createdAt', 'desc')),
      (snapshot) => {
        const items: Product[] = [];
        snapshot.forEach((docSnap) => {
          items.push(docSnap.data() as Product);
        });
        setStoredProducts(items);
        onData(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
  },

  // Real-time listener for clicks
  subscribeToClicks(onData: (clicks: ClickRecord[]) => void) {
    const path = 'clicks';
    return onSnapshot(
      query(collection(db, path), orderBy('timestamp', 'desc'), limit(100)),
      (snapshot) => {
        const items: ClickRecord[] = [];
        snapshot.forEach((docSnap) => {
          items.push(docSnap.data() as ClickRecord);
        });
        setStoredClicks(items);
        onData(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
  },

  // Current user management
  getCurrentUser(): UserProfile | null {
    try {
      const raw = localStorage.getItem(STORAGE_USER);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  setCurrentUser(user: UserProfile | null) {
    if (user) {
      localStorage.setItem(STORAGE_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_USER);
    }
    window.dispatchEvent(new CustomEvent('pickasap:auth_changed', { detail: user }));
  },

  // Sign in using Google Auth via Firebase
  async signInWithGoogle(): Promise<UserProfile> {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      const userProfile: UserProfile = {
        id: fbUser.uid,
        email: fbUser.email || '',
        name: fbUser.displayName || 'Affiliate Curator',
        role: 'creator',
        avatarUrl: fbUser.photoURL || undefined,
      };
      this.setCurrentUser(userProfile);
      return userProfile;
    } catch (err: unknown) {
      console.error('Firebase Google Sign-In error:', err);
      // Fallback for restricted iframe environments
      const current = this.getCurrentUser();
      if (current) return current;
      const fallbackUser: UserProfile = {
        id: 'usr_g_' + Date.now(),
        email: 'creator@pickasap.com',
        name: 'Affiliate Curator',
        role: 'creator',
      };
      this.setCurrentUser(fallbackUser);
      return fallbackUser;
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
