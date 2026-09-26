import { useState, useEffect } from 'react';
import { XMarkIcon, PencilIcon } from '@heroicons/react/24/outline';
import { api, type Bike } from '@lib/api';
import { Modal } from '@components/ui/Modal';
import { Button } from '@components/ui/Button';
import { Input } from '@components/ui/Input';
import { Textarea } from '@components/ui/Textarea';
import { Select } from '@components/ui/Select';
import { Label } from '@components/ui/Label';
import { Card, CardContent, CardHeader } from '@components/ui/Card';
import { useFormik } from 'formik';
import * as Yup from 'yup';

interface EditBikeModalProps {
  bike: Bike | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedBike: Bike) => void;
}

const validationSchema = Yup.object({
  bike_name: Yup.string().required('Bike name is required').max(100, 'Max 100 characters'),
  horsepower: Yup.string().max(50, 'Max 50 characters'),
  gearbox: Yup.string().max(50, 'Max 50 characters'),
  top_speed: Yup.string().max(50, 'Max 50 characters'),
  engine_type: Yup.string().max(100, 'Max 100 characters'),
  frame: Yup.string().max(100, 'Max 100 characters'),
  description: Yup.string().max(2000, 'Max 2000 characters'),
  video_quality: Yup.string().oneOf(['480p', '720p', '1080p']).required('Quality is required'),
});

export const EditBikeModal = ({ bike, isOpen, onClose, onSave }: EditBikeModalProps) => {
  const [loading, setLoading] = useState(false);

  const formik = useFormik<Record<string, unknown>>({
    initialValues: {
      bike_name: '',
      horsepower: '',
      gearbox: '',
      top_speed: '',
      engine_type: '',
      frame: '',
      description: '',
      video_quality: '720p',
    },
    validationSchema: Yup.object({
      bike_name: Yup.string().required('Bike name is required').max(100, 'Max 100 characters'),
      horsepower: Yup.string().max(50, 'Max 50 characters'),
      gearbox: Yup.string().max(50, 'Max 50 characters'),
      top_speed: Yup.string().max(50, 'Max 50 characters'),
      engine_type: Yup.string().max(100, 'Max 100 characters'),
      frame: Yup.string().max(100, 'Max 100 characters'),
      description: Yup.string().max(2000, 'Max 2000 characters'),
      video_quality: Yup.string().oneOf(['480p', '720p', '1080p']).required('Quality is required'),
    }),
    onSubmit: async (values) => {
      if (!bike) return;
      setLoading(true);
      try {
        const updated = await api.updateBike(bike.id, values);
        onSave(updated);
        onClose();
      } catch (error) {
        console.error('Failed to update bike:', error);
        alert('Failed to update bike. Please try again.');
      } finally {
        setLoading(false);
      }
    },
  });

  useEffect(() => {
    if (isOpen && bike) {
      formik.setValues({
        bike_name: bike.bike_name || '',
        horsepower: bike.horsepower || '',
        gearbox: bike.gearbox || '',
        top_speed: bike.top_speed || '',
        engine_type: bike.engine_type || '',
        frame: bike.frame || '',
        description: bike.description || '',
        video_quality: bike.video_quality || '720p',
      });
    }
  }, [isOpen, bike]);

  if (!bike) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Bike Information"
      description="Modify bike details and save changes"
      size="lg"
    >
      <form onSubmit={formik.handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Basic Information</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="bike_name" required>Bike Name</Label>
                <Input
                  id="bike_name"
                  name="bike_name"
                  value={formik.values.bike_name as string}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={!!(formik.touched.bike_name && formik.errors.bike_name)}
                  placeholder="e.g., 2015 Honda SH300i"
                />
              </div>
              <div>
                <Label htmlFor="video_quality" required>Video Quality</Label>
                <Select
                  id="video_quality"
                  name="video_quality"
                  value={formik.values.video_quality as string}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={!!(formik.touched.video_quality && formik.errors.video_quality)}
                >
                  <option value="480p">480p (Fast)</option>
                  <option value="720p">720p (Balanced)</option>
                  <option value="1080p">1080p (High Quality)</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="horsepower">Horsepower</Label>
                <Input
                  id="horsepower"
                  name="horsepower"
                  value={formik.values.horsepower as string}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  placeholder="e.g., 26.8 HP @ 8250 RPM"
                />
              </div>
              <div>
                <Label htmlFor="gearbox">Gearbox</Label>
                <Input
                  id="gearbox"
                  name="gearbox"
                  value={formik.values.gearbox as string}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  placeholder="e.g., automatic, V-Matic"
                />
              </div>
              <div>
                <Label htmlFor="top_speed">Top Speed</Label>
                <Input
                  id="top_speed"
                  name="top_speed"
                  value={formik.values.top_speed as string}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  placeholder="e.g., Not found"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="engine_type">Engine Type</Label>
                <Input
                  id="engine_type"
                  name="engine_type"
                  value={formik.values.engine_type as string}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  placeholder="e.g., four-stroke, liquid-cooled..."
                />
              </div>
              <div>
                <Label htmlFor="frame">Frame</Label>
                <Input
                  id="frame"
                  name="frame"
                  value={formik.values.frame as string}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  placeholder="e.g., steel underbone"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={formik.values.description as string}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                rows={4}
                placeholder="General information, photos, engines and tech specs..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Logo Preview */}
        {bike.logo && (
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Current Logo</h3>
            </CardHeader>
            <div className="p-6">
              <img
                src={api.getS3DirectUrl(bike.logo.s3_key)}
                alt={`${bike.bike_name} logo`}
                className="h-20 w-auto object-contain border border-gray-200 rounded-lg"
              />
              <p className="mt-2 text-sm text-gray-500">{bike.logo.file_name}</p>
            </div>
          </Card>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default EditBikeModal;