import { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon, EyeIcon, PencilIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { api, type FileRecord } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';

interface BikeCardProps {
  bike: {
    id: number;
    bike_name: string;
    horsepower: string | null;
    gearbox: string | null;
    top_speed: string | null;
    engine_type: string | null;
    frame: string | null;
    description: string | null;
    logo?: { s3_key: string; file_name: string; size_bytes: number | null } | null;
    images?: {
      id: number;
      file_name: string;
      s3_key: string;
      size_bytes: number | null;
      status: 'pending' | 'approved' | 'rejected';
    }[];
  };
  onImageStatusChange: (fileId: number, status: 'approved' | 'rejected') => void;
  onOpenDetail: (bikeId: number) => void;
  onOpenEdit: (bikeId: number) => void;
}

export const BikeCard = ({
  bike,
  onImageStatusChange,
  onOpenDetail,
  onOpenEdit,
}: BikeCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Record<number, 'approved' | 'rejected'>>({});
  const [hasPendingChanges, setHasPendingChanges] = useState(false);

  const handleStatusChange = (fileId: number, status: 'approved' | 'rejected') => {
    setPendingChanges(prev => ({ ...prev, [fileId]: status }));
    setHasPendingChanges(true);
  };

  const handleSubmitChanges = async () => {
    const updates = Object.entries(pendingChanges).map(([fileId, status]) => ({
      file_id: parseInt(fileId),
      status: status as 'approved' | 'rejected',
    }));

    try {
      await api.bulkUpdateImageStatus(updates);
      // Refresh would be handled by parent
      setPendingChanges({});
      setHasPendingChanges(false);
      alert('Changes saved successfully!');
    } catch (error) {
      console.error('Failed to update:', error);
      alert('Failed to save changes');
    }
  };

  const handleCancelChanges = () => {
    setPendingChanges({});
    setHasPendingChanges(false);
  };

  const getImageStatus = (image: { id: number; status: string }) => {
    if (pendingChanges[image.id]) return pendingChanges[image.id];
    return image.status;
  };

  const images = bike.images || [];

  if (images.length === 0) {
    return (
      <Card className="mb-6">
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {bike.logo && (
              <img
                src={api.getS3DirectUrl(bike.logo.s3_key)}
                alt={`${bike.bike_name} logo`}
                className="h-12 w-auto object-contain"
              />
            )}
            <div>
              <h3 className="text-xl font-semibold text-gray-900">{bike.bike_name}</h3>
              <p className="text-sm text-gray-500">No images available</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => onOpenEdit(bike.id)}>
            <PencilIcon className="h-4 w-4 mr-1" />
            Edit Info
          </Button>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-wrap items-center justify-between gap-4 pb-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {bike.logo && (
            <img
              src={api.getS3DirectUrl(bike.logo.s3_key)}
              alt={`${bike.bike_name} logo`}
              className="h-12 w-auto object-contain"
            />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-semibold text-gray-900 truncate">{bike.bike_name}</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-expanded={isExpanded}
                aria-controls={`bike-images-${bike.id}`}
              >
                {isExpanded ? (
                  <>
                    <ChevronUpIcon className="h-5 w-5" />
                    <span className="sr-only">Collapse</span>
                  </>
                ) : (
                  <>
                    <ChevronDownIcon className="h-5 w-5" />
                    <span className="sr-only">Expand</span>
                  </>
                )}
              </Button>
            </div>
            <p className="text-sm text-gray-500">
              {bike.horsepower || 'N/A'} • {bike.gearbox || 'N/A'} • {bike.engine_type || 'N/A'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenDetail(bike.id)}>
            <EyeIcon className="h-4 w-4 mr-1" />
            Preview
          </Button>
          <Button variant="outline" size="sm" onClick={() => onOpenEdit(bike.id)}>
            <PencilIcon className="h-4 w-4 mr-1" />
            Edit Info
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div
          id={`bike-images-${bike.id}`}
          className={cn(
            'transition-all duration-300 ease-in-out overflow-hidden',
            isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
          )}
        >
          <div className="pt-4 border-t border-gray-100">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-lg font-medium text-gray-900">
                Images ({images.length})
              </h4>
              {hasPendingChanges && (
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={handleCancelChanges}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleSubmitChanges}>
                    Submit Changes
                  </Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {images.map((image) => {
                const currentStatus = getImageStatus(image);
                const isPending = image.id in pendingChanges;

                return (
                  <div
                    key={image.id}
                    className={cn(
                      'relative group bg-white rounded-xl border border-gray-200 overflow-hidden',
                      'transition-all duration-200',
                      isPending && 'ring-2 ring-primary'
                    )}
                  >
                    <div className="aspect-square relative overflow-hidden bg-gray-50">
                      <img
                        src={api.getS3DirectUrl(image.s3_key)}
                        alt={image.file_name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                        <span className="text-white text-sm font-medium px-3 py-1 bg-black/50 rounded-full">
                          View
                        </span>
                      </div>
                    </div>

                    <div className="p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium truncate max-w-[120px]">{image.file_name}</span>
                        <Badge variant={getStatusColor(currentStatus)}>
                          {getStatusIcon(currentStatus)} {currentStatus}
                        </Badge>
                      </div>

                      <div className="text-xs text-gray-500">
                        {image.size_bytes ? `Size: ${formatBytes(image.size_bytes)}` : 'Size: Unknown'}
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          className={cn(
                            'flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors',
                            getStatusColor('approved'),
                            currentStatus === 'approved' && 'bg-green-600 text-white',
                            currentStatus !== 'approved' && 'hover:bg-green-50'
                          )}
                          onClick={() => handleStatusChange(image.id, 'approved')}
                          disabled={currentStatus === 'approved' && !isPending}
                        >
                          Approve
                        </button>
                        <button
                          className={cn(
                            'flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors',
                            getStatusColor('rejected'),
                            currentStatus === 'rejected' && 'bg-red-600 text-white',
                            currentStatus !== 'rejected' && 'hover:bg-red-50'
                          )}
                          onClick={() => handleStatusChange(image.id, 'rejected')}
                          disabled={currentStatus === 'rejected' && !isPending}
                        >
                          Reject
                        </button>
                      </div>

                      {isPending && (
                        <div className="absolute top-2 right-2">
                          <span className="bg-primary text-white text-xs px-2 py-0.5 rounded-full">
                            Pending
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {images.length > 6 && (
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-500">
                  Showing all {images.length} images
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return 'Unknown';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function getStatusColor(status: string): 'default' | 'success' | 'danger' | 'warning' | 'info' | 'pending' {
  switch (status) {
    case 'approved': return 'success';
    case 'rejected': return 'danger';
    case 'pending': return 'pending';
    default: return 'default';
  }
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'approved': return '✓';
    case 'rejected': return '✗';
    case 'pending': return '⏳';
    default: return '?';
  }
}