import { useState, useEffect } from 'react';
import { XMarkIcon, EyeIcon, PencilIcon, PhotoIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { api, type Bike, type FileRecord } from '@lib/api';
import { generateImageUrl, formatBytes, cn } from '@lib/utils';
import { Modal } from '@components/ui/Modal';
import { Button } from '@components/ui/Button';
import { Card, CardContent, CardHeader } from '@components/ui/Card';
import { Badge } from '@components/ui/Badge';

interface BikeDetailModalProps {
  bike: Bike | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
}

export const BikeDetailModal = ({ bike, isOpen, onClose, onEdit }: BikeDetailModalProps) => {
  const [templateHtml, setTemplateHtml] = useState<string>('');
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [selectedImage, setSelectedImage] = useState<FileRecord | null>(null);
  const [showFullImage, setShowFullImage] = useState(false);

  const approvedImages = bike?.images?.filter(img => img.status === 'approved') || [];
  const firstApprovedImage = approvedImages[0];

  useEffect(() => {
    if (isOpen && bike) {
      loadTemplate();
    }
  }, [isOpen, bike?.id]);

  const loadTemplate = async () => {
    if (!bike) return;
    setLoadingTemplate(true);
    try {
      const html = await api.getTemplatePreview(bike.id, selectedImage?.id || firstApprovedImage?.id);
      setTemplateHtml(html);
    } catch (error) {
      console.error('Failed to load template:', error);
    } finally {
      setLoadingTemplate(false);
    }
  };

  const handleImageClick = (image: FileRecord) => {
    setSelectedImage(image);
    loadTemplate();
  };

  if (!bike) return null;

  const getImageUrl = (s3Key: string) => api.getS3DirectUrl(s3Key);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={bike.bike_name}
      description={`${bike.horsepower || 'N/A'} • ${bike.gearbox || 'N/A'} • ${bike.engine_type || 'N/A'}`}
      size="xl"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Template Preview */}
        <div className="lg:col-span-2 space-y-6">
          {/* Template Preview */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Template Preview</h3>
              <div className="flex items-center gap-2">
                <Badge variant={bike.video_quality === '480p' ? 'info' : bike.video_quality === '720p' ? 'success' : 'warning'}>
                  {bike.video_quality}
                </Badge>
                {bike.logo && (
                  <Badge variant="info">Logo</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative aspect-[16/9] bg-gray-100 rounded-lg overflow-hidden">
                {loadingTemplate ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
                  </div>
                ) : templateHtml ? (
                  <div className="absolute inset-0" dangerouslySetInnerHTML={{ __html: templateHtml }} />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                    <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-2 text-center">No template preview available</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Selected Image Details */}
          {selectedImage && (
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Selected Image Details</h3>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <img
                    src={generateImageUrl(selectedImage.s3_key)}
                    alt={selectedImage.file_name}
                    className="w-full aspect-square object-cover rounded-lg border border-gray-200"
                  />
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-500">File Name</label>
                      <p className="text-sm text-gray-900 truncate">{selectedImage.file_name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">File Size</label>
                      <p className="text-sm text-gray-900">{formatBytes(selectedImage.size_bytes)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Status</label>
                      <Badge variant={selectedImage.status === 'approved' ? 'success' : selectedImage.status === 'rejected' ? 'danger' : 'warning'}>
                        {selectedImage.status}
                      </Badge>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">S3 Key</label>
                      <p className="text-sm text-gray-900 font-mono truncate">{selectedImage.s3_key}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Info & Images */}
        <div className="space-y-6">
          {/* Bike Info */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{bike.bike_name}</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {bike.horsepower || 'N/A'} • {bike.gearbox || 'N/A'} • {bike.engine_type || 'N/A'}
                  </p>
                </div>
                <Badge variant={bike.video_quality === '480p' ? 'info' : bike.video_quality === '720p' ? 'success' : 'warning'}>
                  {bike.video_quality}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Horsepower</label>
                  <p className="text-sm text-gray-900">{bike.horsepower || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Gearbox</label>
                  <p className="text-sm text-gray-900">{bike.gearbox || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Top Speed</label>
                  <p className="text-sm text-gray-900">{bike.top_speed || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Engine Type</label>
                  <p className="text-sm text-gray-900">{bike.engine_type || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Frame</label>
                  <p className="text-sm text-gray-900">{bike.frame || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Quality</label>
                  <Badge variant={bike.video_quality === '480p' ? 'info' : bike.video_quality === '720p' ? 'success' : 'warning'}>
                    {bike.video_quality}
                  </Badge>
                </div>
              </div>

              {bike.description && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Description</label>
                  <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{bike.description}</p>
                </div>
              )}

              {bike.source_url && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Source URL</label>
                  <a
                    href={bike.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 text-sm text-primary hover:underline"
                  >
                    {bike.source_url}
                  </a>
                </div>
              )}

              {bike.logo && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Manufacturer Logo</label>
                  <div className="mt-1">
                    <img
                      src={api.getS3DirectUrl(bike.logo.s3_key)}
                      alt={`${bike.bike_name} logo`}
                      className="h-16 w-auto object-contain border border-gray-200 rounded-lg"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {bike.logo.file_name} • {formatBytes(bike.logo.size_bytes)}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <Button variant="primary" onClick={onEdit}>
                  <PencilIcon className="h-4 w-4 mr-2" />
                  Edit Info
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Images Grid */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                Images ({bike.images?.length || 0})
              </h3>
            </CardHeader>
            <CardContent>
              {bike.images && bike.images.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {bike.images.map(image => (
                    <div
                      key={image.id}
                      className={cn(
                        'relative group bg-white rounded-xl border border-gray-200 overflow-hidden',
                        'transition-all duration-200',
                        image.status === 'approved' && 'ring-2 ring-green-500',
                        image.status === 'rejected' && 'ring-2 ring-red-500'
                      )}
                      onClick={() => handleImageClick(image)}
                    >
                      <div className="aspect-square relative overflow-hidden bg-gray-50">
                        <img
                          src={generateImageUrl(image.s3_key)}
                          alt={image.file_name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                          <span className="text-white text-sm font-medium px-3 py-1 bg-black/50 rounded-full">
                            Select
                          </span>
                        </div>
                        <div className="absolute top-2 right-2">
                          <Badge variant={image.status === 'approved' ? 'success' : image.status === 'rejected' ? 'danger' : 'pending'}>
                            {image.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="p-2 text-center text-xs text-gray-600 truncate">
                        {image.file_name}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2">No images available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Full Screen Image Modal */}
      {showFullImage && selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setShowFullImage(false)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300"
            onClick={() => setShowFullImage(false)}
          >
            <XMarkIcon className="h-8 w-8" />
          </button>
          <img
            src={generateImageUrl(selectedImage.s3_key)}
            alt={selectedImage.file_name}
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </Modal>
  );
};

export default BikeDetailModal;