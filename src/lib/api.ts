import axios, { type AxiosInstance, type AxiosError } from 'axios';
import type { Bike, FileRecord, BikeApiResponse, BikesListResponse, UpdateImageStatusRequest } from '@/types/index';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3002';
const BIKES_API_BASE = import.meta.env.VITE_BIKES_API_BASE || 'https://bkkautomation.duckdns.org';

export { type Bike, type FileRecord }

// ── Bikes API types ────────────────────────────────────────────────────────

export interface MainModel {
  id: number
  name: string
  slug: string
  productionModelsCount: number
  generationsCount: number
}

export interface ProductionModel {
  id: number
  name: string
  slug: string
  status: string
  generationsCount: number
  main_model_id: number
}

export type AssetStatus = 'not_ready' | 'ready' | 'processing' | 'completed' | 'failed'

export interface GenerationAssetState {
  video_status: AssetStatus
  thumbnail_status: AssetStatus
  selection_touched_at: string | null
  images_count: number
  video_selected_count: number
  thumbnail_selected_count: number
  can_mark_video_ready: boolean
  can_mark_thumbnail_ready: boolean
}

export interface GenerationItem extends GenerationAssetState {
  id: number
  title: string
  url: string
  status: string
  production_model_id: number
  detail: GenerationDetail | null
}

export interface GalleryImage {
  id: number
  generation_id: number
  file_name: string
  url: string | null
  mime_type: string | null
  file_size: number | null
  is_video_source: boolean
  is_thumbnail_source: boolean
  is_replaced: boolean
}

export interface GalleryResponse {
  generation: { id: number; title: string } & GenerationAssetState
  images: GalleryImage[]
}

export type AssetTarget = 'video' | 'thumbnail'

export interface GenerationImage {
  id: number
  fileName: string
  s3Path: string
  mimeType: string | null
  fileSize: number | null
  originalUrl: string | null
}

export interface GenerationDetail {
  id: number
  generationId: number
  bikeName: string | null
  make: string | null
  model: string | null
  year: string | null
  category: string | null
  engineType: string | null
  displacementCc: string | null
  cylinders: string | null
  boreStroke: string | null
  compressionRatio: string | null
  valveSystem: string | null
  fuelSystem: string | null
  coolingSystem: string | null
  lubrication: string | null
  starter: string | null
  powerHp: string | null
  powerKw: string | null
  torqueNm: string | null
  torqueLbft: string | null
  topSpeed: string | null
  gearbox: string | null
  clutch: string | null
  finalDrive: string | null
  frameType: string | null
  frontSuspension: string | null
  rearSuspension: string | null
  frontWheelTravel: string | null
  rearWheelTravel: string | null
  frontBrake: string | null
  rearBrake: string | null
  abs: string | null
  frontTyre: string | null
  rearTyre: string | null
  lengthMm: string | null
  widthMm: string | null
  heightMm: string | null
  seatHeightMm: string | null
  wheelbaseMm: string | null
  groundClearanceMm: string | null
  dryWeightKg: string | null
  wetWeightKg: string | null
  fuelCapacityL: string | null
  fuelConsumption: string | null
  rangeKm: string | null
  reserveL: string | null
  alternator: string | null
  battery: string | null
  colors: string | null
  priceMsrp: string | null
  rating: string | null
  reviewCount: string | null
  description: string | null
  sourceUrl: string | null
}

export interface GenerationFull {
  id: number
  title: string
  url: string
  status: string
  production_model: { id: number; name: string; slug: string }
  main_model: { id: number; name: string; slug: string }
  detail: GenerationDetail | null
  images: GenerationImage[]
}


// ── Video tool types ───────────────────────────────────────────────────────

export type VideoScope = 'main_model' | 'production_model' | 'generation' | 'custom'
export type VideoOrientation = 'landscape' | 'portrait'
export type VideoQuality = '480p' | '720p' | '1080p' | '2k' | '4k' | '8k'
export type VideoStatus = 'queued' | 'processing' | 'completed' | 'failed'

