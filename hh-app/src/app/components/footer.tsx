import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Separator } from '@/app/components/separator';

interface FooterProps {
  setCurrentPage?: (page: string) => void;
}

export default function Footer({ setCurrentPage }: FooterProps) {
  const currentYear = new Date().getFullYear();
  const pathname = usePathname();
  const isHomePage = pathname === '/';

  // Page routing mapping
  const getPageRoute = (page: string): string => {
    const routeMap: Record<string, string> = {
      'jobs': '/jobListing',
      'dashboard': '/candidate/candidate-dashboard',
      'post-job': '/post-job',
      'employer-dashboard': '/employer-dashboard',
      'about': '/about',
      'contact': '/contact',
      // 'login': '/login',
      // 'register': '/register',
      'discover': '/discover',
      'mock-interview': '/mock-interview',
      'accessibility': '/about', // Fallback to about page
      'employers': '/about', // Fallback to about page
      'guide': '/about', // Fallback to about page
      'stories': '/about', // Fallback to about page
      'help': '/contact', // Fallback to contact page
      'accessibility-statement': '/about', // Fallback to about page
      'privacy': '/about', // Fallback to about page
      'terms': '/about', // Fallback to about page
    };
    return routeMap[page] || '/';
  };

  const footerLinks = [
    {
      title: "For Job Seekers",
      links: [
        { label: "Browse Jobs", page: "jobs" },
        { label: "Salary Guide", page: "Salary Guide" },
      ]
    },
    {
      title: "For Employers", 
      links: [
        { label: "Post a Job", page: "post-job" },
      ]
    },
    {
      title: "For Investor",
      links: [
        { label: "Investor Brief", page: "Investor Brief" },
        { label: "Annual Report", page: "Annual Report" },
      ]
    },
    {
      title: "Support",
      links: [
        { label: "Contact Us", page: "contact" },
        { label: "Privacy Policy & Term of Service", page: "Privacy Policy & Term of Service"}
      ]
    }
  ];

  return (
    <footer className="bg-card border-t-1 border-gray-300 border-border">
      <div className={`max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 ${isHomePage ? 'mt-10' : 'mt-0'}`}>
        {/* Main Footer Content - Only show on homepage */}
        {isHomePage && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {footerLinks.map((section) => (
                <div key={section.title}>
                  <h3 className="text-foreground mb-4 font-bold text-lg ">{section.title}</h3>
                  <ul className="space-y-3">
                    {section.links.map((link) => (
                      <li key={link.label}>
                        <Link
                          href={getPageRoute(link.page)}
                          className="text-muted-foreground hover:text-primary transition-colors duration-200 text-left block text-sm text-gray-700"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <Separator className="my-3" />
          </>
        )}

        {/* Bottom Section */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y- lg:space-y-0">
          {/* <div className="max-w-md">
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                <span className="text-primary-foreground text-xs">TS</span>
              </div>
              <span className="text-foreground">Talent Spectrum</span>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Connecting neurodivergent talent with inclusive employers. 
              Building a more accessible and understanding workplace for everyone.
            </p>
          </div> */}

          {/* Legal and Compliance */}
          <div className="flex flex-col lg:items-end space-y-3">
            {/* <div className="flex flex-wrap gap-4 text-sm">
              <Link
                href={getPageRoute('privacy')}
                className="text-muted-foreground hover:text-primary transition-colors duration-200"
              >
                Privacy Policy
              </Link>
              <Link
                href={getPageRoute('terms')}
                className="text-muted-foreground hover:text-primary transition-colors duration-200"
              >
                Terms of Service
              </Link>
              <Link
                href={getPageRoute('accessibility-statement')}
                className="text-muted-foreground hover:text-primary transition-colors duration-200"
              >
                Accessibility
              </Link>
            </div> */}
            <p className={`text-muted-foreground text-sm ${isHomePage ? 'py-5' : 'py-3'}`}>
              © {currentYear} All rights reserved.
            </p>
          </div>
        </div>

      </div>
    </footer>
  );
}