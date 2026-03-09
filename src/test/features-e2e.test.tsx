/**
 * E2E Feature Tests
 * Covers:
 * 1. 14-day free trial notice on signup
 * 2. User profile — personal info & delete account
 * 3. Pricing page — AUD 4.99/month & AUD 50/year
 * 4. Stripe payment — checkout & customer portal
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { MemoryRouter } from "react-router-dom";

// ─── Supabase mock (no top-level vars in factory — use vi.fn() inline) ────────
vi.mock("@/integrations/supabase/client", () => {
  const functionsInvoke = vi.fn();
  const singleFn = vi.fn().mockResolvedValue({ data: { full_name: "Jane Doe", phone: "+61400000000" } });
  const eqFn = vi.fn().mockReturnValue({ single: singleFn });
  const selectFn = vi.fn().mockReturnValue({ eq: eqFn, single: singleFn });
  const updateFn = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  const fromFn = vi.fn().mockReturnValue({ select: selectFn, update: updateFn, eq: eqFn });

  return {
    supabase: {
      auth: {
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
        verifyOtp: vi.fn(),
        resend: vi.fn(),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
      },
      from: fromFn,
      functions: { invoke: functionsInvoke },
    },
  };
});

// ─── Lovable auth mock ────────────────────────────────────────────────────────
vi.mock("@/integrations/lovable/index", () => ({
  lovable: { auth: { signInWithOAuth: vi.fn() } },
}));

// ─── React Query mock ─────────────────────────────────────────────────────────
vi.mock("@tanstack/react-query", () => ({
  QueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
  QueryClientProvider: ({ children }: any) => children,
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQuery: () => ({ data: null, isLoading: false }),
}));

// ─── Auth context mock ────────────────────────────────────────────────────────
const mockSignOut = vi.fn();
const mockUseAuth = vi.fn();

vi.mock("@/hooks/useAuth", () => ({
  AuthProvider: ({ children }: any) => children,
  useAuth: () => mockUseAuth(),
}));

// ─── Subscription context mock ────────────────────────────────────────────────
const mockUseSubscription = vi.fn();

vi.mock("@/hooks/useSubscription", () => ({
  SubscriptionProvider: ({ children }: any) => children,
  useSubscription: () => mockUseSubscription(),
}));

// ─── Navigate mock ────────────────────────────────────────────────────────────
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

// ─── Sonner mock ──────────────────────────────────────────────────────────────
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ─── window.open mock ─────────────────────────────────────────────────────────
const mockWindowOpen = vi.fn();
Object.defineProperty(window, "open", { value: mockWindowOpen, writable: true });

// ─── Imports (after mocks) ────────────────────────────────────────────────────
import Signup from "@/pages/Signup";
import Profile from "@/pages/Profile";
import Pricing from "@/pages/Pricing";
import { PLANS } from "@/lib/subscription";

// ─── Helper to get the mocked supabase at runtime ────────────────────────────
async function getSupabase() {
  const mod = await import("@/integrations/supabase/client");
  return mod.supabase;
}

// ─── Render helper ────────────────────────────────────────────────────────────
const renderWithRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

// ─── Default mock states ──────────────────────────────────────────────────────
const trialSubscriptionState = {
  subscribed: false,
  trialActive: true,
  trialEndsAt: "2026-03-23T00:00:00Z",
  subscriptionEnd: null,
  productId: null,
  loading: false,
  hasAccess: true,
  checkSubscription: vi.fn(),
};

const activeSubscriptionState = {
  subscribed: true,
  trialActive: false,
  trialEndsAt: null,
  subscriptionEnd: "2027-03-09T00:00:00Z",
  productId: "prod_U7CB8D5NWETZ2z",
  loading: false,
  hasAccess: true,
  checkSubscription: vi.fn(),
};

const expiredSubscriptionState = {
  subscribed: false,
  trialActive: false,
  trialEndsAt: "2026-02-01T00:00:00Z",
  subscriptionEnd: null,
  productId: null,
  loading: false,
  hasAccess: false,
  checkSubscription: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: null, signOut: mockSignOut });
  mockUseSubscription.mockReturnValue(trialSubscriptionState);
});

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE 1 — 14-day free trial notice on signup
// ══════════════════════════════════════════════════════════════════════════════
describe("Feature 1: 14-day free trial notice on signup", () => {
  it("displays the 14-day free trial banner on the signup page", () => {
    renderWithRouter(<Signup />);
    expect(screen.getByText(/14-day free trial/i)).toBeInTheDocument();
  });

  it("mentions no credit card required in the trial notice", () => {
    renderWithRouter(<Signup />);
    expect(screen.getByText(/no credit card required/i)).toBeInTheDocument();
  });

  it("trial notice is visible without any user interaction", () => {
    renderWithRouter(<Signup />);
    expect(screen.getByText(/14-day free trial/i)).toBeVisible();
  });

  it("signup form has all required fields alongside the trial notice", () => {
    renderWithRouter(<Signup />);
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByText(/14-day free trial/i)).toBeInTheDocument();
  });

  it("calls supabase.auth.signUp with user data on form submit", async () => {
    const supabase = await getSupabase();
    (supabase.auth.signUp as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: null });

    renderWithRouter(<Signup />);

    await userEvent.type(screen.getByLabelText(/full name/i), "Jane Doe");
    await userEvent.type(screen.getByLabelText(/email/i), "jane@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "password123");
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "jane@example.com",
          password: "password123",
          options: expect.objectContaining({
            data: { full_name: "Jane Doe" },
          }),
        })
      );
    });
  });

  it("redirects to verify-email after successful signup", async () => {
    const supabase = await getSupabase();
    (supabase.auth.signUp as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: null });

    renderWithRouter(<Signup />);

    await userEvent.type(screen.getByLabelText(/full name/i), "Jane Doe");
    await userEvent.type(screen.getByLabelText(/email/i), "jane@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "password123");
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        "/verify-email",
        expect.objectContaining({ state: { email: "jane@example.com" } })
      );
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE 2 — User profile: personal info & delete account
// ══════════════════════════════════════════════════════════════════════════════
describe("Feature 2: User profile — personal info & delete account", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-123", email: "jane@example.com" },
      signOut: mockSignOut,
    });
  });

  it("renders the profile page with a Personal Information section", () => {
    renderWithRouter(<Profile />);
    expect(screen.getByText(/personal information/i)).toBeInTheDocument();
  });

  it("displays the user's email on the profile page", () => {
    renderWithRouter(<Profile />);
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
  });

  it("shows Full Name and Phone Number input fields", () => {
    renderWithRouter(<Profile />);
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
  });

  it("has a Save Changes button", () => {
    renderWithRouter(<Profile />);
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
  });

  it("renders subscription status section", () => {
    renderWithRouter(<Profile />);
    expect(screen.getByText(/subscription/i)).toBeInTheDocument();
  });

  it("shows 'Free Trial' badge when in trial period", () => {
    renderWithRouter(<Profile />);
    expect(screen.getByText(/free trial/i)).toBeInTheDocument();
  });

  it("shows 'Active Subscriber' badge when subscribed", () => {
    mockUseSubscription.mockReturnValue(activeSubscriptionState);
    renderWithRouter(<Profile />);
    expect(screen.getByText(/active subscriber/i)).toBeInTheDocument();
  });

  it("shows 'Expired' badge when trial has ended and not subscribed", () => {
    mockUseSubscription.mockReturnValue(expiredSubscriptionState);
    renderWithRouter(<Profile />);
    expect(screen.getByText(/expired/i)).toBeInTheDocument();
  });

  it("shows 'View Plans' button when not subscribed", () => {
    renderWithRouter(<Profile />);
    expect(screen.getByRole("button", { name: /view plans/i })).toBeInTheDocument();
  });

  it("'View Plans' navigates to /pricing", () => {
    renderWithRouter(<Profile />);
    fireEvent.click(screen.getByRole("button", { name: /view plans/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/pricing");
  });

  it("shows 'Manage Subscription' button when subscribed", () => {
    mockUseSubscription.mockReturnValue(activeSubscriptionState);
    renderWithRouter(<Profile />);
    expect(screen.getByRole("button", { name: /manage subscription/i })).toBeInTheDocument();
  });

  it("renders Danger Zone section with Delete Account button", () => {
    renderWithRouter(<Profile />);
    expect(screen.getByText(/danger zone/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete account/i })).toBeInTheDocument();
  });

  it("shows confirmation dialog when Delete Account is clicked", async () => {
    renderWithRouter(<Profile />);
    fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
    await waitFor(() => {
      expect(screen.getByText(/are you absolutely sure/i)).toBeInTheDocument();
    });
  });

  it("confirmation dialog warns about permanent data loss", async () => {
    renderWithRouter(<Profile />);
    fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
    await waitFor(() => {
      // Dialog shows specific warning about all data (applications, notes, etc.)
      expect(
        screen.getByText(/all your job applications, notes, contacts/i)
      ).toBeInTheDocument();
    });
  });

  it("calls delete-account edge function and signs out on confirm", async () => {
    const supabase = await getSupabase();
    (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { success: true },
      error: null,
    });

    renderWithRouter(<Profile />);
    fireEvent.click(screen.getByRole("button", { name: /delete account/i }));

    await waitFor(() => screen.getByRole("button", { name: /yes, delete my account/i }));
    fireEvent.click(screen.getByRole("button", { name: /yes, delete my account/i }));

    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledWith("delete-account");
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("Cancel button closes the delete confirmation dialog", async () => {
    renderWithRouter(<Profile />);
    fireEvent.click(screen.getByRole("button", { name: /delete account/i }));

    await waitFor(() => screen.getByText(/are you absolutely sure/i));
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    await waitFor(() => {
      expect(screen.queryByText(/are you absolutely sure/i)).not.toBeInTheDocument();
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE 3 — Pricing page: AUD 4.99/month & AUD 50/year
// ══════════════════════════════════════════════════════════════════════════════
describe("Feature 3: Pricing page — AUD 4.99/month & AUD 50/year", () => {
  it("renders the pricing page with 'Choose Your Plan' heading", () => {
    renderWithRouter(<Pricing />);
    expect(screen.getByText(/choose your plan/i)).toBeInTheDocument();
  });

  it("shows the monthly price of $4.99 AUD", () => {
    renderWithRouter(<Pricing />);
    // Price span renders as "$4.99"
    expect(screen.getByText("$4.99")).toBeInTheDocument();
    expect(screen.getByText(/AUD\/month/i)).toBeInTheDocument();
  });

  it("shows the yearly price of $50 AUD", () => {
    renderWithRouter(<Pricing />);
    // Price span renders as "$50"
    expect(screen.getByText("$50")).toBeInTheDocument();
    expect(screen.getByText(/AUD\/year/i)).toBeInTheDocument();
  });

  it("PLANS config has correct AUD monthly price of 4.99", () => {
    expect(PLANS.monthly.price).toBe(4.99);
    expect(PLANS.monthly.currency).toBe("AUD");
    expect(PLANS.monthly.interval).toBe("month");
  });

  it("PLANS config has correct AUD yearly price of 50", () => {
    expect(PLANS.yearly.price).toBe(50);
    expect(PLANS.yearly.currency).toBe("AUD");
    expect(PLANS.yearly.interval).toBe("year");
  });

  it("shows 'Get Monthly' and 'Get Yearly' buttons when not subscribed", () => {
    renderWithRouter(<Pricing />);
    expect(screen.getByRole("button", { name: /get monthly/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /get yearly/i })).toBeInTheDocument();
  });

  it("shows 'Best Value' badge on yearly plan", () => {
    renderWithRouter(<Pricing />);
    expect(screen.getByText(/best value/i)).toBeInTheDocument();
  });

  it("shows savings text on yearly plan", () => {
    renderWithRouter(<Pricing />);
    expect(screen.getByText(/save 17%/i)).toBeInTheDocument();
  });

  it("displays feature list on both plans", () => {
    renderWithRouter(<Pricing />);
    expect(screen.getAllByText(/unlimited job applications/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/dashboard analytics/i).length).toBeGreaterThanOrEqual(1);
  });

  it("shows trial-active message when trial is active", () => {
    renderWithRouter(<Pricing />);
    expect(screen.getByText(/your free trial is active/i)).toBeInTheDocument();
  });

  it("shows subscribed message when user is subscribed", () => {
    mockUseSubscription.mockReturnValue(activeSubscriptionState);
    renderWithRouter(<Pricing />);
    expect(screen.getByText(/you're already subscribed/i)).toBeInTheDocument();
  });

  it("shows trial-ended message when neither trial nor subscribed", () => {
    mockUseSubscription.mockReturnValue(expiredSubscriptionState);
    renderWithRouter(<Pricing />);
    expect(screen.getByText(/your trial has ended/i)).toBeInTheDocument();
  });

  it("disables buttons and shows 'Current Plan' when user is subscribed", () => {
    mockUseSubscription.mockReturnValue(activeSubscriptionState);
    renderWithRouter(<Pricing />);
    const buttons = screen.getAllByRole("button", { name: /current plan/i });
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    buttons.forEach((btn) => expect(btn).toBeDisabled());
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE 4 — Stripe payment: checkout & customer portal
// ══════════════════════════════════════════════════════════════════════════════
describe("Feature 4: Stripe payment — checkout & customer portal", () => {
  it("PLANS config has valid Stripe price IDs", () => {
    expect(PLANS.monthly.price_id).toMatch(/^price_/);
    expect(PLANS.yearly.price_id).toMatch(/^price_/);
  });

  it("PLANS config has valid Stripe product IDs", () => {
    expect(PLANS.monthly.product_id).toMatch(/^prod_/);
    expect(PLANS.yearly.product_id).toMatch(/^prod_/);
  });

  it("monthly and yearly plans have different price_ids", () => {
    expect(PLANS.monthly.price_id).not.toBe(PLANS.yearly.price_id);
  });

  it("monthly and yearly plans have different product_ids", () => {
    expect(PLANS.monthly.product_id).not.toBe(PLANS.yearly.product_id);
  });

  it("calls create-checkout with monthly price_id when 'Get Monthly' is clicked", async () => {
    const supabase = await getSupabase();
    (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { url: "https://checkout.stripe.com/monthly" },
      error: null,
    });

    renderWithRouter(<Pricing />);
    fireEvent.click(screen.getByRole("button", { name: /get monthly/i }));

    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        "create-checkout",
        expect.objectContaining({ body: { priceId: PLANS.monthly.price_id } })
      );
    });
  });

  it("calls create-checkout with yearly price_id when 'Get Yearly' is clicked", async () => {
    const supabase = await getSupabase();
    (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { url: "https://checkout.stripe.com/yearly" },
      error: null,
    });

    renderWithRouter(<Pricing />);
    fireEvent.click(screen.getByRole("button", { name: /get yearly/i }));

    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        "create-checkout",
        expect.objectContaining({ body: { priceId: PLANS.yearly.price_id } })
      );
    });
  });

  it("opens Stripe checkout URL in a new tab after clicking monthly plan", async () => {
    const supabase = await getSupabase();
    (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { url: "https://checkout.stripe.com/monthly" },
      error: null,
    });

    renderWithRouter(<Pricing />);
    fireEvent.click(screen.getByRole("button", { name: /get monthly/i }));

    await waitFor(() => {
      expect(mockWindowOpen).toHaveBeenCalledWith(
        "https://checkout.stripe.com/monthly",
        "_blank"
      );
    });
  });

  it("opens Stripe checkout URL in a new tab after clicking yearly plan", async () => {
    const supabase = await getSupabase();
    (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { url: "https://checkout.stripe.com/yearly" },
      error: null,
    });

    renderWithRouter(<Pricing />);
    fireEvent.click(screen.getByRole("button", { name: /get yearly/i }));

    await waitFor(() => {
      expect(mockWindowOpen).toHaveBeenCalledWith(
        "https://checkout.stripe.com/yearly",
        "_blank"
      );
    });
  });

  it("shows error toast when checkout call fails", async () => {
    const supabase = await getSupabase();
    const { toast } = await import("sonner");
    (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: null,
      error: new Error("Network error"),
    });

    renderWithRouter(<Pricing />);
    fireEvent.click(screen.getByRole("button", { name: /get monthly/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it("calls customer-portal edge function when 'Manage Subscription' is clicked", async () => {
    mockUseSubscription.mockReturnValue(activeSubscriptionState);
    mockUseAuth.mockReturnValue({
      user: { id: "user-123", email: "jane@example.com" },
      signOut: mockSignOut,
    });

    const supabase = await getSupabase();
    (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { url: "https://billing.stripe.com/portal" },
      error: null,
    });

    renderWithRouter(<Profile />);
    fireEvent.click(screen.getByRole("button", { name: /manage subscription/i }));

    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledWith("customer-portal");
      expect(mockWindowOpen).toHaveBeenCalledWith(
        "https://billing.stripe.com/portal",
        "_blank"
      );
    });
  });
});
