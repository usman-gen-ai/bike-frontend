export interface Bike {
  id: number;
  bike_name: string;
  horsepower: string | null;
  gearbox: string | null;
  top_speed: string | null;
  engine_type: string | null;
  frame: string | null;
  description: string | null;
  source_url: string | null;
  raw_data: Record<string, unknown> | null;
  logo_file_id: number | null;
  video_quality: string;
  created_at: string;
  logo?: FileRecord | null;
  images?: FileRecord[];
}

export interface FileRecord {
  id: number;
  bike_id: number;
  kind: 'image' | 'video';
  original_name: string;
  file_name: string;
  s3_key: string;
  mime: string | null;
  size_bytes: number | null;
  created_at: string;
  status?: 'pending' | 'approved' | 'rejected';
  thumbnail_url?: string;
}

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface BikeApiResponse {
  ok: boolean;
  bike?: Bike;
  files?: FileRecord[];
  logo?: FileRecord | null;
  error?: string;
}

export interface BikesListResponse {
  ok: boolean;
  bikes?: Bike[];
  error?: string;
}

export interface UpdateImageStatusRequest {
  file_id: number;
  status: 'approved' | 'rejected';
}

export interface UpdateBikeRequest {
  bike_name?: string;
  horsepower?: string;
  gearbox?: string;
  top_speed?: string;
  engine_type?: string;
  frame?: string;
  description?: string;
  video_quality?: string;
}

export interface TemplatePreviewData {
  bike: Bike;
  selectedImage?: FileRecord;
  templateHtml: string;
}