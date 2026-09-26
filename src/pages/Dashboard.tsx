import { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, ArrowPathIcon, ServerIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';
import { api, type Bike } from '@lib/api';
import { BikeCard } from '@components/BikeCard';
import { Button } from '@components/ui/Button';
import { Input } from '@components/ui/Input';
import { Select } from '@components/ui/Select';
import { Card } from '@components/ui/Card';
import { Badge } from '@components/ui/Badge';
import { Modal } from '@components/ui/Modal';
import { BikeDetailModal } from './BikeDetailModal';
import { EditBikeModal } from './EditBikeModal';
import { cn } from '@lib/utils';

const BACKEND_URL = '/backend';

export const Dashboard = () => {
  const [bikes, setBikes] = useState<Bike[]>([]);
  const [filteredBikes, setFilteredBikes] = useState<Bike[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [qualityFilter, setQualityFilter] = useState<string>('all');
  const [selectedBike, setSelectedBike] = useState<Bike | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingBike, setEditingBike] = useState<Bike | null>(null);
  const [backendStatus, setBackendStatus] = useState<'idle' | 'checking' | 'online' | 'offline'>('idle');

  const checkBackendStatus = async () => {
    setBackendStatus('checking');
    try {
      const res = await fetch(`${BACKEND_URL}`, { signal: AbortSignal.timeout(5000) });
      setBackendStatus(res.ok ? 'online' : 'offline');
    } catch {
      setBackendStatus('offline');
    }
  };

  const fetchBikes = async () => {
    setLoading(true);
    try {
      const data = await api.getBikes();
      setBikes(data);
      setFilteredBikes(data);
    } catch (error) {
      console.error('Failed to fetch bikes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBikes();
  }, []);

  useEffect(() => {
    let result = bikes;
    if (search) {
      result = result.filter(bike =>
        bike.bike_name.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (qualityFilter !== 'all') {
      result = result.filter(bike => bike.video_quality === qualityFilter);
    }
    setFilteredBikes(result);
  }, [search, qualityFilter, bikes]);

  const handleImageStatusChange = async (bikeId: number, fileId: number, status: 'approved' | 'rejected') => {
    try {
      await api.updateImageStatus(fileId, status);
      // Update local state
      setBikes(prev => prev.map(bike => {
        if (bike.id !== bikeId) return bike;
        return {
          ...bike,
          images: bike.images?.map(img =>
            img.id === fileId ? { ...img, status } : img
          ),
        };
      }));
      // Also update filtered
      setFilteredBikes(prev => prev.map(bike => {
        if (bike.id !== bikeId) return bike;
        return {
          ...bike,
          images: bike.images?.map(img =>
            img.id === fileId ? { ...img, status } : img
          ),
        };
      }));
    } catch (error) {
      console.error('Failed to update image status:', error);
      alert('Failed to update image status');
    }
  };

  const handleOpenDetail = (bike: Bike) => {
    setSelectedBike(bike);
    setDetailModalOpen(true);
  };

  const handleOpenEdit = (bike: Bike) => {
    setEditingBike(bike);
    setEditModalOpen(true);
  };

  const handleBikeUpdated = async (updatedBike: Bike) => {
    setBikes(prev => prev.map(b => b.id === updatedBike.id ? updatedBike : b));
    setFilteredBikes(prev => prev.map(b => b.id === updatedBike.id ? updatedBike : b));
    if (selectedBike?.id === updatedBike.id) {
      setSelectedBike(updatedBike);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  const handleQualityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setQualityFilter(e.target.value);
  };

  const handleRefresh = () => {
    fetchBikes();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110 4m0-4v2m0-6V4" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Bike Admin Panel</h1>
            </div>

            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="relative hidden sm:block w-72">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search bikes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              {/* Quality Filter */}
              <Select
                value={qualityFilter}
                onChange={(e) => setQualityFilter(e.target.value)}
                className="w-40"
              >
                <option value="all">All Qualities</option>
                <option value="480p">480p</option>
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
              </Select>

              <Button variant="outline" size="sm" onClick={fetchBikes} disabled={loading}>
                <ArrowPathIcon className="h-4 w-4 mr-1" />
                Refresh
              </Button>

              {/* Backend Status Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={checkBackendStatus}
                disabled={backendStatus === 'checking'}
                className={cn(
                  'flex items-center gap-1.5',
                  backendStatus === 'online' && 'border-green-500 text-green-600',
                  backendStatus === 'offline' && 'border-red-500 text-red-600'
                )}
              >
                {backendStatus === 'checking' ? (
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                ) : backendStatus === 'online' ? (
                  <CheckCircleIcon className="h-4 w-4 text-green-500" />
                ) : backendStatus === 'offline' ? (
                  <XCircleIcon className="h-4 w-4 text-red-500" />
                ) : (
                  <ServerIcon className="h-4 w-4" />
                )}
                {backendStatus === 'checking'
                  ? 'Checking...'
                  : backendStatus === 'online'
                  ? 'Backend Online'
                  : backendStatus === 'offline'
                  ? 'Backend Offline'
                  : 'Check Backend'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Bar */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-6 text-sm text-gray-600">
            <span className="font-medium">Total Bikes:</span>
            <Badge variant="info">{bikes.length}</Badge>
            <span className="font-medium ml-4">Filtered:</span>
            <Badge variant="success">{filteredBikes.length}</Badge>
          </div>
        </div>

        {/* Bikes List */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-32 bg-gray-200 rounded-t-xl" />
                <div className="p-6 space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                </div>
              </Card>
            ))}
          </div>
        ) : filteredBikes.length === 0 ? (
          <div className="text-center py-16">
            <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No bikes found</h3>
            <p className="mt-2 text-gray-500">
              {search ? 'Try adjusting your search or filters' : 'No bikes in database yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredBikes.map(bike => (
              <BikeCard
                key={bike.id}
                bike={{
                  ...bike,
                  logo: bike.logo ? {
                    s3_key: bike.logo?.s3_key || '',
                    file_name: bike.logo?.file_name || '',
                    size_bytes: bike.logo?.size_bytes || null,
                  } : null,
                  images: bike.images?.map(img => ({
                    id: img.id,
                    file_name: img.file_name,
                    s3_key: img.s3_key,
                    size_bytes: img.size_bytes,
                    status: img.status || 'pending',
                  })) || [],
                }}
                onImageStatusChange={(fileId, status) => handleImageStatusChange(bike.id, fileId, status)}
                onOpenDetail={() => {
                  setSelectedBike(bike);
                  setDetailModalOpen(true);
                }}
                onOpenEdit={() => {
                  setEditingBike(bike);
                  setEditModalOpen(true);
                }}
              />
            ))}
          </div>
        )}

        {/* Detail Modal */}
        <BikeDetailModal
          bike={selectedBike}
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          onEdit={() => {
            setEditingBike(selectedBike!);
            setDetailModalOpen(false);
            setEditModalOpen(true);
          }}
        />

        {/* Edit Modal */}
        <EditBikeModal
          bike={editingBike}
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          onSave={handleBikeUpdated}
        />
      </main>
    </div>
  );
};

export default Dashboard;