export interface VideoItemRecord {
  position: number
  generation_id: number
  production_model_id: number | null
  title: string
  bike_name: string | null
  images_count: number
  start_second: number | null
  end_second: number | null
}

export interface VideoRecord {
  id: number
  scope: VideoScope
  orientation: VideoOrientation
  quality: VideoQuality
  resolution: string | null
  status: VideoStatus
  progress: number
  attempts: number
  error_message: string | null
  generations_count: number
  generations_preview?: string[]
  duration_seconds: number | null
  main_model: { id: number; name: string; slug: string } | null
  production_model: { id: number; name: string; slug: string } | null
  generation: { id: number; title: string } | null
  file: { id: number; file_name: string; file_size: number | null; mime_type: string | null; url: string; download_url?: string | null } | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  items?: VideoItemRecord[]
}

export interface VideoListFilters {
  page?: number
  limit?: number
  scope?: VideoScope
  orientation?: VideoOrientation
  status?: VideoStatus
  main_model_id?: number
  production_model_id?: number
  generation_id?: number
}

export interface VideoListResponse {
  videos: VideoRecord[]
  meta: { total: number; per_page: number; current_page: number; last_page: number }
}

export interface CreateVideoPayload {
  scope: VideoScope
  /** main_model | production_model | generation */
  target_id?: number
  /** custom: every ticked generation, rendered as one video */
  generation_ids?: number[]
  orientation: VideoOrientation
  quality: VideoQuality
}

export interface CreateVideoResponse {
  video: VideoRecord
  skipped_generations: { generation_id: number; title: string; reason: string }[]
}

// ── Bikes API client ───────────────────────────────────────────────────────

class BikesApiClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: `${BIKES_API_BASE}/api/v1/bikes`,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  async getMainModels(): Promise<MainModel[]> {
    const res = await this.client.get<{ status: boolean; data: MainModel[] }>('/main-models')
    return res.data.data
  }

  async getProductionModels(mainModelSlug: string): Promise<{ main_model: MainModel; production_models: ProductionModel[] }> {
    const res = await this.client.get(`/main-models/${mainModelSlug}/production-models`)
    return res.data.data
  }

  async getGenerations(productionModelSlug: string): Promise<{ production_model: ProductionModel; generations: GenerationItem[] }> {
    const res = await this.client.get(`/production-models/${productionModelSlug}/generations`)
    return res.data.data
  }

  async getGenerationDetail(generationId: number): Promise<GenerationFull> {
    const res = await this.client.get(`/generations/${generationId}`)
    return res.data.data
  }
}

export const bikesApi = new BikesApiClient()

// ── Auth (token kept in localStorage) ──────────────────────────────────────

const TOKEN_KEY = 'bike_admin_token'

export const auth = {
  getToken: (): string | null => localStorage.getItem(TOKEN_KEY),
  setToken: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
  isLoggedIn: (): boolean => !!localStorage.getItem(TOKEN_KEY),

  async login(email: string, password: string): Promise<void> {
    const res = await axios.post(`${BIKES_API_BASE}/api/v1/auth/login`, { email, password })
    const token = res.data?.data?.token
    if (!token) throw new Error('Login failed: no token received')
    auth.setToken(token)
  },

  async logout(): Promise<void> {
    try {
      await axios.post(`${BIKES_API_BASE}/api/v1/account/logout`, null, {
        headers: { Authorization: `Bearer ${auth.getToken()}` },
      })
    } catch {
      /* token is dropped locally either way */
    }
    auth.clear()
  },
}

/** Human readable message from an axios / backend error. */
export const getErrorMessage = (err: unknown): string => {
  const e = err as AxiosError<any>
  return (
    e?.response?.data?.errors?.[0]?.message ||
    e?.response?.data?.message ||
    (err instanceof Error ? err.message : 'Something went wrong')
  )
}

// ── Admin (gallery / workflow) API — requires login ────────────────────────

class AdminApiClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: `${BIKES_API_BASE}/api/v1/admin`,
      timeout: 60000,
    })

    this.client.interceptors.request.use((config) => {
      const token = auth.getToken()
      if (token) config.headers.Authorization = `Bearer ${token}`
      return config
    })

    this.client.interceptors.response.use(
      (r) => r,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          auth.clear()
          window.location.assign('/login')
        }
        return Promise.reject(error)
      }
    )
  }

  async getGallery(generationId: number): Promise<GalleryResponse> {
    const res = await this.client.get(`/generations/${generationId}/images`)
    return res.data.data
  }

  async updateSelection(
    generationId: number,
    target: AssetTarget,
    imageIds: number[]
  ): Promise<GenerationAssetState & { id: number }> {
    const res = await this.client.patch(`/generations/${generationId}/images/selection`, {
      [target]: imageIds,
    })
    return res.data.data
  }

  async markReady(
    generationId: number,
    target: AssetTarget
  ): Promise<GenerationAssetState & { id: number }> {
    const res = await this.client.patch(`/generations/${generationId}/${target}-ready`)
    return res.data.data
  }

  async replaceImage(
    fileId: number,
    file: File
  ): Promise<{ image: GalleryImage; used_in: AssetTarget[]; notice: string }> {
    const form = new FormData()
    form.append('image', file)
    const res = await this.client.put(`/files/${fileId}/replace`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.data
  }

  // ── Videos ──────────────────────────────────────────────────────────────
  async createVideo(payload: CreateVideoPayload): Promise<CreateVideoResponse> {
    const res = await this.client.post('/videos', payload)
    return res.data.data
  }

  async listVideos(filters: VideoListFilters = {}): Promise<VideoListResponse> {
    const res = await this.client.get('/videos', { params: filters })
    return res.data.data
  }

  async getVideo(id: number): Promise<VideoRecord> {
    const res = await this.client.get(`/videos/${id}`)
    return res.data.data
  }

  async retryVideo(id: number): Promise<VideoRecord> {
    const res = await this.client.post(`/videos/${id}/retry`)
    return res.data.data
  }
}

export const adminApi = new AdminApiClient()

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  async getBikes() {
    const response = await this.client.get<{ ok: boolean; bikes?: Bike[]; error?: string }>('/api/bikes');
    if (!response.data.ok) throw new Error(response.data.error || 'Failed to fetch bikes');
    return response.data.bikes || [];
  }

  async getBike(id: number) {
    const response = await this.client.get<{ ok: boolean; bike?: Bike; files?: FileRecord[]; logo: FileRecord | null; error?: string }>(`/api/bikes/${id}`);
    if (!response.data.ok) throw new Error(response.data.error || 'Failed to fetch bike');
    return {
      bike: response.data.bike!,
      files: response.data.files || [],
      logo: response.data.logo || null,
    };
  }

  async updateImageStatus(fileId: number, status: 'approved' | 'rejected'): Promise<void> {
    const response = await this.client.patch(`/api/bikes/images/${fileId}/status`, { status } as UpdateImageStatusRequest);
    if (!response.data.ok) throw new Error(response.data.error || 'Failed to update image status');
  }

  async bulkUpdateImageStatus(updates: UpdateImageStatusRequest[]): Promise<void> {
    const response = await this.client.post('/api/bikes/images/bulk-status', { updates });
    if (!response.data.ok) throw new Error(response.data.error || 'Failed to bulk update image status');
  }

  async updateBike(id: number, data: Record<string, unknown>) {
    const response = await this.client.put<BikeApiResponse>(`/api/bikes/${id}`, data);
    if (!response.data.ok) throw new Error(response.data.error || 'Failed to update bike');
    return response.data.bike!;
  }

  async getTemplatePreview(bikeId: number, imageId?: number): Promise<string> {
    const response = await this.client.get(`/api/bikes/${bikeId}/template-preview`, {
      params: { image_id: imageId },
      responseType: 'text',
    });
    return response.data;
  }

  getImageUrl(s3Key: string): string {
    return `${API_BASE.replace('/api', '')}/proxy/${s3Key}`;
  }

  getS3DirectUrl(s3Key: string): string {
    const bucket = 'bike-images-v1';
    const region = 'us-east-1';
    return `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`;
  }
}

export const api = new ApiClient;