import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";

// Mock supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      verifyOtp: vi.fn(),
      resend: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    })),
    functions: { invoke: vi.fn() },
  },
}));

// Mock lovable auth
vi.mock("@/integrations/lovable/index", () => ({
  lovable: {
    auth: {
      signInWithOAuth: vi.fn(),
    },
  },
}));

// Mock react-query
vi.mock("@tanstack/react-query", () => ({
  QueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
  })),
  QueryClientProvider: ({ children }: any) => children,
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQuery: () => ({ data: null, isLoading: false }),
}));

import { AuthProvider } from "@/hooks/useAuth";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import VerifyEmail from "@/pages/VerifyEmail";
import { SocialLoginButtons } from "@/components/SocialLoginButtons";

const renderWithProviders = (ui: React.ReactElement, route = "/") => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  );
};

describe("Login page", () => {
  it("renders login form with email and password fields", () => {
    renderWithProviders(<Login />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("renders social login buttons", () => {
    renderWithProviders(<Login />);
    expect(screen.getByRole("button", { name: /google/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apple/i })).toBeInTheDocument();
  });

  it("has link to signup and forgot password", () => {
    renderWithProviders(<Login />);
    expect(screen.getByText(/create account/i)).toBeInTheDocument();
    expect(screen.getByText(/forgot password/i)).toBeInTheDocument();
  });
});

describe("Signup page", () => {
  it("renders signup form with name, email, and password fields", () => {
    renderWithProviders(<Signup />);
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
  });

  it("renders social login buttons on signup", () => {
    renderWithProviders(<Signup />);
    expect(screen.getByRole("button", { name: /google/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apple/i })).toBeInTheDocument();
  });
});

describe("SocialLoginButtons", () => {
  it("renders Google and Apple buttons", () => {
    render(
      <MemoryRouter>
        <SocialLoginButtons />
      </MemoryRouter>
    );
    expect(screen.getByRole("button", { name: /google/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apple/i })).toBeInTheDocument();
  });

  it("shows 'Or continue with' divider", () => {
    render(
      <MemoryRouter>
        <SocialLoginButtons />
      </MemoryRouter>
    );
    expect(screen.getByText(/or continue with/i)).toBeInTheDocument();
  });
});

describe("VerifyEmail page", () => {
  it("redirects to signup when no email in state", () => {
    renderWithProviders(<VerifyEmail />);
    // Should redirect, so verify-email content should not be present
    expect(screen.queryByText(/check your email/i)).not.toBeInTheDocument();
  });
});
