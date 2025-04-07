import React, { useState, useEffect } from 'react';
import { X, Maximize, Download } from 'lucide-react';

const MaintenanceRequestImage = ({ imageUrl, altText = "Maintenance request image" }) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Add effect to reset loading state when imageUrl changes
  useEffect(() => {
    if (imageUrl) {
      setIsLoading(true);
      setError(null);
    }
  }, [imageUrl]);

  // Get Cloudinary transformations URL for different sizes
  const getTransformedUrl = (baseUrl, width) => {
    // If this is a Cloudinary URL, apply transformations
    if (baseUrl && baseUrl.includes('cloudinary.com')) {
      // Extract parts of the Cloudinary URL
      const urlParts = baseUrl.split('/upload/');
      if (urlParts.length === 2) {
        return `${urlParts[0]}/upload/c_scale,w_${width},q_auto,f_auto/${urlParts[1]}`;
      }
    }
    // Return original URL if not Cloudinary or if URL structure is unexpected
    return baseUrl;
  };

  // Handle image load event
  const handleImageLoad = () => {
    setIsLoading(false);
  };

  // Handle image error event
  const handleImageError = () => {
    setIsLoading(false);
    setError('Failed to load image');
  };

  // Toggle fullscreen view
  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  // Download image
  const downloadImage = (e) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = 'maintenance-image.jpg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // If no image URL is provided, don't render anything
  if (!imageUrl) {
    return null;
  }

  // URLs for different sizes
  const thumbnailUrl = getTransformedUrl(imageUrl, 400);
  const fullSizeUrl = getTransformedUrl(imageUrl, 1200);

  return (
    <div className="maintenance-request-image mb-4">
      {isLoading && (
        <div className="flex justify-center items-center h-40 bg-gray-100 rounded">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {error && (
        <div className="text-red-500 text-sm p-2 bg-red-50 rounded">
          {error}
        </div>
      )}

      <div className={isLoading ? 'hidden' : ''}>
        <div className="relative group">
          <img
            src={thumbnailUrl}
            alt={altText}
            className="max-w-full rounded border border-gray-200 cursor-pointer"
            onClick={toggleFullScreen}
            onLoad={handleImageLoad}
            onError={handleImageError}
            loading="lazy"
          />
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={toggleFullScreen}
              className="bg-gray-800 bg-opacity-70 text-white p-1.5 rounded-full hover:bg-opacity-100 mr-1"
              title="View full size"
            >
              <Maximize size={16} />
            </button>
            <button
              onClick={downloadImage}
              className="bg-gray-800 bg-opacity-70 text-white p-1.5 rounded-full hover:bg-opacity-100"
              title="Download image"
            >
              <Download size={16} />
            </button>
          </div>
        </div>
      </div>

      {isFullScreen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50"
          onClick={toggleFullScreen}
        >
          <div className="relative max-w-4xl max-h-full">
            <img
              src={fullSizeUrl}
              alt={altText}
              className="max-w-full max-h-[90vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <button 
              className="absolute top-4 right-4 bg-gray-800 bg-opacity-70 text-white p-2 rounded-full hover:bg-opacity-100"
              onClick={toggleFullScreen}
            >
              <X size={20} />
            </button>
            <button
              className="absolute bottom-4 right-4 bg-gray-800 bg-opacity-70 text-white p-2 rounded-full hover:bg-opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                downloadImage(e);
              }}
            >
              <Download size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaintenanceRequestImage;