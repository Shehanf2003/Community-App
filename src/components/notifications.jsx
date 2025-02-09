import React, { useState } from "react";
import { Bell, Settings, ChevronRight } from "lucide-react";

const Notifications = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="relative">
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-2 rounded-full hover:bg-gray-100 relative"
      >
        <Bell className="w-6 h-6 text-gray-700" />
        {/* Notification Badge (if needed in future) */}
        {/* <span className="absolute top-0 right-0 bg-red-500 text-white text-xs w-4 h-4 flex items-center justify-center rounded-full">3</span> */}
      </button>

      {/* Notification Dropdown */}
      {isExpanded && (
        <div className="absolute right-0 mt-2 bg-white rounded-lg shadow-md w-80 z-10">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-semibold">Notifications</h2>
              <button
                className="p-1 hover:bg-gray-100 rounded-full"
                onClick={() => setIsExpanded(false)}
              >
                <ChevronRight className="w-5 h-5 rotate-90 transition-transform" />
              </button>
            </div>
            <button className="p-1 hover:bg-gray-100 rounded-full">
              <Settings className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
              <Bell className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-sm">You have no notifications</p>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t p-3">
            <button className="w-full text-sm text-blue-600 hover:text-blue-700 text-right">
              See all
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifications;
