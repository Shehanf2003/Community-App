import React, { useState, useEffect, useCallback } from 'react';
import { getFirestore, collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { AlertTriangle, CheckCircle, Wrench, MapPin, X, Info, Loader2, Camera, Upload, Image as ImageIcon, Trash2 } from 'lucide-react';
import cloudinaryConfig from '../CloudinaryConfig';

const MaintenanceRequest = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [userAddress, setUserAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [useCustomLocation, setUseCustomLocation] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [descriptionLength, setDescriptionLength] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  
  // New state for image upload
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');

  const MAX_DESCRIPTION_LENGTH = 500;
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

  const { currentUser } = useAuth();
  const db = getFirestore();

  // State to hold user's full name
  const [userFullName, setUserFullName] = useState('');

  // Common issues templates
  const commonIssues = [
    { title: "Plumbing Leak", description: "Water leaking from [describe location]. The severity is [minor/moderate/severe]. It started [time/date]." },
    { title: "Heating/AC Issue", description: "The heating/air conditioning is not working properly. The issue is [describe problem]. Room temperature is [temperature]." },
    { title: "Electrical Problem", description: "There is an electrical issue with [describe appliance/outlet/fixture]. The problem started [time/date]." },
    { title: "Broken Appliance", description: "The [appliance name] is not working properly. The issue is [describe problem in detail]." }
  ];

  // Fetch user's address and full name from their profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      setProfileLoading(true);
      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.address) {
            setUserAddress(userData.address);
            setLocation(userData.address);
          } else {
            setUseCustomLocation(true);
            setLocationError('No address found in your profile. Please enter the location.');
          }
          setUserFullName(userData.fullName || '');
        } else {
          setUseCustomLocation(true);
          setLocationError('No profile information found. Please enter the location.');
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
        setError('Failed to load your profile information. Please try again later.');
        setUseCustomLocation(true);
      } finally {
        setProfileLoading(false);
      }
    };

    if (currentUser) {
      fetchUserProfile();
    }
  }, [currentUser, db]);

  // Handle image file selection
  const handleImageChange = (e) => {
    setUploadError('');
    const file = e.target.files[0];
    
    if (!file) return;
    
    // Check file size
    if (file.size > MAX_IMAGE_SIZE) {
      setUploadError(`Image too large. Maximum size is ${MAX_IMAGE_SIZE / (1024 * 1024)}MB`);
      return;
    }
    
    // Check file type
    if (!file.type.match('image.*')) {
      setUploadError('Please select an image file (JPEG, PNG, etc.)');
      return;
    }
    
    setImage(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  // Remove image
  const handleRemoveImage = () => {
    setImage(null);
    setImagePreview('');
    setUploadError('');
    setUploadProgress(0);
  };

  // Upload image to Cloudinary
  const uploadImageToCloudinary = useCallback(async (file) => {
    setUploadingImage(true);
    setUploadProgress(0);
    setUploadError('');
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', cloudinaryConfig.uploadPreset);
      formData.append('folder', cloudinaryConfig.folder);
      
      // Create a unique public_id for this upload based on maintenance request
      const timestamp = new Date().toISOString();
      const publicId = `maintenance_${currentUser.uid}_${timestamp}`;
      formData.append('public_id', publicId);
      
      // Use fetch with XMLHttpRequest for upload progress
      const xhr = new XMLHttpRequest();
      
      // Setup the progress event
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(percentComplete);
        }
      };
      
      return new Promise((resolve, reject) => {
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`);
        
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } else {
            reject(new Error('Upload failed'));
          }
        };
        
        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.send(formData);
      });
    } catch (err) {
      console.error('Error uploading image:', err);
      setUploadError('Failed to upload image. Please try again.');
      throw err;
    } finally {
      setUploadingImage(false);
    }
  }, [currentUser]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    setUploadError('');

    try {
      if (description.length > MAX_DESCRIPTION_LENGTH) {
        throw new Error(`Description must be ${MAX_DESCRIPTION_LENGTH} characters or less.`);
      }

      // Initialize maintenance data
      const maintenanceData = {
        title: title.trim(),
        description: description.trim(),
        location: useCustomLocation ? location.trim() : userAddress,
        priority: 'Unassigned',
        status: 'Pending',
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email,
        fullName: userFullName || currentUser.displayName || '',
        createdAt: serverTimestamp(),
        comments: [],
      };

      // Add image if one was selected
      if (image) {
        try {
          const uploadResult = await uploadImageToCloudinary(image);
          
          // Add image information to maintenance request
          maintenanceData.imageUrl = uploadResult.secure_url;
          maintenanceData.imageId = uploadResult.public_id;
          maintenanceData.shareUrl = uploadResult.secure_url;
        } catch (uploadErr) {
          console.error('Error during image upload:', uploadErr);
          throw new Error('Failed to upload image: ' + uploadErr.message);
        }
      }

      // Submit maintenance request to Firestore
      await addDoc(collection(db, 'maintenance_requests'), maintenanceData);
      
      setSuccess('Your maintenance request has been submitted successfully! Our team will review it and respond shortly.');
      
      // Reset form
      setTitle('');
      setDescription('');
      if (useCustomLocation) {
        setLocation('');
      }
      setDescriptionLength(0);
      setImage(null);
      setImagePreview('');
      setUploadProgress(0);
      
      // Scroll to top to see success message
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError('Failed to submit maintenance request: ' + (err.message || 'Please try again later'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDescriptionChange = (e) => {
    const value = e.target.value;
    setDescription(value);
    setDescriptionLength(value.length);
  };

  const applyTemplate = (template) => {
    setTitle(template.title);
    setDescription(template.description);
    setDescriptionLength(template.description.length);
  };

  return (
    <div className="min-h-screen bg-fixed bg-cover bg-center" style={{ backgroundImage: "url('/CU3.jpg')" }}>
    <div className="min-h-screen bg-gradient-to-b from-white/70 to-white/90 backdrop-blur-sm py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
            <div className="bg-white shadow-xl rounded-xl overflow-hidden border border-gray-100">
    
      
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-white">Maintenance Request</h1>
            </div>
          </div>
          
          <div className="p-6">
            {error && (
              <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex items-start">
                <AlertTriangle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
                <button 
                  className="ml-auto text-red-500 hover:text-red-700"
                  onClick={() => setError('')}
                  aria-label="Dismiss"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}

            {success && (
              <div className="mb-6 bg-green-50 border-l-4 border-green-500 p-4 rounded-md flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-green-700">{success}</p>
                </div>
                <button 
                  className="ml-auto text-green-500 hover:text-green-700"
                  onClick={() => setSuccess('')}
                  aria-label="Dismiss"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}

            {/* Common issues templates */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Quick Templates:</h3>
              <div className="flex flex-wrap gap-2">
                {commonIssues.map((issue, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => applyTemplate(issue)}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded text-xs text-blue-700 transition-colors"
                  >
                    {issue.title}
                  </button>
                ))}
              </div>
            </div>

            {profileLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                <span className="ml-2 text-gray-600">Loading your information...</span>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                    Request Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="title"
                    type="text"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm transition-colors"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Leaking Faucet in Kitchen"
                    disabled={submitting}
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                      Description <span className="text-red-500">*</span>
                    </label>
                    <span className={`text-xs ${descriptionLength > MAX_DESCRIPTION_LENGTH ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                      {descriptionLength}/{MAX_DESCRIPTION_LENGTH}
                    </span>
                  </div>
                  <textarea
                    id="description"
                    required
                    className={`w-full px-4 py-3 border rounded-md shadow-sm focus:ring-blue-500 focus:outline-none transition-colors ${
                      descriptionLength > MAX_DESCRIPTION_LENGTH 
                        ? 'border-red-500 focus:border-red-500' 
                        : 'border-gray-300 focus:border-blue-500'
                    }`}
                    rows="5"
                    value={description}
                    onChange={handleDescriptionChange}
                    placeholder="Please describe the issue in detail. Include when it started and how severe it is."
                    disabled={submitting}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Be as specific as possible about the issue to help our maintenance team prepare.
                  </p>
                </div>

                {/* Image Upload Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Add a Photo <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                  </label>
                  
                  {!imagePreview ? (
                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                      <div className="space-y-1 text-center">
                        <Camera className="mx-auto h-12 w-12 text-gray-400" />
                        <div className="flex text-sm text-gray-600">
                          <label htmlFor="image-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                            <span>Upload a photo</span>
                            <input 
                              id="image-upload" 
                              name="image-upload" 
                              type="file" 
                              className="sr-only"
                              accept="image/*" 
                              onChange={handleImageChange}
                              disabled={submitting || uploadingImage}
                            />
                          </label>
                          <p className="pl-1">or drag and drop</p>
                        </div>
                        <p className="text-xs text-gray-500">
                          PNG, JPG, GIF up to 5MB
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 relative">
                      <div className="relative border border-gray-300 rounded-md overflow-hidden">
                        <img 
                          src={imagePreview} 
                          alt="Preview" 
                          className="max-h-48 w-full object-contain"
                        />
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 focus:outline-none"
                          disabled={submitting || uploadingImage}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      
                      {uploadingImage && (
                        <div className="mt-2">
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">Uploading: {uploadProgress}%</p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {uploadError && (
                    <p className="mt-1 text-xs text-red-500">{uploadError}</p>
                  )}
                  
                  <p className="mt-1 text-xs text-gray-500">
                    Adding a photo helps our maintenance team understand the issue better.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location <span className="text-red-500">*</span>
                  </label>
                  
                  {userAddress && (
                    <div className="mb-3">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="useCustomLocation"
                          checked={useCustomLocation}
                          onChange={(e) => setUseCustomLocation(e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          disabled={submitting}
                        />
                        <label htmlFor="useCustomLocation" className="ml-2 block text-sm text-gray-700">
                          Use a different location than my registered address
                        </label>
                      </div>
                      
                      {!useCustomLocation && (
                        <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-md flex items-start">
                          <MapPin className="h-5 w-5 text-gray-500 mr-2 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-gray-700">Your registered address:</p>
                            <p className="text-sm text-gray-600">{userAddress}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {(useCustomLocation || !userAddress) && (
                    <div>
                      <input
                        type="text"
                        required
                        className={`w-full px-4 py-3 border rounded-md shadow-sm focus:ring-blue-500 focus:outline-none transition-colors ${
                          locationError ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
                        }`}
                        value={location}
                        onChange={(e) => {
                          setLocation(e.target.value);
                          if (e.target.value.trim()) {
                            setLocationError('');
                          }
                        }}
                        placeholder="Apartment number, building, area, or specific location"
                        disabled={submitting}
                      />
                      {locationError && (
                        <p className="mt-1 text-sm text-red-600">{locationError}</p>
                      )}
                      <p className="mt-1 text-xs text-gray-500">
                        Please be specific about the location (e.g., "Kitchen sink in Apt 4B")
                      </p>
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-md mb-6">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <Info className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-blue-700">
                        <span className="font-medium">Note:</span> Priority will be assigned by our maintenance team after reviewing your request.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || descriptionLength > MAX_DESCRIPTION_LENGTH || uploadingImage}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting || uploadingImage ? (
                    <>
                      <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" />
                      {uploadingImage ? 'Uploading Image...' : 'Submitting...'}
                    </>
                  ) : (
                    'Submit Maintenance Request'
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
        
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>For urgent maintenance issues requiring immediate attention, please call our emergency line at <span className="font-medium">(555) 123-4567</span></p>
        </div>
      
      
      </div>
      </div>
      </div>
      </div>
  );
};

export default MaintenanceRequest;