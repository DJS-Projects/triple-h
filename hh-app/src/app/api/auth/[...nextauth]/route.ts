// talent-spectrum-app/src/app/api/auth/[...nextauth]/route.ts

// 1. Import necessary types from next-auth
import NextAuth, { AuthOptions, DefaultSession, DefaultUser } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
// No need to import JWT from 'next-auth/jwt' directly for type extension,
// as it's handled by declaring module 'next-auth/jwt'.

// 2. Extend NextAuth types correctly
// This ensures your custom properties (like 'role') are recognized throughout NextAuth's types.

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: string; // Your custom role property
    } & DefaultSession["user"]; // Merge with the default user properties
  }

  /**
   * The shape of the user object returned in the OAuth providers' `profile` callback,
   * or the Credentials provider's `authorize` callback.
   */
  interface User extends DefaultUser {
    id: string;
    name: string;
    email: string;
    role: string; // Your custom role property
  }
}

declare module "next-auth/jwt" {
  /**
   * Returned by the `jwt` callback and `getToken`, when using JWT sessions
   */
  interface JWT {
    id: string;
    name: string;
    email: string;
    role: string; // Your custom role property
  }
}

// 3. Define authOptions with explicit AuthOptions type
export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
        userType: { label: "User Type", type: "text" },
      },
      async authorize(credentials) { // Removed `req` as it's not used and simplifies typing
        if (!credentials?.email || !credentials?.password) {
          return null; // Return null if credentials are missing
        }

        try {
          // Call your backend login API
          const res = await fetch("http://127.0.0.1:8000/users/login", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          if (res.ok) {
            const user = await res.json();
            // If no error and we have user data, return it.
            // NextAuth expects a 'user' object with at least an 'id'.
            // Ensure the returned object matches the extended `User` interface.
            return {
              id: user.id.toString(), // Ensure id is a string
              name: user.name,
              email: user.email,
              role: user.role, // Pass the role from your backend
            };
          } else {
            // If the backend returns an error (e.g., 401 Unauthorized)
            const errorData = await res.json();
            console.error("Backend login error:", errorData.detail);
            // Throw an error to be caught by the frontend signIn function
            // This allows the frontend to display specific error messages.
            throw new Error(errorData.detail || "Invalid credentials");
          }
        } catch (error: any) {
          console.error("Error during login:", error);
          // Re-throw the error or return null based on desired frontend handling
          throw new Error(error.message || "An unexpected error occurred during login.");
        }
      },
    }),
    // GoogleProvider can be added here if needed, but we are ignoring it for this task.
  ],
  callbacks: {
    // 4. Callback parameters are now correctly typed by NextAuth due to `authOptions: AuthOptions`
    async jwt({ token, user }) {
      // The `user` object is only available on the first sign in (i.e., when `authorize` returns a user)
      if (user) { // `user` is now correctly typed as `User` (our extended type)
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      // Send properties to the client, like an access_token from a provider.
      // The `token` object is what we populated in the `jwt` callback.
      if (token) { // `token` is now correctly typed as `JWT` (our extended type)
        session.user.id = token.id;
        session.user.name = token.name;
        session.user.email = token.email;
        session.user.role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login", // Specify your custom login page
    // error: '/auth/error', // You can define a custom error page
  },
  session: {
    strategy: "jwt", // This should now be correctly inferred as `SessionStrategy`
  },
  secret: process.env.NEXTAUTH_SECRET, // IMPORTANT: Set this in your .env.local file
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };