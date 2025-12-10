import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo/Logo';

const Login: React.FC = () => {
  const { showToast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(username, password);
      navigate('/');
    } catch (err: any) {
      setError('Username or password is incorrect');
    } finally {
      setLoading(false);
    }
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value);
    if (error) setError('');
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (error) setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ backgroundColor: '#2D3748' }}>
      {/* Main Card Container */}
      <div className="w-full max-w-6xl bg-white/10 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden">
        <div className="grid md:grid-cols-2 min-h-[600px]">
          {/* Left Side - Welcome Section */}
          <div className="relative p-16 flex flex-col justify-center overflow-hidden" style={{ backgroundColor: '#1A202C' }}>
            {/* Content */}
            <div className="relative z-10">
              <h1 className="text-5xl font-bold text-white mb-6">Welcome to Corvia CRM</h1>
              <p className="text-white/90 text-lg leading-relaxed max-w-md">
                Streamline your lead management process with our powerful CRM solution. Track, qualify, and convert leads efficiently with real-time analytics.
              </p>
            </div>
          </div>

          {/* Right Side - Login Form */}
          <div className="bg-gray-50 p-16 flex flex-col justify-center">
            <div className="w-full max-w-sm mx-auto">
              <h2 className="text-2xl font-bold text-center mb-12 tracking-wide" style={{ color: '#2D3748' }}>USER LOGIN</h2>
              
              <form className="space-y-6" onSubmit={handleSubmit}>
                {/* Username Input */}
                <div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="h-5 w-5" style={{ color: '#4A5568' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <input
                      id="username"
                      name="username"
                      type="text"
                      required
                      value={username}
                      onChange={handleUsernameChange}
                      className="block w-full pl-12 pr-4 py-4 bg-gray-100 border-0 rounded-full text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-700 transition-all"
                      placeholder="Username"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="h-5 w-5" style={{ color: '#4A5568' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      required
                      value={password}
                      onChange={handlePasswordChange}
                      className="block w-full pl-12 pr-4 py-4 bg-gray-100 border-0 rounded-full text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-700 transition-all"
                      placeholder="Password"
                    />
                  </div>
                  {error && (
                    <p className="mt-2 text-sm text-red-600 text-center">
                      {error}
                    </p>
                  )}
                </div>

                {/* Remember Me & Forgot Password */}
                <div className="flex items-center justify-between text-sm px-2">
                  <label className="flex items-center cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-5 h-5 text-cyan-600 border-cyan-300 rounded focus:ring-cyan-500"
                      />
                    </div>
                    <span className="ml-2 font-medium" style={{ color: '#2D3748' }}>Remember</span>
                  </label>
                  <button
                    type="button"
                    className="font-medium transition-colors hover:opacity-80"
                    style={{ color: '#2D3748' }}
                    onClick={() => showToast('Password reset functionality coming soon', 'info')}
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Login Button */}
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 px-6 text-white font-bold rounded-full shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all uppercase tracking-wide"
                    style={{ backgroundColor: '#2D3748' }}
                  >
                    {loading ? 'SIGNING IN...' : 'LOGIN'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;