import Head from 'next/head';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-900 font-sans text-white">
      <Head>
        <title>Prism - Curated Market Intelligence</title>
        <meta name="description" content="Build your own daily financial data feed. Filter out the noise." />
      </Head>

      {/* Navigation */}
      <nav className="max-w-7xl mx-auto px-6 py-6 flex justify-between items-center">
        <div className="text-2xl font-bold tracking-tight text-blue-400">Prism</div>
        <div className="space-x-8 hidden md:flex items-center">
          <a href="#how-it-works" className="text-gray-400 hover:text-blue-400 transition-colors">How it Works</a>
          <a href="#features" className="text-gray-400 hover:text-blue-400 transition-colors">Features</a>
          <Link href="/app">
            <a className="bg-blue-600 text-white px-5 py-2 rounded-full font-medium hover:bg-blue-700 transition-all shadow-sm hover:shadow-md">
              Launch App
            </a>
          </Link>
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
            <Link href="/app">
              <a className="px-8 py-4 bg-blue-600 text-white rounded-lg font-semibold text-lg hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                Start Building Your Feed
              </a>
            </Link>
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
          <Link href="/app">
            <a className="inline-block px-8 py-4 bg-white text-blue-900 rounded-lg font-bold text-lg hover:bg-blue-50 transition-all">
              Get Started Now
            </a>
          </Link>
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
