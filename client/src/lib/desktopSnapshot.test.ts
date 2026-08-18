import { describe, expect, it } from "vitest";
import { loadStoredSnapshot } from "./desktopSnapshot";

describe("desktop snapshots", () => {
  it("restores persisted desktop state and rejects invalid storage values", () => {
    const storage = { getItem: () => JSON.stringify({ activeWallpaperId: "solar", windows: [{ id: "browser" }] }) } as Storage;
    expect(loadStoredSnapshot<{ activeWallpaperId: string; windows: { id: string }[] }>(storage, "freshdesk.desktop-state.v2")).toEqual({ activeWallpaperId: "solar", windows: [{ id: "browser" }] });
    expect(loadStoredSnapshot<{ activeWallpaperId: string }>({ getItem: () => "not-json" } as Storage, "freshdesk.desktop-state.v2")).toBeNull();
  });
});
