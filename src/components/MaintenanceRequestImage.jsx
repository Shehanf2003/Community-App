import React, { useState, useEffect } from 'react';
import { X, Maximize, Download } from 'lucide-react';

const MaintenanceRequestImage = ({ imageUrl, altText = "Maintenance request image" }) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Add useEffect to preload image when component mounts
  useEffect(() => {
    if (imageUrl) {
      // Reset states when imageUrl changes
      setIsLoading(true);
      setError(null);
      
      // Preload the image
      const img = new Image();
      img.src = getTransformedUrl(imageUrl, 400); // Preload the thumbnail
      
      img.onload = () => {
        setIsLoading(false);
      };
      
      img.onerror = () => {
        setIsLoading(false);
        setError('Failed to load image');
      };
    }
  }, [imageUrl]);
  
  const handleImageLoad = () => {
    setIsLoading(false);
  };
  
  const handleImageError = () => {
    setIsLoading(false);
    setError('Failed to load image');
  };
  
  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };
  
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
  
  // Make sure we have a valid imageUrl before proceeding
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
        <div className="text-red-500 text-sm">
          {error}
        </div>
      )}
      
      <div className={isLoading ? 'hidden' : ''}>
        <div className="thread-image-container" style={{ width: '400px', height: '300px', overflow: 'hidden' }}>
          <img
            src={isFullScreen ? fullSizeUrl : thumbnailUrl}
            alt={altText}
            className={`w-full h-full object-cover rounded ${isFullScreen ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
            onClick={toggleFullScreen}
            onLoad={handleImageLoad}
            onError={handleImageError}
            loading="lazy"
          />
        </div>
        
        {!isFullScreen && (
          <div className="mt-1 text-xs text-gray-500 flex items-center space-x-2">
            <button 
              onClick={toggleFullScreen}
              className="text-blue-600 hover:underline flex items-center"
            >
              <Maximize className="h-3 w-3 mr-1" />
              View full size
            </button>
            
            <a 
              href={imageUrl}
              download
              className="text-blue-600 hover:underline flex items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <Download className="h-3 w-3 mr-1" />
              Download
            </a>
          </div>
        )}
      </div>
      
      {isFullScreen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={toggleFullScreen}
        >
          <div className="max-w-4xl max-h-full overflow-auto">
            <img
              src={fullSizeUrl}
              alt={altText}
              className="max-w-full max-h-[90vh] object-contain cursor-zoom-out"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="mt-2 text-white text-center flex justify-center space-x-4">
              <button 
                className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 text-white flex items-center"
                onClick={toggleFullScreen}
              >
                <X className="h-4 w-4 mr-1" />
                Close
              </button>
              
              <a 
                href={imageUrl} 
                download 
                className="px-4 py-2 bg-green-600 rounded hover:bg-green-700 text-white flex items-center"
                onClick={(e) => e.stopPropagation()}
              >
                <Download className="h-4 w-4 mr-1" />
                Download
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaintenanceRequestImage;