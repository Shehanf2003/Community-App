import React, { useState } from 'react';

export const AlertDialog = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);

  const openDialog = () => setIsOpen(true);
  const closeDialog = () => setIsOpen(false);

  const contextValue = {
    isOpen,
    openDialog,
    closeDialog
  };

  return (
    <AlertDialogContext.Provider value={contextValue}>
      {children}
    </AlertDialogContext.Provider>
  );
};

export const AlertDialogTrigger = ({ children }) => {
  const context = React.useContext(AlertDialogContext);
  return React.cloneElement(children, { onClick: context.openDialog });
};

export const AlertDialogContent = ({ children }) => {
  const context = React.useContext(AlertDialogContext);

  if (!context.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        {children}
      </div>
    </div>
  );
};

export const AlertDialogHeader = ({ children }) => (
  <div className="mb-4">{children}</div>
);

export const AlertDialogTitle = ({ children }) => (
  <h2 className="text-xl font-bold mb-2">{children}</h2>
);

export const AlertDialogDescription = ({ children }) => (
  <p className="text-gray-600 mb-4">{children}</p>
);

export const AlertDialogFooter = ({ children }) => (
  <div className="flex justify-end space-x-2 mt-4">{children}</div>
);

export const AlertDialogAction = ({ children, onClick }) => {
  const context = React.useContext(AlertDialogContext);
  
  const handleClick = () => {
    onClick && onClick();
    context.closeDialog();
  };

  return (
    <button 
      onClick={handleClick} 
      className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
    >
      {children}
    </button>
  );
};

export const AlertDialogCancel = ({ children }) => {
  const context = React.useContext(AlertDialogContext);

  return (
    <button 
      onClick={context.closeDialog} 
      className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
    >
      {children}
    </button>
  );
};

const AlertDialogContext = React.createContext();