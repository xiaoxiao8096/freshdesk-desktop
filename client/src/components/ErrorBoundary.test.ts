import { describe, expect, it, vi } from "vitest";
import { ErrorBoundary, recoverDesktopState } from "./ErrorBoundary";

describe("ErrorBoundary", () => {
  it("captures a render exception so the desktop can offer snapshot recovery", () => {
    const error = new Error("desktop render failed");
    expect(ErrorBoundary.getDerivedStateFromError(error)).toEqual({ hasError: true, error });
  });

  it("returns a fresh tree key when restoring a desktop snapshot", () => {
    expect(recoverDesktopState({ hasError: true, error: new Error("temporary"), recoveryKey: 3 })).toEqual({ hasError: false, error: null, recoveryKey: 4 });
  });

  it("uses the recovery action to remount the desktop tree with a new key", () => {
    const onRecover = vi.fn();
    const boundary = new ErrorBoundary({ children: null, onRecover });
    boundary.state = { hasError: true, error: new Error("temporary"), recoveryKey: 7 };
    boundary.setState = vi.fn((updater: (state: typeof boundary.state) => typeof boundary.state) => {
      boundary.state = updater(boundary.state);
    }) as unknown as typeof boundary.setState;

    boundary.recoverDesktop();

    expect(onRecover).toHaveBeenCalledOnce();
    expect(boundary.state).toEqual({ hasError: false, error: null, recoveryKey: 8 });
    expect(boundary.render()).toMatchObject({ key: "8" });
  });
});
