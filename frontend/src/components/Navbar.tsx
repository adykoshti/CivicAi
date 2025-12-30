import { Link } from "react-router-dom";

const Navbar = () => {
  const toggleDarkMode = () => {
    document.documentElement.classList.toggle("dark");
  };

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-slate-900/80 border-b border-gray-100 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 cursor-pointer">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white">
              <div className="size-6 flex items-center justify-center rounded bg-primary text-white h-8 w-8">
                <span className="material-icons-round text-[18px]">eco</span>
              </div>
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white">
              CivicAI
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex space-x-8 items-center">
            <Link className="nav-link" to="/">Home</Link>
            <Link className="nav-link" to="/dashboard">Dashboard</Link>
            <Link className="nav-link" to="/iot-live">IoT Live</Link>
            <Link className="nav-link" to="/city-insights">City Insights</Link>
            <Link className="nav-link" to="/about">About Us</Link>
          </div>

          {/* Dark Mode Toggle */}
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
  );
};

export default Navbar;
