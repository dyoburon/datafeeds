import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';

type AuthMode = 'login' | 'signup' | 'reset';

function AuthModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const { signIn, signUp, signInWithGoogle, resetPassword, error, loading, clearError, isDevMode } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      if (mode === 'login') {
        await signIn(email, password);
        onClose();
        router.push('/app');
      } else if (mode === 'signup') {
        await signUp(email, password, name);
        onClose();
        router.push('/app');
      } else if (mode === 'reset') {
        await resetPassword(email);
        setResetSent(true);
      }
    } catch (err) {
      // Error is handled by AuthContext
    }
  };

  const handleGoogleSignIn = async () => {
    clearError();
    try {
      await signInWithGoogle();
      onClose();
      router.push('/app');
    } catch (err) {
      // Error is handled by AuthContext
    }
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    clearError();
    setResetSent(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-gray-900 rounded-2xl shadow-2xl border border-gray-800 overflow-hidden">
        {/* Header gradient */}
        <div className="h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" />
        
        <div className="p-8">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Dev mode banner */}
          {isDevMode && (
            <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg text-yellow-300 text-sm text-center">
              🛠️ Dev Mode – Any credentials will sign you in
            </div>
          )}

          {/* Title */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">
              {mode === 'login' && 'Welcome back'}
              {mode === 'signup' && 'Create your account'}
              {mode === 'reset' && 'Reset password'}
            </h2>
            <p className="text-gray-400 text-sm">
              {mode === 'login' && 'Sign in to access your personalized market feed'}
              {mode === 'signup' && 'Start building your custom market intelligence'}
              {mode === 'reset' && "We'll send you a link to reset your password"}
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Reset success message */}
          {resetSent && mode === 'reset' && (
            <div className="mb-6 p-4 bg-green-900/30 border border-green-800 rounded-lg text-green-300 text-sm">
              Password reset email sent! Check your inbox.
            </div>
          )}

          {/* Google Sign In */}
          {mode !== 'reset' && (
            <>
              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-700" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-gray-900 text-gray-500">or continue with email</span>
                </div>
              </div>
            </>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            {mode !== 'reset' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  minLength={6}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            )}

            {mode === 'login' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => switchMode('reset')}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/30"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </span>
              ) : (
                <>
                  {mode === 'login' && 'Sign In'}
                  {mode === 'signup' && 'Create Account'}
                  {mode === 'reset' && 'Send Reset Link'}
                </>
              )}
            </button>
          </form>

          {/* Mode switcher */}
          <div className="mt-6 text-center text-sm text-gray-400">
            {mode === 'login' && (
              <>
                Don't have an account?{' '}
                <button
                  onClick={() => switchMode('signup')}
                  className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
                >
                  Sign up
                </button>
              </>
            )}
            {mode === 'signup' && (
              <>
                Already have an account?{' '}
                <button
                  onClick={() => switchMode('login')}
                  className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
                >
                  Sign in
                </button>
              </>
            )}
            {mode === 'reset' && (
              <button
                onClick={() => switchMode('login')}
                className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                ← Back to sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const { user, signOut, loading, isDevMode } = useAuth();
  const router = useRouter();

  const handleGetStarted = () => {
    if (user) {
      router.push('/app');
    } else {
      setAuthModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 font-sans text-white">
      <Head>
        <title>Prism - Curated Market Intelligence</title>
        <meta name="description" content="Build your own daily financial data feed. Filter out the noise." />
      </Head>

      {/* Auth Modal */}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />

      {/* Dev mode banner */}
      {isDevMode && (
        <div className="bg-yellow-900/50 text-yellow-300 text-xs text-center py-1 px-4">
          🛠️ Dev Mode – Firebase not configured. Using mock authentication.
        </div>
      )}

      {/* Navigation */}
      <nav className="max-w-7xl mx-auto px-6 py-6 flex justify-between items-center">
        <div className="text-2xl font-bold tracking-tight text-blue-400">Prism</div>
        <div className="space-x-8 hidden md:flex items-center">
          <a href="#how-it-works" className="text-gray-400 hover:text-blue-400 transition-colors">How it Works</a>
          <a href="#features" className="text-gray-400 hover:text-blue-400 transition-colors">Features</a>
          
          {loading ? (
            <div className="w-24 h-10 bg-gray-800 rounded-full animate-pulse" />
          ) : user ? (
            <div className="flex items-center gap-4">
              <Link href="/app">
                <a className="text-gray-300 hover:text-white transition-colors">
                  Dashboard
                </a>
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center text-sm font-medium">
                  {user.displayName?.charAt(0) || user.email?.charAt(0).toUpperCase()}
                </div>
                <button
                  onClick={() => signOut()}
                  className="text-gray-400 hover:text-white text-sm transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setAuthModalOpen(true)}
                className="text-gray-300 hover:text-white transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => setAuthModalOpen(true)}
                className="bg-blue-600 text-white px-5 py-2 rounded-full font-medium hover:bg-blue-700 transition-all shadow-sm hover:shadow-md"
              >
                Get Started
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-20 md:py-32 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-8 text-white leading-tight">
            The Signal Without <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">The Noise.</span>
          </h1>
          <p className="text-xl text-gray-400 mb-10 leading-relaxed">
            Most financial newsletters are 90% fluff. Build your own curated data feed.
            Define your filters with natural language, backtest them, and get a custom morning briefing with only the stats that matter to you.
          </p>
          <div className="flex flex-col md:flex-row justify-center gap-4">
            <button
              onClick={handleGetStarted}
              className="px-8 py-4 bg-blue-600 text-white rounded-lg font-semibold text-lg hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              {user ? 'Go to Dashboard' : 'Start Building Your Feed'}
            </button>
            <button className="px-8 py-4 bg-gray-800 text-gray-300 border border-gray-700 rounded-lg font-semibold text-lg hover:bg-gray-700 transition-all">
              View Demo
            </button>
          </div>
        </div>
      </section>

      {/* The Problem / Solution */}
      <section className="bg-gray-800 py-20">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
          <div>
            <div className="uppercase text-sm font-bold text-blue-400 tracking-wider mb-2">The Problem</div>
            <h2 className="text-3xl font-bold mb-6">Your inbox is full of things you don't care about.</h2>
            <p className="text-lg text-gray-400 mb-6">
              Traditional market data feeds are "one size fits all." You sift through paragraphs of jargon to find one relevant statistic. It's inefficient and distracting.
            </p>
            <div className="p-6 bg-gray-900 rounded-xl shadow-lg border border-gray-700 opacity-75 grayscale">
              <div className="h-4 bg-gray-700 rounded w-1/3 mb-4"></div>
              <div className="h-3 bg-gray-800 rounded w-full mb-2"></div>
              <div className="h-3 bg-gray-800 rounded w-full mb-2"></div>
              <div className="h-3 bg-gray-800 rounded w-3/4"></div>
            </div>
          </div>
          <div>
            <div className="uppercase text-sm font-bold text-green-400 tracking-wider mb-2">The Solution</div>
            <h2 className="text-3xl font-bold mb-6">A funnel designed by you, for you.</h2>
            <p className="text-lg text-gray-400 mb-6">
              Instead of reading everything, define what you're looking for. We turn your ideas into code that scans the market and delivers only the hits.
            </p>
            <ul className="space-y-4">
              <li className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-green-900/30 flex items-center justify-center text-green-400">✓</div>
                <span className="font-medium text-gray-300">Filter by specific technical setups</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-green-900/30 flex items-center justify-center text-green-400">✓</div>
                <span className="font-medium text-gray-300">Backtest ideas instantly against history</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-green-900/30 flex items-center justify-center text-green-400">✓</div>
                <span className="font-medium text-gray-300">Receive a clean, stats-only morning report</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">How it Works</h2>
            <p className="text-xl text-gray-400">From idea to automated intelligence in three steps.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="p-8 rounded-2xl bg-gray-800 border border-gray-700 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-400 font-bold text-xl mb-6">1</div>
              <h3 className="text-xl font-bold mb-3">Describe Your Funnel</h3>
              <p className="text-gray-400">
                Use plain English to describe the market conditions you're interested in.
                <br /><span className="text-sm italic text-gray-500 mt-2 block">"Show me stocks where volume is up 50% and price is down."</span>
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-8 rounded-2xl bg-gray-800 border border-gray-700 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-purple-900/30 rounded-xl flex items-center justify-center text-purple-400 font-bold text-xl mb-6">2</div>
              <h3 className="text-xl font-bold mb-3">Validate with Data</h3>
              <p className="text-gray-400">
                We instantly build a backtest script to check your hypothesis against 100 years of market data. See if your signal actually works before you track it.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-8 rounded-2xl bg-gray-800 border border-gray-700 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-400 font-bold text-xl mb-6">3</div>
              <h3 className="text-xl font-bold mb-3">Automate Your Feed</h3>
              <p className="text-gray-400">
                Turn successful tests into a recurring job. Every morning, we run your logic and send you a digest of just the tickers that match your criteria.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-blue-900 text-white py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to build your own newsletter?</h2>
          <p className="text-blue-100 text-lg mb-10">
            Stop relying on other people's filters. Create your own edge with data-backed signals.
          </p>
          <button
            onClick={handleGetStarted}
            className="inline-block px-8 py-4 bg-white text-blue-900 rounded-lg font-bold text-lg hover:bg-blue-50 transition-all"
          >
            {user ? 'Go to Dashboard' : 'Get Started Now'}
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 py-12 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-gray-500 text-sm">
            © 2025 Prism. All rights reserved.
          </div>
          <div className="flex gap-6 text-sm text-gray-500">
            <a href="#" className="hover:text-blue-400">Privacy Policy</a>
            <a href="#" className="hover:text-blue-400">Terms of Service</a>
            <a href="#" className="hover:text-blue-400">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
