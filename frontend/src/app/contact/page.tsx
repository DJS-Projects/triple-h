"use client";

import Link from "next/link";
import { useState } from "react";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: ""
  });


  const [errors, setErrors] = useState({
    email: ""
  });

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Validate email on change
    if (name === "email") {
      if (value && !validateEmail(value)) {
        setErrors(prev => ({
          ...prev,
          email: "Please enter a valid email address"
        }));
      } else {
        setErrors(prev => ({
          ...prev,
          email: ""
        }));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate email before submission
    if (!validateEmail(formData.email)) {
      setErrors(prev => ({
        ...prev,
        email: "Please enter a valid email address"
      }));
      return;
    }

    console.log("Contact form data:", formData);
    alert("Thank you for your message! We'll get back to you soon.");
    // Reset form
    setFormData({
      name: "",
      email: "",
      subject: "",
      message: ""
    });
    setErrors({ email: "" });
  };

  return (
    <div
      className="relative min-h-screen bg-cover bg-center bg-no-repeat py-8 px-4 font-['Plus_Jakarta_Sans',_sans-serif]"
      style={{
        backgroundImage: "url('/TalentSpectrumBackground.png')",
        backgroundAttachment: "fixed",
      }}
    >
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="block text-[clamp(2.8rem,5vw,5.5rem)] font-extrabold tracking-tight 
                  bg-clip-text text-white 
                  bg-[linear-gradient(115deg,#1a1a1a,#635bff,#9a96ff)] 
                  drop-shadow-[2px_2px_10px_rgba(0,0,0,0.25)]">
            Get In Touch
          </h1>
          <p className="text-xl text-white max-w-3xl mx-auto">
            Have questions about our platform? Want to partner with us?<br></br> We&apos;d love to hear from you!
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div className="bg-white rounded-xl p-8 shadow-lg border border-[#e8e6f0]">
            <h2 className="text-2xl font-bold text-[#3a4043] mb-6">Send us a message:</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-[#3a4043] mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 border border-[#e8e6f0] rounded-lg focus:ring-2 focus:ring-[#6b8a7a] focus:border-[#6b8a7a] outline-none transition-all text-[#3a4043] bg-[#faf9f7]"
                  placeholder="Your full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#3a4043] mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#6b8a7a] focus:border-[#6b8a7a] outline-none transition-all text-[#3a4043] bg-[#faf9f7] ${
                    errors.email ? 'border-red-500' : 'border-[#e8e6f0]'
                  }`}
                  placeholder="your@email.com"
                />
                {errors.email && (
                  <p className="text-red-500 text-sm mt-1">{errors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-[#3a4043] mb-2">
                  Subject
                </label>
                <select
                  name="subject"
                  value={formData.subject}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 border border-[#e8e6f0] rounded-lg focus:ring-2 focus:ring-[#6b8a7a] focus:border-[#6b8a7a] outline-none transition-all text-[#3a4043] bg-[#faf9f7]"
                >
                  <option value="">Select a subject</option>
                  <option value="general">General Inquiry</option>
                  <option value="support">Technical Support</option>
                  <option value="partnership">Partnership Opportunity</option>
                  <option value="feedback">Feedback</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#3a4043] mb-2">
                  Message
                </label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  required
                  rows={19}
                  className="w-full px-4 py-3 border border-[#e8e6f0] rounded-lg focus:ring-2 focus:ring-[#6b8a7a] focus:border-[#6b8a7a] outline-none transition-all text-[#3a4043] bg-[#faf9f7]"
                  placeholder="Tell us how we can help you..."
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#635bff] hover:bg-[#827CFF] text-white font-medium py-3 rounded-lg transition-colors"              >
                Send Message
              </button>
            </form>
          </div>

          {/* Contact Information */}
          <div className="space-y-8">
            <div className="bg-white rounded-xl p-8 shadow-lg border border-[#e8e6f0]">
              <h2 className="text-2xl font-bold text-[#3a4043] mb-6">Contact Information:</h2>
              
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="text-2xl"></div>
                  <div>
                    <h3 className="font-semibold text-[#3a4043] mb-1">Email</h3>
                    <a 
                      href="mailto:enquiry@talentspectrum.com" 
                      className="text-[#635bff] hover:text-[#827CFF] transition-colors duration-200 underline hover:underline-offset-2"
                    >
                      enquiry@talentspectrum.com
                    </a>
                    <p className="text-sm text-[#3a4043]">We typically respond within one work day.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="text-2xl"></div>
                  <div>
                    <h3 className="font-semibold text-[#3a4043] mb-1">WhatsApp</h3>
                    <a 
                       href="https://wa.me/60123456789" 
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#635bff] hover:text-[#827CFF] transition-colors duration-200 underline hover:underline-offset-2"
                    >
                      +60123456789
                    </a>
                    <p className="text-sm text-[#3a4043]">Operating hour: Monday - Friday, 9am - 6pm (GMT+8)</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="text-2xl"></div>
                  <div>
                    <h3 className="font-semibold text-[#3a4043] mb-1">HQ Address</h3>
                    <p className="text-[#635bff]">6rAIn Plt.</p>
                    <p className="text-sm text-[#3a4043]">Menara Mustapha Kamal,<br />Level 7, Block A,<br />47820 Petaling Jaya,<br /> Selangor Darul Ehsan,<br />Malaysia.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-lg border border-[#e8e6f0]">
              <h2 className="text-2xl font-bold text-[#3a4043] mb-6">Map:</h2>
  
              <div className="space-y-4">
              <div className="w-full h-[400px] rounded-lg overflow-hidden border border-[#e8e6f0]">
              <iframe
                             src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3983.7244934307646!2d101.61009747529395!3d3.167097396808257!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31cc4f337f5b4ff9%3A0xfc3e77b863f10f0b!2sMenara%20Mustapha%20Kamal!5e0!3m2!1sen!2smy!4v1760688780314!5m2!1sen!2smy"
                              width="100%"
                              height="100%"
                              style={{ border: 0 }}
                              allowFullScreen={true}
                             loading="lazy"
                             referrerPolicy="no-referrer-when-downgrade"
                              title="Talent Spectrum HQ Location"
                            ></iframe>
            </div>
  </div>
</div>
          </div>
        </div>
      </div>
    </div>
  );
}
