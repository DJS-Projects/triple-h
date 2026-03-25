"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

interface HeaderProps {
  setCurrentPage?: (page: string) => void;
}

interface StockData {
  price: number;
  change: number;
  changePercent: number;
  currency: string;
}

export default function Header({ setCurrentPage }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { data: session, status } = useSession();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [stockLoading, setStockLoading] = useState(true);

  // Normalize role to uppercase
  const role = session?.user?.role
    ? (String(session.user.role).toUpperCase() as
        | "CANDIDATE"
        | "EMPLOYER"
        | "JOB_COACH")
    : undefined;

  // Fetch stock price
  useEffect(() => {
    const fetchStockPrice = async () => {
      try {
        const response = await fetch('/api/stock-price');
        if (response.ok) {
          const data = await response.json();
          setStockData(data);
        }
      } catch (error) {
        console.error('Failed to fetch stock price:', error);
      } finally {
        setStockLoading(false);
      }
    };

    fetchStockPrice();
    // Refresh every 60 seconds
    const interval = setInterval(fetchStockPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return;

    const loadName = async () => {
      try {
        // Use session email as primary source, localStorage as fallback only
        const sessionEmail = session?.user?.email;
        const localEmail =
          typeof window !== "undefined"
            ? localStorage.getItem("userEmail")
            : null;
        const userEmail = encodeURIComponent(sessionEmail || localEmail || "");
        const roleUpper = String(session.user.role).toUpperCase();

        console.log("Fetching name for:", {
          role: roleUpper,
          userEmail,
          sessionEmail,
          localEmail,
          sessionName: session.user.name,
        });

        if (roleUpper === "CANDIDATE") {
          const res = await fetch(`http://localhost:8000/users/${userEmail}`);
          if (res.ok) {
            const profile = await res.json();
            setDisplayName(profile?.name ?? session.user.name ?? null);
          } else {
            setDisplayName(session.user.name ?? null);
          }
        } else if (roleUpper === "EMPLOYER") {
          const res = await fetch(
            `http://localhost:8000/jobs/company/${userEmail}`
          );
          if (res.ok) {
            const company = await res.json();
            setDisplayName(company?.name ?? session.user.name ?? null);
          } else {
            setDisplayName(session.user.name ?? null);
          }
        } else if (roleUpper === "JOB_COACH") {
          setDisplayName(session.user.name ?? null);
        }
      } catch (e) {
        console.error("Failed to fetch display name:", e);
        setDisplayName(session.user?.name ?? null);
      }
    };

    loadName();
  }, [session, status]);

  // Show loading skeleton instead of hiding header
  if (status === "loading") {
    return (
      // MODIFIED: Increased shadow to shadow-lg, increased blur to backdrop-blur-lg, slightly reduced opacity to /80
      <header className="w-full sticky top-0 z-50 bg-[#E9E8FF]/80 shadow-lg backdrop-blur-lg">
        <div className="w-full px-6 py-2">
          <div className="flex justify-between items-center h-16">
            {/* Logo Skeleton */}
            <div className="flex items-center gap-3">
              <div className="w-[110px] h-[110px] bg-gray-200 rounded-md animate-pulse"></div>
            </div>

            {/* Navigation Skeleton */}
            <nav className="hidden md:flex items-center space-x-2">
              <div className="h-8 w-20 bg-gray-200 rounded-xl animate-pulse"></div>
              <div className="h-8 w-24 bg-gray-200 rounded-xl animate-pulse"></div>
              <div className="h-8 w-20 bg-gray-200 rounded-xl animate-pulse"></div>
            </nav>

            {/* Auth Area Skeleton */}
            <div className="hidden md:flex items-center space-x-4">
              <div className="h-8 w-16 bg-gray-200 rounded-full animate-pulse"></div>
              <div className="h-8 w-20 bg-gray-200 rounded-full animate-pulse"></div>
            </div>

            {/* Mobile Menu Skeleton */}
            <div className="md:hidden">
              <div className="w-6 h-6 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
      </header>
    );
  }

  let navItems: { href: string; label: string }[] = [];

  if (role === "EMPLOYER") {
    navItems = [
      { href: "/employer/employer-dashboard", label: "Dashboard" },
      // { href: "/employer/homepage", label: "Homepage" },
      { href: "/employer/JobCoach", label: "Job Coach" },
      { href: "/employer/candidate-list", label: "Candidate List" },
    ];
  } else if (role === "CANDIDATE") {
    navItems = [
      // { href: "/candidate/candidate-dashboard", label: "Dashboard" },
      // { href: "/candidate/homepage", label: "Homepage" },
      // { href: "/candidate/JobListing", label: "Find Jobs" },
      // { href: "/candidate/JobCoach", label: "Job Coach" },
      { href: "/candidate/community", label: "Community" },
      { href: "/candidate/ecommerce", label: "E-Commerce" },
    ];
  } else if (role === "JOB_COACH") {
    navItems = [];
  } else {
    // Default (no session)
    navItems = [
      // { href: "/candidate/JobListing", label: "Find Jobs" },
      // { href: "/contact", label: "Contact" },
    ];
  }

  // ✅ Logo link based on role
  const logoLink =
    role === "CANDIDATE"
      ? "/"
      : role === "EMPLOYER"
      ? "/employer/employer-dashboard"
      : role === "JOB_COACH"
      ? "/job-coach/dashboard"
      : "/";

  const isActive = (path: string) => pathname === path;

  return (
    // MODIFIED: Increased shadow to shadow-lg, increased blur to backdrop-blur-lg, slightly reduced opacity to /80
    <header className="w-full sticky top-0 z-50 bg-[#E9E8FF]/80 shadow-lg backdrop-blur-lg">
      <div className="w-full py-2 sm:px-6 md:px-16 lg:px-20 ">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link
            href={logoLink}
            onClick={() => setCurrentPage?.("homepage")}
            className="flex items-center gap-3"
          >
            <Image
              src="/HengHup-logo2t.png"
              alt="Heng Hup Logo"
              width={110}
              height={110}
              className="rounded-md"
            />
          </Link>

          {/* Stock Price Display - Desktop */}
          {pathname === "/" && (
            <div className="hidden md:flex items-center gap-4">
              {stockLoading ? (
                <div className="flex items-center gap-2 bg-white/70 px-4 py-2 rounded-lg">
                  <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                </div>
              ) : stockData ? (
                <div className="flex items-center gap-2 bg-white/70 px-4 py-2 rounded-lg shadow-sm">
                  <span className="text-sm font-semibold text-[#006DAE]">1891.HK</span>
                  <span className="text-sm font-bold text-[#3a4043]">
                    {stockData.currency} {stockData.price.toFixed(2)}
                  </span>
                  <span className={`text-xs font-medium ${stockData.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {stockData.change >= 0 ? '▲' : '▼'} {Math.abs(stockData.change).toFixed(2)} ({stockData.changePercent.toFixed(2)}%)
                  </span>
                </div>
              ) : null}
            </div>
          )}

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-xl font-semibold text-base tracking-wide transition-all duration-200 ${
                  isActive(item.href)
                    ? "bg-[#006DAE] text-white hover:bg-[#00528A]"
                    : "hover:text-[#006DAE] text-[#312d7f] hover:bg-violet-100/70 font-semibold"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Desktop Auth Area */}
          <div className="hidden md:flex items-center space-x-4">
            {session?.user ? (
              <>
                <span className="text-[#3a4043]">
                  Hi,{" "}
                  <span className="font-semibold">
                    {role === "JOB_COACH"
                      ? "Job Coach"
                      : displayName ?? session?.user?.name ?? "User"}
                  </span>
                </span>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="bg-[#006DAE] hover:bg-[#00528A] text-white px-4 py-2 rounded-full font-medium shadow-md transition-all cursor-pointer duration-200"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setCurrentPage?.("login")}
                  className="text-[#006DAE] hover:text-[#00528A] font-semibold transition-all cursor-pointer duration-200"
                >
                  Sign In
                </Link>
                <Link
                  href="/login"
                  onClick={() => setCurrentPage?.("login")}
                  className="bg-[#006DAE] hover:bg-[#00528A] text-white px-4 py-2 rounded-full font-medium shadow-md transition-all cursor-pointer duration-200"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            className="md:hidden text-gray-700 hover:text-[#006DAE] p-2"
            aria-label="Toggle mobile menu"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Stock Price Display - Mobile */}
        {pathname === "/" && !stockLoading && stockData && (
          <div className="md:hidden flex justify-center pb-2">
            <div className="flex items-center gap-2 bg-white/70 px-4 py-2 rounded-lg shadow-sm">
              <span className="text-xs font-semibold text-[#006DAE]">1891.HK</span>
              <span className="text-xs font-bold text-[#3a4043]">
                {stockData.currency} {stockData.price.toFixed(2)}
              </span>
              <span className={`text-xs font-medium ${stockData.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stockData.change >= 0 ? '▲' : '▼'} {Math.abs(stockData.change).toFixed(2)} ({stockData.changePercent.toFixed(2)}%)
              </span>
            </div>
          </div>
        )}

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden mt-2 border-t border-violet-100 bg-white/70 backdrop-blur-xl rounded-lg shadow-md">
            <nav className="flex flex-col space-y-2 p-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`px-4 py-2 rounded-md font-medium transition-all duration-200 ${
                    isActive(item.href)
                      ? "bg-[#006DAE] text-white shadow-sm"
                      : "text-gray-700 hover:bg-violet-100/70 hover:text-[#006DAE]"
                  }`}
                >
                  {item.label}
                </Link>
              ))}

              <div className="pt-4 border-t border-violet-100 flex flex-col gap-2">
                {session?.user ? (
                  <>
                    <span className="text-center text-[#3a4043] py-2">
                      Hi,{" "}
                      <span className="font-semibold">
                        {displayName ?? session?.user?.name ?? "User"}
                      </span>
                    </span>
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        signOut({ callbackUrl: "/login" });
                      }}
                      className="text-center bg-[#006DAE] hover:bg-[#00528A] text-white py-2 rounded-full font-medium shadow-md transition-all cursor-pointer"
                    >
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="text-center text-[#006DAE] hover:text-[#00528A] font-medium py-2 transition-all"
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/login"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="text-center bg-[#006DAE] hover:bg-[#00528A] text-white py-2 rounded-full font-medium shadow-md transition-all"
                    >
                      Get Started
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
