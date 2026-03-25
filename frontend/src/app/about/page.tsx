"use client";
import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import About_Us from "@/../public/About_Us.png";

export default function AboutPage() {

  const slides = [
    {
      title: "Motives and Aims",
      text: "Why we decided to do this as our Capstone Project",
      bg: "/About_Motivations_Aims.jpg",
    },
    {
      title: "AI-Matching and CV Parsing",
      text: "How our AI works",
      bg: "/About_AI.jpg",
    },
    {
      title: "Methodologies",
      text: "Languages, apps, and other software used for this site",
      bg: "/About_Methodologies.jpg",
    },
  ];

  // Clone first and last slides for seamless looping
  const loopedSlides = [slides[slides.length - 1], ...slides, slides[0]];

  const [current, setCurrent] = useState(1); // Start on first real slide
  const [transitioning, setTransitioning] = useState(true);
  const [isCooldown, setIsCooldown] = useState(false);

  const transitionDuration = 400; // ms
  const cooldownTimerRef = useRef<any>(null);

  // === Handle transition end for seamless looping ===
  const handleTransitionEnd = () => {
    setIsCooldown(false); // allow next press after transition completes

    if (current === loopedSlides.length - 1) {
      setTransitioning(false);
      setCurrent(1);
    } else if (current === 0) {
      setTransitioning(false);
      setCurrent(loopedSlides.length - 2);
    }
  };

  // Reactivate transitions after snap
  useEffect(() => {
    if (!transitioning) {
      const timeout = setTimeout(() => setTransitioning(true), 50);
      return () => clearTimeout(timeout);
    }
  }, [transitioning]);

  // === Cooldown logic ===
  const startCooldown = () => {
    setIsCooldown(true);
    clearTimeout(cooldownTimerRef.current);
    cooldownTimerRef.current = setTimeout(
      () => setIsCooldown(false),
      transitionDuration
    );
  };

  const nextSlide = () => {
    if (isCooldown) return;
    setTransitioning(true);
    setCurrent((prev) => prev + 1);
    startCooldown();
  };

  const prevSlide = () => {
    if (isCooldown) return;
    setTransitioning(true);
    setCurrent((prev) => prev - 1);
    startCooldown();
  };

  // === Transition styling ===
  const transitionStyle = {
    transform: `translateX(-${current * 100}%)`,
    transition: transitioning ? `transform ${transitionDuration}ms ease-in-out` : "none",
  };

  return (
    <div
      className="min-h-screen bg-fixed bg-center bg-cover"
      style={{
        backgroundImage: "url('/About_Us.png')",
      }}
    >

      {/* HOMEPAGE CONTENT*/}
      <section className="py-32 px-4 sm:px-6 lg:px-8 bg-transparent">
        <div className="max-w-[1400px] mx-auto">
          {/* Hero Section */}
          <div className="mb-8">
            <h1
              className="leading-[1.15] break-words overflow-visible"
              style={{ wordBreak: "keep-all" }}
            >
              <span
                className="block text-[clamp(2.8rem,5vw,5.5rem)] font-extrabold tracking-tight 
                  bg-clip-text text-transparent 
                  bg-[linear-gradient(115deg,#1a1a1a,#635bff,#9a96ff)] 
                  drop-shadow-[2px_2px_10px_rgba(0,0,0,0.25)]"
              >
                Neurodiversity:
              </span>
              <span
                className="block text-[clamp(1.8rem,4vw,3.8rem)] font-semibold text-[#2e2f34] mt-3"
              >
                Innovation Beyond Inclusion.
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg md:text-xl text-[#3a4043]/80 font-medium leading-relaxed">
              Empowering neurodivergent talents to find inclusive opportunities
              and employers who celebrate cognitive diversity.
            </p>
          </div>

          {/* Search Bar Section */}
          <div className="mb-16 mt-10">
            <div className="max-w-2xl">
              <form onSubmit={(e) => { e.preventDefault(); console.log("Searching..."); }} className="relative">
                <input
                  type="text"
                  placeholder="Search jobs, inclusive employers, coaches & more..."
                  className="w-full px-6 py-4 pr-12 text-lg border border-[#e8e6f0] rounded-xl 
                    focus:ring-[#635bff] focus:border-[#635bff] outline-none transition-all 
                    text-[#3a4043] bg-white/90 backdrop-blur-sm shadow-lg"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 
                    bg-[#635bff] hover:bg-[#827CFF] text-white p-2 rounded-lg transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </button>
              </form>

              {/* Search Suggestions */}
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="text-sm text-[#3a4043]">Popular searches:</span>
                {["Analyst", "Content Marketing", "Designer", "Engineer", "HR"].map(
                  (tag) => (
                    <button
                      key={tag}
                      className="px-3 py-1 bg-white/60 border border-[#e8e6f0] 
                        rounded-full text-sm text-[#635bff] hover:bg-[#635bff] hover:text-white 
                        transition-colors"
                    >
                      {tag}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Job Listings Section */}
          <div className="mt-20">
            <h2 className="text-4xl md:text-4xl text-[#635bff] font-bold">
              Inclusive Careers For You.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-10">
            {[
              {
                id: "1",
                logo: "/Google_logo.png",
                alt: "Google Logo",
                title: "UX Designer",
                location: "Hybrid",
                schedule: "Flexible work hour",
                salary: "RM65k - 85k / annum",
              },
              {
                id: "2",
                logo: "/PwC_Logo.png",
                alt: "PwC Logo",
                title: "Consultant",
                location: "Remote",
                schedule: "Flexible work hour",
                salary: "RM80k - 110k / annum",
              },
              {
                id: "3",
                logo: "/Gamuda_Logo.png",
                alt: "Gamuda Logo",
                title: "Developer",
                location: "Remote",
                schedule: "Flexible work hour",
                salary: "RM70k - 90k / annum",
              },
              {
                id: "4",
                logo: "/SLB_Logo.png",
                alt: "SLB Logo",
                title: "Data Analyst",
                location: "Part time",
                schedule: "Flexible work hour",
                salary: "RM40k - 55k / annum",
              },
            ].map((job, index) => (
              <div
                key={index}
                className="bg-white/60 backdrop-blur-sm rounded-xl border border-[#f0eef5] p-6"
              >
                <div className="flex justify-center mb-4">
                  <img
                    src={job.logo}
                    alt={job.alt}
                    style={{ width: "auto", height: "80px" }}
                    className="mx-auto"
                  />
                </div>
                <h3 className="text-lg font-semibold text-[#3a4043] mb-2 text-center">
                  {job.title}
                </h3>
                <div className="text-center text-sm text-[#3a4043] space-y-1">
                  <p>{job.location}</p>
                  <p>{job.schedule}</p>
                  <p>{job.salary}</p>
                  <button className="text-sm md:text-base bg-[#635bff] text-white px-5 py-3 rounded-full hover:bg-[#827CFF] transition-colors mt-3">
                    Apply Now
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Job Coaches Section */}
          <div className="mt-20">
            <h2 className="text-4xl md:text-4xl my-10 text-[#635bff] font-bold">
              Job Coaches Matches To You.
            </h2>

            <div className="grid md:grid-cols-3 gap-8 mb-10">
              {[
                {
                  name: "Lee Chee Tat",
                  expertise: "Autism Spectrum Condition",
                  image: "/LeeCheeTat.png",
                  title:
                    "Certified Professional Coach, Neurodiversity-Affirming Coach.",
                  description:
                    "Guiding autistic adults through job search, interview preparation, and workplace communication for over 10 years, focusing on building sustainable careers.",
                },
                {
                  name: "John Stefan",
                  expertise: "ADHD and Dyslexia",
                  image: "/JohnStefan.png",
                  title:
                    "ADHD Coach Practitioner, Certified Career Services Provider.",
                  description:
                    "8 years of experience leveraging neurodivergent strengths to passionately connect clients with roles that embrace unique cognitive styles.",
                },
                {
                  name: "Dr. Isaac Ebi",
                  expertise: "Dyslexia and Dyspraxia",
                  image: "/DrIsaacEbi.png",
                  title:
                    "Ph.D. in Occupational Psychology, ICF Professional Certified Coach.",
                  description:
                    "Over 15 years of expertise in career development and organizational psychology, specializing in guiding career transitions and advising employers on inclusive practices.",
                },
              ].map((coach, i) => (
                <div
                  key={i}
                  className="text-center bg-white rounded-xl p-6 shadow-lg border border-gray-200"
                >
                  <div className="w-24 h-24 bg-[#6b8a7a] rounded-full mx-auto mb-4 flex items-center justify-center overflow-hidden">
                    <img
                      src={coach.image}
                      alt={`Profile photo of ${coach.name}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h3 className="text-xl font-semibold text-[#3a4043] mb-2">
                    {coach.name}
                  </h3>
                  <p className="text-[#635bff] mb-3">
                    Expert in <br />
                    {coach.expertise}
                  </p>
                  <p className="text-sm text-[#3a4043] mb-3">
                    <em>{coach.title}</em>
                  </p>
                  <p className="text-sm text-[#3a4043]">{coach.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      
      {/* Section 1: Our Story - Hero with Image Grid */}
      <section className="py-32 px-4 sm:px-6 lg:px-8 bg-transparent">
        <div className="max-w-[1400px] mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold text-[#3a4043] mb-8 leading-[0.95]">
                <i> Where talents find their ideal setting</i>
              </h1>
              <p className="text-xl md:text-2xl text-[#3a4043]/80 leading-relaxed">
                Talent Spectrum aims to support challenged individuals to find employment in workspaces they belong, and for employers to recruit unsung talent that can thrive in their environment.
              </p>
            </div>

            {/* Image Grid - Inspired by Linktree later phase 2 i add */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-orange-200 to-orange-400 rounded-3xl h-48 flex items-center  justify-center text-black font-bold text-xl shadow-xl bg-cover"
                  style={{
                    backgroundImage: "url('/About_Discover.jpg')",
                  }}>
                  Discover
                </div>
                <div className="bg-gradient-to-br from-yellow-200 to-yellow-500 rounded-3xl h-64 flex items-center justify-center text-gray-800 font-bold text-xl shadow-xl bg-cover"
                  style={{
                    backgroundImage: "url('/About_Connect.jpg')",
                  }}>
                  Connect
                </div>
              </div>
              <div className="space-y-4 mt-8">
                <div className="rounded-3xl h-64 flex items-center justify-center text-black font-bold text-xl shadow-xl bg-cover"
                  style={{
                    backgroundImage: "url('/About_Express.jpg')",
                  }}>
                  Express
                </div>
                <div className="bg-gradient-to-br from-indigo-300 to-indigo-500 rounded-3xl h-48 flex items-center justify-center text-black font-bold text-xl shadow-xl bg-cover"
                  style={{
                    backgroundImage: "url('/About_Employ.jpg')",
                  }}>
                  Employ
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      <section className="py-32 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-indigo-900 to-purple-900 text-white">
        <div className="max-w-[1400px] mx-auto">
          <div className="mb-20 text-center">
            <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold text-[#ffffff] mb-8 leading-[0.95]">
              Our Team
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8 mb-10">
            <div className="text-center bg-white rounded-xl p-6 shadow-lg border border-gray-200">
              <div className="w-24 h-24 bg-[#6b8a7a] rounded-full mx-auto mb-4 flex items-center justify-center overflow-hidden">
                <img src="/LeeCheeTat.png"
                  alt="Profile photo of Lee Chee Tat"
                  className="w-full h-full object-cover" />
              </div>
              <h3 className="text-xl font-semibold text-[#3a4043] mb-2">Lee Chee Tat</h3>
              <p className="text-[#635bff] mb-3">Expert in <br></br>Autism Spectrum Condition</p>
              <p className="text-sm text-[#3a4043] mb-3">
                <em>Certified Professional Coach, Neurodiversity-Affirming Coach.</em>
              </p>
              <p className="text-sm text-[#3a4043]">
                Guiding autistic adults through job search, interview preparation, and workplace communication for over 10 years, focusing on building sustainable careers.
              </p>
            </div>

            <div className="text-center bg-white rounded-xl p-6 shadow-lg border border-gray-200">
              <div className="w-24 h-24 bg-[#6b8a7a] rounded-full mx-auto mb-4 flex items-center justify-center overflow-hidden">
                <img src="/JohnStefan.png"
                  alt="Profile photo of John Stefan"
                  className="w-full h-full object-cover" />
              </div>
              <h3 className="text-xl font-semibold text-[#3a4043] mb-2">John Stefan</h3>
              <p className="text-[#635bff] mb-3">Expert in <br></br>ADHD and Dyslexia</p>
              <p className="text-sm text-[#3a4043] mb-3">
                <em>ADHD Coach Practitioner, Certified Career Services Provider.</em>
              </p>
              <p className="text-sm text-[#3a4043]">
                8 years of experience leveraging neurodivergent strengths to passionately connect clients with roles that embrace unique cognitive styles.
              </p>
            </div>

            <div className="text-center bg-white rounded-xl p-6 shadow-lg border border-gray-200">
              <div className="w-24 h-24 bg-[#6b8a7a] rounded-full mx-auto mb-4 flex items-center justify-center overflow-hidden">
                <img src="/DrIsaacEbi.png"
                  alt="Profile photo of Dr. Isaac Ebi"
                  className="w-full h-full object-cover" />
              </div>
              <h3 className="text-xl font-semibold text-[#3a4043] mb-2">Dr. Isaac Ebi</h3>
              <p className="text-[#635bff] mb-3">Expert in <br></br>Dyslexia and Dyspraxia</p>
              <p className="text-sm text-[#3a4043] mb-3">
                <em>Ph.D. in Occupational Psychology, ICF Professional Certified Coach.</em>
              </p>
              <p className="text-sm text-[#3a4043]">
                Over 15 years of expertise in career development and organizational psychology, specializing in guiding career transitions and advising employers on inclusive practices.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Who We Serve - Light Pink/Purple Background */}
      <section className="py-32 px-4 sm:px-6 lg:px-8 bg-transparent">
        <div className="max-w-[1400px] mx-auto">
          <div className="mb-20 text-center">
            <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold text-[#3a4043] mb-8 leading-[0.95]">
              <i>Built to find the best connections</i>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-3xl p-10 shadow-xl border border-purple-100 hover:shadow-2xl transition-all">
              <div className="w-20 h-20 bg-purple-100 rounded-2xl flex items-center justify-center mb-6">
                <span className="text-4xl">👤</span>
              </div>
              <h3 className="text-3xl font-bold text-[#3a4043] mb-4">
                Job Seekers
              </h3>
              <p className="text-[#3a4043]/70 text-lg">
                Find roles that match your talents, with the right environment for an optimally comfortable work life
              </p>
            </div>

            <div className="bg-white rounded-3xl p-10 shadow-xl border border-emerald-100 hover:shadow-2xl transition-all">
              <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center mb-6">
                <span className="text-4xl">🏢</span>
              </div>
              <h3 className="text-3xl font-bold text-[#3a4043] mb-4">
                Employers
              </h3>
              <p className="text-[#3a4043]/70 text-lg">
                Hire people who fit your work environment, and provide transparency to interest willing applicants
              </p>
            </div>

            <div className="bg-white rounded-3xl p-10 shadow-xl border border-orange-100 hover:shadow-2xl transition-all">
              <div className="w-20 h-20 bg-orange-100 rounded-2xl flex items-center justify-center mb-6">
                <span className="text-4xl">🎓</span>
              </div>
              <h3 className="text-3xl font-bold text-[#3a4043] mb-4">
                Job Coaches
              </h3>
              <p className="text-[#3a4043]/70 text-lg">
                Guide clients with powerful insights, with their needs and preferences as a addressable priority
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Our Values */}
      <section className="relative w-full h-[600px] overflow-hidden text-white select-none">
        {/* Slides Container */}
        <div
          className="flex h-full"
          style={transitionStyle}
          onTransitionEnd={handleTransitionEnd}
        >
          {loopedSlides.map((slide, i) => (
            <div
              key={i}
              className="w-full h-full flex-shrink-0 relative flex items-center justify-center text-center text-white bg-cover"
              style={{
                backgroundImage: `url(${slide.bg})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              {/* Overlay for readability */}
              <div className="absolute inset-0 bg-black/50" />

              {/* Text content */}
              <div className="relative z-10 px-8">
                <h3 className="text-5xl font-bold mb-4 drop-shadow-lg">
                  {slide.title}
                </h3>
                <p className="text-lg text-white/90 max-w-2xl mx-auto drop-shadow-md">
                  {slide.text}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Navigation Buttons */}
        <button
          onMouseDown={prevSlide}
          className="absolute left-0 top-0 h-full w-[10%] flex items-center justify-center bg-black/10 hover:bg-black/20 transition"
        >
          <ChevronLeft size={40} />
        </button>
        <button
          onMouseDown={nextSlide}
          className="absolute right-0 top-0 h-full w-[10%] flex items-center justify-center bg-black/10 hover:bg-black/20 transition"
        >
          <ChevronRight size={40} />
        </button>

        {/* Dots */}
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-3">
          {slides.map((_, i) => (
            <button
              key={i}
              onMouseDown={() => setCurrent(i + 1)} // +1 because of the clone offset
              className={`w-3 h-3 rounded-full transition ${i + 1 === current ? "bg-white scale-125" : "bg-white/40"
                }`}
            />
          ))}
        </div>
      </section>

      {/* Section 5: CTA Section */}
      <section className="py-32 px-4 sm:px-6 lg:px-8 bg-transparent">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold text-[#3a4043] mb-10 leading-tight">
            <i>Start your journey today!</i>
          </h2>
          <p className="text-2xl md:text-3xl text-[#3a4043]/60 mb-14">
            Find the perfect job for you
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Link
              href="/register"
              className="bg-[#635bff] hover:bg-[#4f46e5] text-white px-12 py-5 rounded-full font-semibold text-xl transition-all shadow-2xl hover:shadow-[#635bff]/50 hover:scale-105"
            >
              Register Now
            </Link>
            <Link
              href="/jobListing"
              className="bg-white hover:bg-[#635bff] text-[#635bff] border-2 border-[#635bff] px-12 py-5 rounded-full font-semibold text-xl transition-all shadow-xl hover:shadow-2xl hover:scale-105 hover:text-white hover:border-[#4f46e5]"
            >
              Search For Jobs
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
