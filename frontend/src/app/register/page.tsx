"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { signIn, getSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

const RegisterPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = searchParams.get('role') || 'CANDIDATE';
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: role as "CANDIDATE" | "EMPLOYER",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Check if user is already authenticated
    getSession().then((session) => {
      if (session) {
        router.push('/dashboard');
      }
    });
  }, [router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
  
    if (formData.password !== formData.confirmPassword) {
      alert("Passwords don't match!");
      return;
    }
  
    if (formData.password.length < 6) {
      alert("Password must be at least 6 characters long!");
      return;
    }
  
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
        }),
      });

      if (response.ok) {
        // Automatically sign in after registration
        const result = await signIn('credentials', {
          email: formData.email,
          password: formData.password,
          redirect: false,
        });

        if (result?.ok) {
          router.push('/dashboard');
        } else {
          setError("Registration successful, but sign-in failed. Please try logging in.");
        }
      } else {
        const data = await response.json();
        setError(data.message || "Registration failed. Please try again.");
      }
    } catch (error) {
      setError("An error occurred. Please try again.");
    }
  };  

  const handleGoogleSignIn = () => {
    signIn('google', { callbackUrl: '/dashboard' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 border border-[#e8e6f0]">
        <h2 className="text-2xl font-bold text-[#3a4043] mb-6 text-center">
          🌟 Create Account
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#3a4043] mb-1">
              Full Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-2 border border-[#e8e6f0] rounded-lg focus:ring-2 focus:ring-[#6b8a7a] focus:border-[#6b8a7a] outline-none transition-all text-[#3a4043] bg-[#faf9f7]"
              placeholder="Your full name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#3a4043] mb-1">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-2 border border-[#e8e6f0] rounded-lg focus:ring-2 focus:ring-[#6b8a7a] focus:border-[#6b8a7a] outline-none transition-all text-[#3a4043] bg-[#faf9f7]"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#3a4043] mb-1">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              required
              minLength={6}
              className="w-full px-4 py-2 border border-[#e8e6f0] rounded-lg focus:ring-2 focus:ring-[#6b8a7a] focus:border-[#6b8a7a] outline-none transition-all text-[#3a4043] bg-[#faf9f7]"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#3a4043] mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              required
              minLength={6}
              className="w-full px-4 py-2 border border-[#e8e6f0] rounded-lg focus:ring-2 focus:ring-[#6b8a7a] focus:border-[#6b8a7a] outline-none transition-all text-[#3a4043] bg-[#faf9f7]"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-[#6b8a7a] hover:bg-[#5d7c6b] text-white font-medium py-2.5 rounded-lg transition-colors"
          >
            Sign Up
          </button>
        </form>

        {/* Divider */}
        <div className="my-6 flex items-center">
          <div className="flex-grow border-t border-[#e8e6f0]"></div>
          <span className="mx-2 text-sm text-[#3a4043]">or</span>
          <div className="flex-grow border-t border-[#e8e6f0]"></div>
        </div>

        {/* Google Sign Up */}
        <button
          type="button"
          className="w-full flex items-center justify-center gap-2 bg-white border border-[#e8e6f0] hover:bg-[#faf9f7] text-[#3a4043] font-medium py-2.5 rounded-lg transition-colors"
          onClick={() => alert("Google Auth integration goes here")}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <div className="mt-6 text-center text-sm text-[#3a4043]">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-[#6b8a7a] hover:text-[#5d7c6b] font-medium"
          >
            Sign in
          </Link>
        </div>

        {/* Back to Home */}
        <div className="mt-4 text-center">
          <Link
            href="/"
            className="text-sm text-[#6b8a7a] hover:underline"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
