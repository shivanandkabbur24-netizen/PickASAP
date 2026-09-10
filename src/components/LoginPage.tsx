import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, User, ArrowLeft, AlertCircle } from 'lucide-react';
import { UserProfile } from '../types';
import { database as db } from '../lib/firebase';

interface LoginPageProps {
  onSuccess: (user: UserProfile) => void;
  onCancel: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess, onCancel }) => {
  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [forgotSent, setForgotSent] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (isRegisterMode) {
      if (!name.trim()) {
        setError('Please enter your full name or publisher name.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setLoading(true);

    try {
      // Simulate/perform registration or login flow
      await new Promise((r) => setTimeout(r, 600));

      const existingUsersRaw = localStorage.getItem('pickasap_registered_users');
      const users: Array<{ id: string; email: string; name: string; password?: string }> = existingUsersRaw
        ? JSON.parse(existingUsersRaw)
        : [];

      const normalizedEmail = email.trim().toLowerCase();

      if (isRegisterMode) {
        // Check if user already exists
        const found = users.find((u) => u.email.toLowerCase() === normalizedEmail);
        if (found) {
          setError('An account with this email already exists. Please log in.');
          setLoading(false);
          return;
        }

        const newUser: UserProfile = {
          id: 'usr_' + Date.now(),
          email: normalizedEmail,
          name: name.trim(),
          role: 'creator',
        };

        // Save to users directory
        users.push({ ...newUser, password });
        localStorage.setItem('pickasap_registered_users', JSON.stringify(users));

        db.setCurrentUser(newUser);
        onSuccess(newUser);
      } else {
        // Login flow
        const existing = users.find((u) => u.email.toLowerCase() === normalizedEmail);
        if (existing) {
          if (existing.password && existing.password !== password) {
            setError('Incorrect password. Please try again.');
            setLoading(false);
            return;
          }
          const userProfile: UserProfile = {
            id: existing.id,
            email: existing.email,
            name: existing.name || 'Affiliate Partner',
            role: 'creator',
          };
          db.setCurrentUser(userProfile);
          onSuccess(userProfile);
        } else {
          // If user does not exist yet, prompt to register or auto-register cleanly
          setError('No account found with this email. Please switch to Sign Up to register your account.');
          setLoading(false);
          return;
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Google Login handling (Only Google login allowed as per instructions)
  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const googleUser = await db.signInWithGoogle();
      onSuccess(googleUser);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google sign-in encountered an issue. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoFill = () => {
    setEmail('curator@pickasap.com');
    setPassword('secret123');
    setName('Elena Rostova');
    setError('');
  };

  return (
    <div className="min-h-screen w-full bg-[#0a0c10] text-[#ededed] flex flex-col justify-between relative selection:bg-[#E8B072] selection:text-black">
      {/* Top bar with return button */}
      <div className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between z-20">
        <button
          id="login-back-to-magazine-btn"
          onClick={onCancel}
          className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-neutral-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to PickASAP Magazine</span>
        </button>

        <button
          id="login-demo-credentials-btn"
          onClick={handleDemoFill}
          className="text-xs text-[#E8B072] hover:underline cursor-pointer tracking-wider"
          title="Autofill quick demo credentials"
        >
          Autofill Test Creator
        </button>
      </div>

      {/* Main split content matching Image 2 */}
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-20 z-10">
        {/* Left column: Architectural luxury moody visual & Welcome typography */}
        <div className="hidden lg:flex flex-col justify-between w-1/2 max-w-md h-[600px] p-8 rounded-3xl bg-gradient-to-b from-neutral-900/90 to-neutral-950 border border-neutral-800/80 shadow-2xl relative overflow-hidden">
          {/* Subtle architectural ambient backdrop */}
          <div
            className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-luminosity filter contrast-125 pointer-events-none"
            style={{
              backgroundImage:
                'url("https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80")',
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0c10] via-neutral-950/60 to-transparent pointer-events-none" />

          {/* Top subtle brand mark */}
          <div className="relative z-10 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#E8B072]" />
            <span className="text-xs uppercase tracking-[0.25em] font-semibold text-neutral-300">
              PickASAP Publisher Hub
            </span>
          </div>

          {/* Welcome Text block matching the reference photo */}
          <div className="relative z-10 mt-auto mb-6">
            <div className="w-1 h-8 bg-[#E8B072] mb-4 rounded-full" />
            <h2 className="font-serif-editorial text-4xl sm:text-5xl font-normal text-white leading-tight mb-3">
              {isRegisterMode ? 'Join the\nCurators' : 'Welcome\nBack'}
            </h2>
            <p className="text-sm text-neutral-400 font-light leading-relaxed max-w-xs">
              {isRegisterMode
                ? 'Create an uploader profile to publish your verified affiliate picks and track your real-time earnings.'
                : 'Glad to see you again. Let’s continue where you left off.'}
            </p>
          </div>

          {/* Footer copyright note */}
          <div className="relative z-10 text-[11px] text-neutral-500">
            © 2026 PickASAP. All rights reserved.
          </div>
        </div>

        {/* Right column: The sleek dark card */}
        <div className="w-full max-w-md bg-[#13151b] border border-neutral-800/90 rounded-3xl p-7 sm:p-9 shadow-2xl relative">
          {/* Glowing amber hexagon icon at top of card */}
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-neutral-900 border border-neutral-700/60 flex items-center justify-center text-[#E8B072] shadow-inner">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polygon points="12 2 21 7 21 17 12 22 3 17 3 7 12 2" strokeLinejoin="round" />
                <path d="M12 7 L12 17" strokeLinecap="round" />
                <path d="M7 9.5 L17 14.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          {/* Header titles */}
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-serif-editorial font-normal text-white">
              {isRegisterMode ? 'Register Account' : 'Login'}
            </h1>
            <p className="text-xs text-neutral-400 mt-1">
              {isRegisterMode
                ? 'Register to upload products and monitor click analytics'
                : 'Login to your account to continue'}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-3 rounded-xl bg-red-950/50 border border-red-800/60 text-red-200 text-xs flex items-start gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {forgotSent && (
            <div className="mb-6 p-3 rounded-xl bg-amber-950/50 border border-amber-800/60 text-amber-200 text-xs animate-fade-in">
              Password reset link sent to your email.
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegisterMode && (
              <div>
                <label className="block text-xs text-neutral-300 font-medium mb-1.5">
                  Full Name / Publisher Handle
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    id="register-name-input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full bg-[#1b1e26] border border-neutral-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#E8B072] transition-colors"
                    required={isRegisterMode}
                  />
                </div>
              </div>
            )}

            {/* Email Address field */}
            <div>
              <label className="block text-xs text-neutral-300 font-medium mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="login-email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-[#1b1e26] border border-neutral-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#E8B072] transition-colors"
                  required
                />
              </div>
            </div>

            {/* Password field with toggle */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs text-neutral-300 font-medium">
                  Password
                </label>
                {!isRegisterMode && (
                  <button
                    type="button"
                    onClick={() => setForgotSent(true)}
                    className="text-[11px] text-[#E8B072] hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="login-password-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#1b1e26] border border-neutral-800 rounded-xl pl-10 pr-11 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#E8B072] transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-500 hover:text-neutral-300 cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password (Registration mode) */}
            {isRegisterMode && (
              <div>
                <label className="block text-xs text-neutral-300 font-medium mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="register-confirm-password-input"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#1b1e26] border border-neutral-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#E8B072] transition-colors"
                    required
                  />
                </div>
              </div>
            )}

            {/* Primary Action Button */}
            <button
              id="login-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#e3a869] to-[#d69857] hover:from-[#eab172] hover:to-[#dfa261] text-neutral-950 font-medium text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-950/20 transition-all active:scale-[0.99] disabled:opacity-60"
            >
              <span>
                {loading
                  ? 'Processing...'
                  : isRegisterMode
                  ? 'Create Account & Continue'
                  : 'Login'}
              </span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          {/* "or continue with" divider */}
          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-800" />
            </div>
            <span className="relative px-3 bg-[#13151b] text-[11px] text-neutral-500 uppercase tracking-wider">
              or continue with
            </span>
          </div>

          {/* Social login: User strictly instructed: ONLY SHOW THE OPTION FOR GOOGLE LOGIN */}
          <div className="flex justify-center">
            <button
              id="google-login-button"
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-12 h-12 rounded-full bg-[#1b1e26] border border-neutral-700/80 hover:border-neutral-500 flex items-center justify-center transition-all cursor-pointer hover:bg-neutral-800 active:scale-95 shadow-md"
              title="Continue with Google"
              aria-label="Continue with Google"
            >
              {/* Google G multi-color icon */}
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12 0 14.5s.7 4.8 1.9 7.2l3.7-2.9z"
                />
                <path
                  fill="#34A853"
                  d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16.5C3.7 20.4 7.5 23.5 12 23.5z"
                />
              </svg>
            </button>
          </div>

          {/* Switch between Login and Registration */}
          <div className="text-center mt-6 text-xs text-neutral-400">
            {isRegisterMode ? (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegisterMode(false);
                    setError('');
                  }}
                  className="text-[#E8B072] hover:underline font-medium cursor-pointer"
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegisterMode(true);
                    setError('');
                  }}
                  className="text-[#E8B072] hover:underline font-medium cursor-pointer"
                >
                  Sign up
                </button>
              </>
            )}
          </div>

          {/* Security assurance badge matching Image 2 */}
          <div className="mt-8 pt-4 border-t border-neutral-800/60 flex items-center justify-center gap-1.5 text-[11px] text-neutral-500">
            <ShieldCheck className="w-3.5 h-3.5 text-[#E8B072]" />
            <span>Your data is secure with us</span>
          </div>
        </div>
      </div>

      {/* Bottom spacer */}
      <div className="py-4" />
    </div>
  );
};
