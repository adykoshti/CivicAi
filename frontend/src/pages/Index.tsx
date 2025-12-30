import { Link } from "react-router-dom";

const Index = () => {
  const toggleDarkMode = () => {
    document.documentElement.classList.toggle("dark");
  };

  return (
    <div className="bg-background-light dark:bg-background-dark text-text-main-light dark:text-text-main-dark transition-colors duration-300">

      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-slate-900/80 border-b border-gray-100 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white">
                <div className="size-6 flex items-center justify-center rounded bg-primary text-white h-8 w-8">
                  <span className="material-icons-round text-[18px]">eco</span>
                </div>
              </div>
              <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white">
                CivicAI
              </span>
            </div>

            <div className="hidden md:flex space-x-8 items-center">
              <a className="text-sm font-medium text-slate-600 hover:text-primary dark:text-slate-300 dark:hover:text-primary transition-colors" href="/">Home</a>
              <a className="text-sm font-medium text-slate-600 hover:text-primary dark:text-slate-300 dark:hover:text-primary transition-colors" href="/dashboard">Dashboard</a>
              <a className="text-sm font-medium text-slate-600 hover:text-primary dark:text-slate-300 dark:hover:text-primary transition-colors" href="/iot-live">IoT Live</a>
              <a className="text-sm font-medium text-slate-600 hover:text-primary dark:text-slate-300 dark:hover:text-primary transition-colors" href="/city-insights">City Insights</a>
              <a className="text-sm font-medium text-slate-600 hover:text-primary dark:text-slate-300 dark:hover:text-primary transition-colors" href="/about">About Us</a>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
              >
                <span className="material-icons-round dark:hidden">dark_mode</span>
                <span className="material-icons-round hidden dark:block">light_mode</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative pt-16 pb-24 overflow-hidden">
        <div className="absolute top-0 right-0 -z-10 w-1/2 h-full blob-bg opacity-60"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800/50">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                <span className="text-xs font-semibold text-primary dark:text-blue-400 uppercase tracking-wide">
                  Live City Data
                </span>
              </div>

              <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-tight text-slate-900 dark:text-white">
                Real-Time Air <br />
                <span className="text-primary">Quality Intelligence</span>
              </h1>

              <p className="text-lg text-slate-600 dark:text-slate-400 max-w-lg leading-relaxed">
                Turning low-cost IoT sensors into an AI-powered environmental intelligence system. Monitor, predict, and improve urban health with CivicAI.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href="dashboard"
                  className="px-8 py-3.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold shadow-lg shadow-blue-500/25 transition-all transform hover:-translate-y-1 flex items-center justify-center gap-2"
                >
                  Open Dashboard
                  <span className="material-icons-round text-sm">arrow_forward</span>
                </a>

                <a
                  href="#features"
                  className="px-8 py-3.5 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:bg-gray-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center"
                >
                  View Features
                </a>
              </div>

              <div className="pt-6 flex items-center gap-8 border-t border-gray-100 dark:border-slate-800">
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">12+ Cities</p>
                  <p className="text-sm text-slate-500 dark:text-slate-500">Monitored Live</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">5k+ Sensors</p>
                  <p className="text-sm text-slate-500 dark:text-slate-500">Active Devices</p>
                </div>
              </div>
            </div>

            {/* IMAGE + FLOATING CARDS */}
            <div className="relative lg:h-[600px] flex items-center justify-center">
              <div className="relative w-full aspect-square max-w-lg">
                <img
                  alt="Urban city skyline with clean air visualization"
                  className="rounded-2xl shadow-2xl z-10 relative border-4 border-white dark:border-slate-800 object-cover h-full w-full mask-image-gradient"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCCeW6Rz8q5MvkY340fEixvrvf3l0Ioj7coPag2-fA59EQLXgF3WxfmqSrsYAlj3c1Z4E4vMQKuivV_O954lunxLDomeAFmjj87IlOumkx9rEehUxAHrCnupBjodZZEWIGOczluiAxp_Jla-n5PWM7dBMkJMYec2bVpRZALJwrUwHrH7Y7-iqG1dHRaOe-HDRpk1_sU33IB64i7eaWjENEKhLxk-csXBuB0QNjRC1T1BRUzbXDM8rqJ9STHQcPFMitWo0PnK-SqH1F_"
                />

                <div
                  className="absolute -top-6 -right-6 p-4 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 z-20 hidden md:block animate-bounce"
                  style={{ animationDuration: "3s" }}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                      <span className="material-icons-round">check_circle</span>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase font-bold">Air Quality</p>
                      <p className="font-bold text-slate-900 dark:text-white">Good (42)</p>
                    </div>
                  </div>
                </div>

                <div
                  className="absolute -bottom-6 -left-6 p-4 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 z-20 hidden md:block animate-bounce"
                  style={{ animationDuration: "4s" }}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                      <span className="material-icons-round">analytics</span>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase font-bold">Prediction</p>
                      <p className="font-bold text-slate-900 dark:text-white">Stable Trend</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

            {/* FEATURES */}
      <section className="py-20 bg-white dark:bg-slate-900 relative" id="features">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="text-center mb-16">
      <h2 className="text-base font-semibold text-primary uppercase tracking-wider mb-2">
        Core Technology
      </h2>
      <h3 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
        Powered by Advanced AI
      </h3>
      <p className="mt-4 text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
        We combine hybrid machine learning models with IoT infrastructure to deliver actionable environmental insights.
      </p>
    </div>

    {/* TOP 3 CARDS */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
      {/* Card 1 */}
      <div className="group p-8 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-750 border border-slate-100 dark:border-slate-700 hover:shadow-soft hover:border-blue-100 dark:hover:border-blue-900 transition-all duration-300">
        <div className="w-14 h-14 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
          <span className="material-icons-round text-3xl">hub</span>
        </div>
        <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
          Hybrid ML Models
        </h4>
        <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
          Advanced hybrid models combining physical simulations with neural networks for accurate hyper-local AQI predictions.
        </p>
      </div>

      {/* Card 2 */}
      <div className="group p-8 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-750 border border-slate-100 dark:border-slate-700 hover:shadow-soft hover:border-blue-100 dark:hover:border-blue-900 transition-all duration-300">
        <div className="w-14 h-14 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
          <span className="material-icons-round text-3xl">psychology</span>
        </div>
        <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
          Explainability (SHAP)
        </h4>
        <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
          Transparent AI decision making using SHAP values to interpret why specific pollution spikes are predicted.
        </p>
      </div>

      {/* Card 3 */}
      <div className="group p-8 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-750 border border-slate-100 dark:border-slate-700 hover:shadow-soft hover:border-blue-100 dark:hover:border-blue-900 transition-all duration-300">
        <div className="w-14 h-14 rounded-xl bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
          <span className="material-icons-round text-3xl">sensors</span>
        </div>
        <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
          IoT Integration
        </h4>
        <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
          Seamless connectivity with diverse low-cost air quality sensors, aggregating data in real-time.
        </p>
      </div>
    </div>

    {/* BOTTOM 2 CARDS — NOW WITH SAME HOVER EFFECT */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
      {/* Card 4 */}
      <div className="group p-8 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-750 border border-slate-100 dark:border-slate-700 hover:shadow-soft hover:border-blue-100 dark:hover:border-blue-900 transition-all duration-300 flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
          <span className="material-icons-round">location_city</span>
        </div>
        <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
          City-Level Insights
        </h4>
        <p className="text-slate-600 dark:text-slate-400 text-sm">
          Granular data mapping for urban planning and pollution source attribution.
        </p>
      </div>

      {/* Card 5 */}
      <div className="group p-8 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-750 border border-slate-100 dark:border-slate-700 hover:shadow-soft hover:border-blue-100 dark:hover:border-blue-900 transition-all duration-300 flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
          <span className="material-icons-round">health_and_safety</span>
        </div>
        <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
          Health Recommendations
        </h4>
        <p className="text-slate-600 dark:text-slate-400 text-sm">
          Automated, context-aware health advice for citizens based on current air quality.
        </p>
      </div>
    </div>
  </div>
</section>


      {/* HOW IT WORKS */}
      <section className="py-24 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex justify-center">
        <div className="container max-w-[960px] px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">
              How It Works
            </h2>
            <p className="mt-4 text-slate-600 dark:text-slate-400">
              From raw sensor data to policy-changing insights.
            </p>
          </div>

          <div className="relative">
            <div className="absolute left-[20px] top-0 h-full w-[2px] bg-slate-200 dark:bg-slate-700 md:left-1/2 md:-ml-[1px]"></div>

            {/* STEP 1 */}
            <div className="relative mb-12 flex flex-col gap-6 md:flex-row md:items-center">
              <div className="flex-1 md:text-right">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Deploy IoT Sensors
                </h3>
                <p className="mt-2 text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  Low-cost sensors are installed on street lights, buildings, and public transport across the target area.
                </p>
              </div>
              <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white ring-4 ring-white dark:ring-slate-900 mx-auto md:mx-0">
                <span className="material-icons-round text-sm">filter_1</span>
              </div>
              <div className="flex-1 md:invisible"></div>
            </div>

            {/* STEP 2 */}
            <div className="relative mb-12 flex flex-col gap-6 md:flex-row-reverse md:items-center">
              <div className="flex-1 md:text-left">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  AI Processing & Calibration
                </h3>
                <p className="mt-2 text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  Our Hybrid ML models ingest the raw data, calibrate it against reference stations, and fill in gaps.
                </p>
              </div>
              <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white ring-4 ring-white dark:ring-slate-900 mx-auto md:mx-0">
                <span className="material-icons-round text-sm">filter_2</span>
              </div>
              <div className="flex-1 md:invisible"></div>
            </div>

            {/* STEP 3 */}
            <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
              <div className="flex-1 md:text-right">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Actionable Insights
                </h3>
                <p className="mt-2 text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  City planners and citizens access real-time dashboards to make informed decisions about health and traffic.
                </p>
              </div>
              <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white ring-4 ring-white dark:ring-slate-900 mx-auto md:mx-0">
                <span className="material-icons-round text-sm">filter_3</span>
              </div>
              <div className="flex-1 md:invisible"></div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 px-6 py-12">
        <div className="mx-auto max-w-[1200px] grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="size-6 flex items-center justify-center rounded bg-primary text-white h-8 w-8">
                <span className="material-icons-round text-[18px]">eco</span>
              </div>
              <span className="text-lg font-bold text-slate-900 dark:text-white">
                CivicAI
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Empowering cities with data-driven environmental intelligence.
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-[1200px] mt-12 pt-8 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center text-xs text-slate-400">
          <p>© 2025 CivicAI Technologies. All rights reserved.</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors" href="about">
              Privacy Policy
            </a>
            <a className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors" href="about">
              Terms of Service
            </a>
          </div>
        </div>
      </footer>


    </div>
  );
};

export default Index;
