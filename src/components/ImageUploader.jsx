import React, { useState } from 'react';
import cloudinaryConfig from '../CloudinaryConfig';

const ImageUploader = ({ onImageUploaded }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadComplete, setUploadComplete] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Please select a valid image file (JPEG, PNG, GIF, or WEBP)');
      return;
    }
    
    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5MB');
      return;
    }
    
    setError(null);
    
    // Auto-upload when file is selected
    await uploadFile(file);
  };

  const uploadFile = async (file) => {
    setUploading(true);
    setUploadComplete(false);
    setError(null);
    
    try {
      // Create a FormData object to send the file
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', cloudinaryConfig.uploadPreset);
      
      // Upload to Cloudinary directly from the client
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`,
        {
          method: 'POST',
          body: formData
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to upload image');
      }
      
      const data = await response.json();
      
      // Call the parent component's callback with the image data
      onImageUploaded({
        imageUrl: data.secure_url,
        imageId: data.public_id,
        shareUrl: data.secure_url,
        format: data.format,
        width: data.width,
        height: data.height
      });
      
      setUploadComplete(true);
    } catch (error) {
      console.error('Error uploading image:', error);
      setError('Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="image-uploader">
      {error && (
        <div className="text-red-500 text-sm mb-2">{error}</div>
      )}
      
      <div className="flex items-center space-x-2 mb-3">
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100"
          disabled={uploading}
        />
      </div>
      
      {uploading && (
        <div className="mt-2 mb-3">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-blue-600 h-2.5 rounded-full animate-pulse" 
              style={{ width: '100%' }}
            ></div>
          </div>
          <p className="text-sm text-gray-600 mt-1">Uploading image...</p>
        </div>
      )}
      
      {uploadComplete && (
        <div className="text-green-600 text-sm mb-3">
          Image uploaded successfully!
        </div>
      )}
    </div>
  );
};

export default ImageUploader;