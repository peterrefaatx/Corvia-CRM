import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getRoleHomePage } from '../config/routePermissions';

const Unauthorized: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleGoHome = () => {
    if (user?.role) {
      navigate(getRoleHomePage(user.role as any));
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 shadow-2xl border border-white/20">
          {/* Icon */}
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg 
              className="w-10 h-10 text-red-400" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
              />
            </svg>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-white text-center mb-3">
            Access Denied
          </h1>

          {/* Message */}
          <p className="text-white/70 text-center mb-8">
            You don't have permission to access this page. Please contact your administrator if you believe this is an error.
          </p>

          {/* User Info */}
          {user && (
            <div className="bg-white/5 rounded-xl p-4 mb-6 border border-white/10">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">Logged in as:</span>
                <span className="text-white font-medium">{user.fullName || user.name || user.email}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-white/60">Role:</span>
                <span className="text-white font-medium">{user.role}</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handleGoHome}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white py-3 px-6 rounded-xl font-semibold hover:from-cyan-600 hover:to-blue-600 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Go to My Dashboard
            </button>
            
            <button
              onClick={() => navigate(-1)}
              className="w-full bg-white/10 text-white py-3 px-6 rounded-xl font-semibold hover:bg-white/20 transition-all duration-200 border border-white/20"
            >
              Go Back
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-white/40 text-center text-sm mt-6">
          Need help? Contact your system administrator
        </p>
      </div>
    </div>
  );
};

export default Unauthorized;




