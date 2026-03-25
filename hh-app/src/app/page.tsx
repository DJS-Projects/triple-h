"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Button } from "@/app/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/card";

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState("core-business");
  const [currentJobIndex, setCurrentJobIndex] = useState(0);
  const [currentCoachIndex, setCurrentCoachIndex] = useState(0);
  const images = ["/1.png", "/2.png", "/3.png"];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 2000); // Change image every 2 seconds

    return () => clearInterval(interval);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Searching for:", searchQuery);
    alert(`Searching for: ${searchQuery}`);
  };

  return (
    <div
      className="relative min-h-screen bg-violet-50 py-0 px-4 font-['Plus_Jakarta_Sans',_sans-serif]"
    >
      {/* Main Content */}
      <div className="flex items-center justify-center pt-10 pb-12 px-4 overflow-visible">
        <div className="max-w-[1400px] w-full text-left">
          {/* Hero Section - Updated with Grid Layout */}
          <div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            {/* Left Column - Text Content */}
            <div>
              <h1
                className="leading-[1.15] break-words overflow-visible"
                style={{ wordBreak: "keep-all" }}
              >
                <span
                  className="block text-[clamp(2rem,4vw,3.5rem)] font-extrabold tracking-tight 
                    text-[#006DAE]"
                >
                  Leaders in Scrap Metal Trading
                </span>
              </h1>
              <p className="block text-[clamp(1rem,2vw,1.25rem)] font-normal text-[#3a4043] mt-6 leading-relaxed">
                Our Group is a leading scrap ferrous metal trader in Malaysia. According to Frost & Sullivan, we ranked first in terms of trading volume with domestic steel mills in 2017, having a market share of approximately 20.8%.
              </p>

              {/* CTA Button */}
              <div className="mt-8">
                <Link href="/about">
                  <button
                    className="px-8 py-4 text-lg bg-[#006DAE] hover:bg-[#00528A] text-white 
                      rounded-lg transition-colors cursor-pointer font-semibold shadow-lg"
                  >
                    Read More About Heng Hup Group →
                  </button>
                </Link>
              </div>
            </div>

            {/* Right Column - Image Carousel */}
            <div className="relative w-full h-[650px] rounded-xl overflow-hidden">
              {images.map((img, index) => (
                <img
                  key={index}
                  src={img}
                  alt={`Slide ${index + 1}`}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
                    index === currentImageIndex ? "opacity-100" : "opacity-0"
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="mt-10">
            <h2 className="text-4xl md:text-4xl my-10 text-[#006DAE] font-bold text-center">
              Our Business
            </h2>

            {/* Tab Buttons */}
            <div className="flex justify-center gap-4 mb-8">
              <button
                onClick={() => setActiveTab("core-business")}
                className={`px-8 py-3 rounded-full font-semibold transition-all ${
                  activeTab === "core-business"
                    ? "bg-[#006DAE] text-white shadow-lg"
                    : "bg-white/60 border border-[#e8e6f0] text-[#006DAE] hover:bg-[#006DAE] hover:text-white transition-colors cursor-pointer"
                }`}
              >
                Core Business
              </button>
              <button
                onClick={() => setActiveTab("products")}
                className={`px-8 py-3 rounded-full font-semibold transition-all ${
                  activeTab === "products"
                    ? "bg-[#006DAE] text-white shadow-lg"
                    : "bg-white/60 border border-[#e8e6f0] text-[#006DAE] hover:bg-[#006DAE] hover:text-white transition-colors cursor-pointer"
                }`}
              >
                Products
              </button>
              <button
                onClick={() => setActiveTab("investor")}
                className={`px-8 py-3 rounded-full font-semibold transition-all ${
                  activeTab === "investor"
                    ? "bg-[#006DAE] text-white shadow-lg"
                    : "bg-white/60 border border-[#e8e6f0] text-[#006DAE] hover:bg-[#006DAE] hover:text-white transition-colors cursor-pointer"
                }`}
              >
                Investor Relations
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === "core-business" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Card 1: Strategic Scrapyards */}
                <Card className="bg-white/60 backdrop-blur-sm rounded-xl p-8 border border-[#f0eef5] shadow-lg overflow-hidden">
                  <div className="h-32 bg-gradient-to-br from-[#006DAE] to-[#24a4dc] flex items-center justify-center -mx-8 -mt-8 mb-6">
                    <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <CardContent className="p-0">
                    <h4 className="text-lg font-bold text-[#3a4043] mb-3 text-center">
                      Strategic Scrapyards Network
                    </h4>
                    <p className="text-[#3a4043] text-sm leading-relaxed text-center">
                      We operate a network of strategic scrapyards equipped with various processing facilities, supported by an extension network of feeder yards throughout Malaysia from which we source scrap materials.
                    </p>
                  </CardContent>
                </Card>

                {/* Card 2: Processing Facilities */}
                <Card className="bg-white/60 backdrop-blur-sm rounded-xl p-8 border border-[#f0eef5] shadow-lg overflow-hidden">
                  <div className="h-32 bg-gradient-to-br from-[#006DAE] to-[#24a4dc] flex items-center justify-center -mx-8 -mt-8 mb-6">
                    <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                    </svg>
                  </div>
                  <CardContent className="p-0">
                    <h4 className="text-lg font-bold text-[#3a4043] mb-3 text-center">
                      Advanced Processing Facilities
                    </h4>
                    <p className="text-[#3a4043] text-sm leading-relaxed text-center">
                      Our facilities are equipped with state-of-the-art processing equipment to handle various types of scrap materials efficiently, ensuring quality output for domestic steel mills.
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === "products" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Card 1: Ferrous Metal Scrap */}
                <Card className="bg-white/60 backdrop-blur-sm rounded-xl p-8 border border-[#f0eef5] shadow-lg overflow-hidden">
                 <div className="h-32 bg-gradient-to-br from-[#006DAE] to-[#24a4dc] flex items-center justify-center -mx-8 -mt-8 mb-6">
                   <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                 </div>
                 <CardContent className="p-0">
                   <h4 className="text-lg font-bold text-[#3a4043] mb-3 text-center">
                      Ferrous Metal Scrap
                    </h4>
                    <p className="text-[#3a4043] text-sm leading-relaxed text-center">
                     Leading supplier of ferrous metal scrap to domestic steel mills with approximately 20.8% market share.
                   </p>
                  </CardContent>
               </Card>
               
                {/* Card 2: Non-Ferrous Metal */}
                  <Card className="bg-white/60 backdrop-blur-sm rounded-xl p-8 border border-[#f0eef5] shadow-lg overflow-hidden">
                    <div className="h-32 bg-gradient-to-br from-[#006DAE] to-[#24a4dc] flex items-center justify-center -mx-8 -mt-8 mb-6">
                      <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                      </svg>
                    </div>
                   <CardContent className="p-0">
                      <h4 className="text-lg font-bold text-[#3a4043] mb-3 text-center">
                       Non-Ferrous Metal Scrap
                      </h4>
                      <p className="text-[#3a4043] text-sm leading-relaxed text-center">
                       Recycling of non-ferrous metals including aluminum, copper, and other valuable materials.
                       </p>
                    </CardContent>
                  </Card>

               {/* Card 3: Waste Paper & Batteries */}
               <Card className="bg-white/60 backdrop-blur-sm rounded-xl p-8 border border-[#f0eef5] shadow-lg overflow-hidden">
                  <div className="h-32 bg-gradient-to-br from-[#006DAE] to-[#24a4dc] flex items-center justify-center -mx-8 -mt-8 mb-6">
                    <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                   </svg>
                  </div>
                 <CardContent className="p-0">
                    <h4 className="text-lg font-bold text-[#3a4043] mb-3 text-center">
                     Waste Paper & Used Batteries
                    </h4>
                   <p className="text-[#3a4043] text-sm leading-relaxed text-center">
                      Comprehensive recycling services for waste paper and used batteries, contributing to environmental sustainability.
                    </p>
                  </CardContent>
                </Card>
             </div>
            )}

            {activeTab === "investor" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               {/* Card 1: Announcements */}
               <Card className="bg-white/60 backdrop-blur-sm rounded-xl p-8 border border-[#f0eef5] shadow-lg overflow-hidden">
                  <div className="h-32 bg-gradient-to-br from-[#006DAE] to-[#24a4dc] flex items-center justify-center -mx-8 -mt-8 mb-6">
                    <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                    </svg>
                </div>
                  <CardContent className="p-0">
                    <h4 className="text-lg font-bold text-[#3a4043] mb-3 text-center">
                      Announcements & Circulars
                    </h4>
                    <p className="text-[#3a4043] text-sm leading-relaxed text-center">
                      Stay updated with our latest corporate announcements, circulars, and regulatory filings.
                    </p>
                  </CardContent>
                </Card>

                {/* Card 2: Financial Reports */}
                <Card className="bg-white/60 backdrop-blur-sm rounded-xl p-8 border border-[#f0eef5] shadow-lg overflow-hidden">
                  <div className="h-32 bg-gradient-to-br from-[#006DAE] to-[#24a4dc] flex items-center justify-center -mx-8 -mt-8 mb-6">
                    <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <CardContent className="p-0">
                    <h4 className="text-lg font-bold text-[#3a4043] mb-3 text-center">
                      Financial Reports
                    </h4>
                    <p className="text-[#3a4043] text-sm leading-relaxed text-center">
                      Access our comprehensive financial reports, ESG reports, and performance data.
                    </p>
                  </CardContent>
                </Card>

                {/* Card 3: Corporate Governance */}
                <Card className="bg-white/60 backdrop-blur-sm rounded-xl p-8 border border-[#f0eef5] shadow-lg overflow-hidden">
                  <div className="h-32 bg-gradient-to-br from-[#006DAE] to-[#24a4dc] flex items-center justify-center -mx-8 -mt-8 mb-6">
                    <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <CardContent className="p-0">
                    <h4 className="text-lg font-bold text-[#3a4043] mb-3 text-center">
                      Corporate Governance
                    </h4>
                    <p className="text-[#3a4043] text-sm leading-relaxed text-center">
                      Learn about our commitment to corporate governance, transparency, and best practices.
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}