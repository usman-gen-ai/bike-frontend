import axios, { type AxiosInstance, type AxiosError } from 'axios';
import type { Bike, FileRecord, BikeApiResponse, BikesListResponse, UpdateImageStatusRequest } from '@/types/index';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3002';

export { type Bike, type FileRecord };

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