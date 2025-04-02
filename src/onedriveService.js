import axios from 'axios';

// Enhanced direct upload function with improved token validation
export const uploadImageToOneDriveSimple = async (accessToken, file) => {
  // Validate inputs
  if (!accessToken) {
    console.error('Access token is empty or undefined');
    return {
      success: false,
      error: 'Missing authentication token'
    };
  }
  
  if (!file) {
    console.error('File is empty or undefined');
    return {
      success: false,
      error: 'No file provided for upload'
    };
  }

  try {
    console.log('Starting simple upload for file:', file.name);
    console.log('Using access token (first 10 chars):', accessToken.substring(0, 10) + '...');
    
    // Create a unique filename to avoid conflicts
    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    
    // Direct upload to root drive (no session required)
    const uploadResponse = await axios({
      method: 'PUT',
      url: `https://graph.microsoft.com/v1.0/me/drive/root:/${fileName}:/content`,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': file.type,
      },
      data: file,
      validateStatus: status => status < 500, // Allow non-500 errors to be handled in code
    });
    
    // Check for API errors
    if (uploadResponse.status >= 400) {
      console.error('API error during upload:', uploadResponse.status, uploadResponse.data);
      
      let errorMessage = 'Upload failed';
      if (uploadResponse.data && uploadResponse.data.error) {
        errorMessage = `${uploadResponse.data.error.code}: ${uploadResponse.data.error.message}`;
        
        // Special handling for auth errors
        if (uploadResponse.data.error.code === 'InvalidAuthenticationToken') {
          errorMessage = 'Your login session has expired. Please refresh the page and try again.';
        }
      }
      
      return {
        success: false,
        error: errorMessage,
        status: uploadResponse.status
      };
    }
    
    console.log('Simple upload successful, response:', uploadResponse.status);
    console.log('File web URL:', uploadResponse.data.webUrl);
    
    // Store the original webUrl from the upload response - this is a SharePoint URL
    const originalWebUrl = uploadResponse.data.webUrl;
    const fileId = uploadResponse.data.id;
    
    // Create an anonymous shareable link (best for browser viewing)
    try {
      const shareResponse = await axios({
        method: 'POST',
        url: `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/createLink`,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        data: {
          type: "view",
          scope: "anonymous"
        },
        validateStatus: status => status < 500,
      });
      
      // Check for API errors in share creation
      if (shareResponse.status >= 400) {
        console.warn('Error creating share link:', shareResponse.status, shareResponse.data);
        
        // Continue without share URL since the upload itself succeeded
        return {
          success: true,
          imageId: fileId,
          webUrl: originalWebUrl,
          imageUrl: `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`
        };
      }
      
      return {
        success: true,
        imageId: fileId,
        // Original SharePoint URL (useful as a stable reference)
        webUrl: originalWebUrl,
        // Sharing URL (best for links and browser viewing)
        shareUrl: shareResponse.data.link.webUrl,
        // Include URL for direct download via API (may require auth)
        imageUrl: `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`
      };
    } catch (shareError) {
      console.warn('Exception creating share link:', shareError);
      
      // Even if sharing fails, still return success with available URLs
      return {
        success: true,
        imageId: fileId,
        webUrl: originalWebUrl,
        imageUrl: `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`
      };
    }
  } catch (error) {
    console.error('Exception in simple upload:', error);
    
    // Enhanced error handling
    let errorMessage = 'Upload failed: ' + (error.message || 'Unknown error');
    
    // Handle Axios errors
    if (error.response) {
      // Server responded with an error status
      console.error('Server error response:', error.response.status, error.response.data);
      
      if (error.response.data && error.response.data.error) {
        errorMessage = `${error.response.data.error.code}: ${error.response.data.error.message}`;
        
        // Special handling for auth errors
        if (error.response.data.error.code === 'InvalidAuthenticationToken') {
          errorMessage = 'Your login session has expired. Please refresh the page and try again.';
        }
      }
    } else if (error.request) {
      // Request was made but no response received
      console.error('No response received from server:', error.request);
      errorMessage = 'No response from server. Please check your internet connection.';
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
};

// Helper function to debug auth token
export const testAuthToken = async (accessToken) => {
  if (!accessToken) {
    return {
      success: false,
      error: 'No access token provided'
    };
  }
  
  try {
    // Log token length for debugging
    console.log('Testing auth token, length:', accessToken.length);
    
    const response = await axios({
      method: 'GET',
      url: 'https://graph.microsoft.com/v1.0/me',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      validateStatus: status => status < 500,
    });
    
    // Check for API errors
    if (response.status >= 400) {
      console.error('API error during token test:', response.status, response.data);
      
      let errorMessage = 'Token validation failed';
      if (response.data && response.data.error) {
        errorMessage = `${response.data.error.code}: ${response.data.error.message}`;
      }
      
      return {
        success: false,
        error: errorMessage,
        status: response.status
      };
    }
    
    return {
      success: true,
      user: response.data.displayName,
      email: response.data.userPrincipalName
    };
  } catch (error) {
    console.error('Exception testing auth token:', error);
    
    let errorMessage = 'Token validation failed: ' + (error.message || 'Unknown error');
    
    if (error.response && error.response.data && error.response.data.error) {
      errorMessage = `${error.response.data.error.code}: ${error.response.data.error.message}`;
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
};

// Helper function to test if a URL is accessible
export const testImageUrl = async (url) => {
  if (!url) return false;
  
  try {
    const response = await fetch(url, { 
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-cache'
    });
    return true; // with no-cors mode, we can't check status, so assume success if no error
  } catch (error) {
    console.warn('Error testing URL accessibility:', error);
    return false;
  }
};