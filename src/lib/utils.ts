import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: unknown[]) {
  return clsx(inputs);
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return 'Unknown';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'approved': return 'bg-green-100 text-green-800';
    case 'rejected': return 'bg-red-100 text-red-800';
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

export function getStatusIcon(status: string): string {
  switch (status) {
    case 'approved': return '✓';
    case 'rejected': return '✗';
    case 'pending': return '⏳';
    default: return '?';
  }
}

export function getS3DirectUrl(s3Key: string): string {
  if (!s3Key) return '';
  const bucket = 'bike-images-v1';
  const region = 'us-east-1';
  return `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`;
}

export function generateImageUrl(s3Key: string): string {
  return getS3DirectUrl(s3Key);
}