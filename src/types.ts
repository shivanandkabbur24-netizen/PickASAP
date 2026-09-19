export type SubmissionStatus = 'pending' | 'approved' | 'rejected';
export type ApprovalMethod = 'automatic' | 'trusted-user' | 'admin';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface PriceSnapshot {
  id: string;
  productId?: string;
  price: number;
  recordedAt: string;
  source: 'initial' | 'admin_verified' | 'community_update' | 'trusted_user' | 'background_intelligence' | string;
  note?: string;
  submittedBy?: string;
  approvalMethod?: ApprovalMethod;
  submissionId?: string;
  dropPercentage?: string;
}

export interface PriceMilestone {
  date: string;
  price: number;
  formattedPrice: string;
  note: string;
  dropPercentage?: string;
  isLowest?: boolean;
  isHighest?: boolean;
}

export interface PriceIntelligenceData {
  productId?: string;
  resolvedUrl?: string;
  productTitle?: string;
  asin?: string;
  currentPrice: number;
  formattedCurrentPrice: string;
  lowestPrice: number;
  formattedLowestPrice: string;
  highestPrice: number;
  formattedHighestPrice: string;
  averagePrice: number;
  formattedAveragePrice: string;
  specialOfferPrice?: number;
  formattedSpecialOfferPrice?: string;
  currency: string;
  summaryNote: string;
  milestones: PriceMilestone[];
}

export interface PriceSubmission {
  id: string;
  productId: string;
  productTitle?: string;
  productStore?: string;
  productImageUrl?: string;
  submittedBy: string;
  submittedByName?: string;
  submittedByEmail?: string;
  submittedPrice: number;
  previousApprovedPrice: number;
  priceChangePercentage: number;
  note?: string;
  source?: string;
  status: SubmissionStatus;
  approvalMethod: ApprovalMethod;
  riskLevel: RiskLevel;
  submittedAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  rejectionReason?: string | null;
}

export interface Product {
  id: string;
  title: string;
  brand?: string;
  description: string;
  editorialNote?: string;
  category: string;
  imageUrl: string;
  images?: string[];
  affiliateUrl: string;
  productUrl?: string;
  marketplace?: string;
  store: 'Amazon' | 'Flipkart' | 'Myntra' | 'Other' | string;
  price: string;
  currentPrice?: number;
  mrp?: string;
  originalPrice?: string;
  discount?: number;
  discountPercent?: number;
  discountPercentage?: number;
  offerDescription?: string;
  dealDescription?: string;
  offerExpiry?: string;
  dealStatus?: 'verified' | 'pending' | 'expired' | 'approved' | string;
  lastUpdated?: string;
  tags: string[];
  uploaderId: string;
  uploaderName: string;
  createdAt: string;
  clicksCount: number;
  monthlyClicks?: Record<string, number>;
}

export interface ClickRecord {
  id: string;
  productId: string;
  productTitle: string;
  store: string;
  timestamp: string;
  uploaderId?: string;
  userAgent?: string;
}

export interface RevenueTier {
  id: 'free' | 'growth' | 'pro' | 'elite';
  name: string;
  minClicks: number;
  maxClicks: number | null;
  platformFee: number; // in INR: 0, 499, 999, 1999
  description: string;
  perks: string[];
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'creator' | 'admin' | 'user';
  avatarUrl?: string;
  isTrustedContributor?: boolean;
  approvedSubmissionCount?: number;
  rejectedSubmissionCount?: number;
  trustScore?: number;
  trustedSince?: string;
  platformFeePaidMonths?: string[]; // e.g. ["2026-09"]
  simulatedClicks?: number | null; // For testing and verifying tier limits
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

export type SortOption =
  | 'best'
  | 'best_deals'
  | 'newest'
  | 'most_clicked'
  | 'price_low'
  | 'price_high'
  | 'alphabetical';
