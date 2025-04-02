// msalConfig.js - Updated configuration with proper scopes and settings

export const msalConfig = {
    auth: {
      clientId: "a81a71da-39c9-4885-ab2e-3110cd768b4e", // Your Microsoft App Registration Client ID
      authority: "https://login.microsoftonline.com/common",
      redirectUri: window.location.origin, // Uses your current domain
      postLogoutRedirectUri: window.location.origin,
      navigateToLoginRequestUrl: true,
    },
    cache: {
      cacheLocation: "localStorage", // Changed from sessionStorage for better persistence
      storeAuthStateInCookie: true,  // For better IE/Edge support
    },
    system: {
      allowRedirectInIframe: true,
      iframeHashTimeout: 10000, // Increased timeout for iframe operations
      loggerOptions: {
        loggerCallback: (level, message, containsPii) => {
          if (containsPii) {
            return;
          }
          switch (level) {
            case 0: // Error
              console.error('MSAL ERROR:', message);
              break;
            case 1: // Warning
              console.warn('MSAL WARNING:', message);
              break;
            case 2: // Info
              console.info('MSAL INFO:', message);
              break;
            case 3: // Verbose
              console.debug('MSAL VERBOSE:', message);
              break;
          }
        },
        piiLoggingEnabled: false,
        logLevel: 2, // Info level logging by default
      }
    }
  };
  
  // Updated loginRequest with the correct scope format
  export const loginRequest = {
    scopes: [
      "Files.ReadWrite",
      "Files.ReadWrite.All",
      "User.Read"
    ]
  };
  
  // Add a function to check if the user is authenticated
  export const isAuthenticated = (instance) => {
    return instance && instance.getAllAccounts() && instance.getAllAccounts().length > 0;
  };
  
  // Add a function to get the active account
  export const getActiveAccount = (instance) => {
    const accounts = instance.getAllAccounts();
    if (!accounts || accounts.length === 0) {
      return null;
    }
    return accounts[0];
  };