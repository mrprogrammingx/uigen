import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAuth } from "../use-auth";
import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getAnonWorkData as any).mockReturnValue(null);
    (getProjects as any).mockResolvedValue([]);
    (createProject as any).mockResolvedValue({ id: "new-project-id" });
  });

  test("initial state exposes signIn, signUp, and isLoading", () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.isLoading).toBe(false);
    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
  });

  describe("signIn", () => {
    test("sets isLoading true while pending and false after completion", async () => {
      let resolveSignIn: (value: any) => void;
      (signInAction as any).mockReturnValue(
        new Promise((resolve) => {
          resolveSignIn = resolve;
        })
      );

      const { result } = renderHook(() => useAuth());

      let signInPromise: Promise<any>;
      act(() => {
        signInPromise = result.current.signIn("test@example.com", "password123");
      });

      await waitFor(() => expect(result.current.isLoading).toBe(true));

      await act(async () => {
        resolveSignIn!({ success: true });
        await signInPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("returns the result from the signIn action", async () => {
      (signInAction as any).mockResolvedValue({ success: false, error: "Invalid credentials" });

      const { result } = renderHook(() => useAuth());

      let response: any;
      await act(async () => {
        response = await result.current.signIn("test@example.com", "wrong");
      });

      expect(response).toEqual({ success: false, error: "Invalid credentials" });
    });

    test("calls signIn action with the given email and password", async () => {
      (signInAction as any).mockResolvedValue({ success: false, error: "Invalid credentials" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      expect(signInAction).toHaveBeenCalledWith("test@example.com", "password123");
    });

    test("does not run post-sign-in flow when sign in fails", async () => {
      (signInAction as any).mockResolvedValue({ success: false, error: "Invalid credentials" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "wrong");
      });

      expect(getAnonWorkData).not.toHaveBeenCalled();
      expect(getProjects).not.toHaveBeenCalled();
      expect(createProject).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    test("resets isLoading even when the signIn action throws", async () => {
      (signInAction as any).mockRejectedValue(new Error("network error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await expect(
          result.current.signIn("test@example.com", "password123")
        ).rejects.toThrow("network error");
      });

      expect(result.current.isLoading).toBe(false);
    });

    describe("post-sign-in redirect logic", () => {
      test("creates a project from anonymous work and redirects to it, clearing anon work", async () => {
        (signInAction as any).mockResolvedValue({ success: true });
        (getAnonWorkData as any).mockReturnValue({
          messages: [{ id: "1", role: "user", content: "Hello" }],
          fileSystemData: { "/App.jsx": { type: "file", content: "code" } },
        });
        (createProject as any).mockResolvedValue({ id: "anon-project-id" });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("test@example.com", "password123");
        });

        expect(createProject).toHaveBeenCalledWith(
          expect.objectContaining({
            name: expect.stringContaining("Design from"),
            messages: [{ id: "1", role: "user", content: "Hello" }],
            data: { "/App.jsx": { type: "file", content: "code" } },
          })
        );
        expect(clearAnonWork).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/anon-project-id");
        expect(getProjects).not.toHaveBeenCalled();
      });

      test("ignores anonymous work with no messages and falls back to existing projects", async () => {
        (signInAction as any).mockResolvedValue({ success: true });
        (getAnonWorkData as any).mockReturnValue({
          messages: [],
          fileSystemData: {},
        });
        (getProjects as any).mockResolvedValue([{ id: "existing-project-id" }]);

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("test@example.com", "password123");
        });

        expect(createProject).not.toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/existing-project-id");
      });

      test("redirects to the most recent project when no anonymous work exists", async () => {
        (signInAction as any).mockResolvedValue({ success: true });
        (getAnonWorkData as any).mockReturnValue(null);
        (getProjects as any).mockResolvedValue([
          { id: "recent-project" },
          { id: "older-project" },
        ]);

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("test@example.com", "password123");
        });

        expect(mockPush).toHaveBeenCalledWith("/recent-project");
        expect(createProject).not.toHaveBeenCalled();
      });

      test("creates a new empty project when no anon work and no existing projects", async () => {
        (signInAction as any).mockResolvedValue({ success: true });
        (getAnonWorkData as any).mockReturnValue(null);
        (getProjects as any).mockResolvedValue([]);
        (createProject as any).mockResolvedValue({ id: "brand-new-project" });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("test@example.com", "password123");
        });

        expect(createProject).toHaveBeenCalledWith(
          expect.objectContaining({
            name: expect.stringContaining("New Design #"),
            messages: [],
            data: {},
          })
        );
        expect(mockPush).toHaveBeenCalledWith("/brand-new-project");
      });
    });
  });

  describe("signUp", () => {
    test("sets isLoading true while pending and false after completion", async () => {
      let resolveSignUp: (value: any) => void;
      (signUpAction as any).mockReturnValue(
        new Promise((resolve) => {
          resolveSignUp = resolve;
        })
      );

      const { result } = renderHook(() => useAuth());

      let signUpPromise: Promise<any>;
      act(() => {
        signUpPromise = result.current.signUp("test@example.com", "password123");
      });

      await waitFor(() => expect(result.current.isLoading).toBe(true));

      await act(async () => {
        resolveSignUp!({ success: true });
        await signUpPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("calls signUp action with the given email and password", async () => {
      (signUpAction as any).mockResolvedValue({ success: false, error: "Email already registered" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("test@example.com", "password123");
      });

      expect(signUpAction).toHaveBeenCalledWith("test@example.com", "password123");
    });

    test("returns the result from the signUp action", async () => {
      (signUpAction as any).mockResolvedValue({ success: false, error: "Email already registered" });

      const { result } = renderHook(() => useAuth());

      let response: any;
      await act(async () => {
        response = await result.current.signUp("test@example.com", "password123");
      });

      expect(response).toEqual({ success: false, error: "Email already registered" });
    });

    test("does not run post-sign-in flow when sign up fails", async () => {
      (signUpAction as any).mockResolvedValue({ success: false, error: "Email already registered" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("test@example.com", "password123");
      });

      expect(getAnonWorkData).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    test("runs post-sign-up redirect flow on success", async () => {
      (signUpAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([{ id: "existing-project-id" }]);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("test@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/existing-project-id");
    });

    test("resets isLoading even when the signUp action throws", async () => {
      (signUpAction as any).mockRejectedValue(new Error("network error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await expect(
          result.current.signUp("test@example.com", "password123")
        ).rejects.toThrow("network error");
      });

      expect(result.current.isLoading).toBe(false);
    });
  });
});
