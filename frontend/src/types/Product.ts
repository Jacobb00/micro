export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stockQuantity: number;
  category: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface ProductFilterParams {
  page?: number;
  pageSize?: number;
  searchTerm?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sortBy?: string;
  sortDesc?: boolean;
}

export interface ProductListResponse {
  products: Product[];
  totalCount: number;
  page: number;
  pageSize: number;
} 