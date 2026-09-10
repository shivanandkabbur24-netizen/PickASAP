export interface Product {
  id: string;
  title: string;
  description: string;
  editorialNote?: string;
  category: string;
  imageUrl: string;
  affiliateUrl: string;
  store: 'Amazon' | 'Flipkart' | 'Myntra' | 'Other' | string;
  price: string;
  originalPrice?: string;
  discountPercent?: number;
  tags: string[];
  uploaderId: string;
  uploaderName: string;
  createdAt: string;
  clicksCount: number;
}

export interface ClickRecord {
  id: string;
  productId: string;
  productTitle: string;
  store: string;
  timestamp: string;
  userAgent?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'creator' | 'admin' | 'user';
  avatarUrl?: string;
}

export type CategoryType = 
  | 'All'
  | 'Tech & Audio'
  | 'Fashion & Apparel'
  | 'Home & Design'
  | 'Beauty & Grooming'
  | 'Books & Stationery'
  | 'Everyday Carry';

export type StoreType = 'All' | 'Amazon' | 'Flipkart' | 'Myntra' | 'Other';

export type SortOption = 'newest' | 'most_clicked' | 'price_low' | 'price_high' | 'alphabetical';
