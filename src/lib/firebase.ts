import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
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

// Initialize Cloud Firestore with databaseId as prescribed by Firebase Integration Skill
// CRITICAL: The app will break without the firestoreDatabaseId parameter
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Silence internal Firestore SDK transport warnings from bubbling to console
setLogLevel('error');

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
      if (items.length > 0) {
        setStoredProducts(items);
        return items;
      }
      return getStoredProducts();
    } catch (error) {
      console.warn('Firestore getProducts notice, falling back to local cache:', error);
      return getStoredProducts();
    }
  },

  // Save / Upload new affiliate product to Firestore smoothly
  async addProduct(product: Product): Promise<Product> {
    const path = `products/${product.id}`;

    // Always update local cache optimistically first so user sees their product instantly
    const current = getStoredProducts();
    const updated = [product, ...current.filter((p) => p.id !== product.id)];
    setStoredProducts(updated);

    // Sanitize to remove any undefined properties that cause Firestore setDoc to fail
    const cleanProduct = sanitizeFirestoreData(product);

    try {
      await setDoc(doc(db, 'products', product.id), cleanProduct);
      return product;
    } catch (error) {
      console.warn('Firestore setDoc notice (saved safely to local cache):', error);
      // Return the product smoothly so user upload never fails
      return product;
    }
  },

  // Delete product from Firestore
  async deleteProduct(productId: string): Promise<boolean> {
    const path = `products/${productId}`;
    const current = getStoredProducts();
    setStoredProducts(current.filter((p) => p.id !== productId));

    try {
      await deleteDoc(doc(db, 'products', productId));
      return true;
    } catch (error) {
      console.warn('Firestore deleteProduct notice (deleted from local cache):', error);
      return true;
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
        if (items.length > 0) {
          setStoredProducts(items);
          onData(items);
        }
      },
      (error) => {
        console.warn('Firestore products subscription notice:', error);
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
        if (items.length > 0) {
          setStoredClicks(items);
          onData(items);
        }
      },
      (error) => {
        console.warn('Firestore clicks subscription notice:', error);
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
  async signInWithGoogle(): Promise<UserProfile | null> {
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
      const authError = err as { code?: string; message?: string };
      // User cancelled or closed the popup window - graceful dismissal
      if (
        authError?.code === 'auth/popup-closed-by-user' ||
        authError?.message?.includes('popup-closed-by-user') ||
        authError?.code === 'auth/cancelled-popup-request'
      ) {
        return null;
      }
      if (authError?.code === 'auth/popup-blocked') {
        throw new Error('Google Sign-In popup was blocked by your browser. Please allow popups to continue.');
      }
      console.warn('Firebase Google Sign-In notice:', authError?.message || err);
      throw new Error(authError?.message || 'Google sign-in could not be completed. Please try again.');
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
