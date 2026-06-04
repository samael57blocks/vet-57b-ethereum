import { describe, it, expect } from "vitest";
import { mapOwnerInfo } from "../useRegisteredOwners";

describe("mapOwnerInfo", () => {
  it("maps viem OwnerInfo struct objects", () => {
    const raw = [
      {
        wallet: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        name: "Alice",
        registered: true,
      },
    ];

    expect(mapOwnerInfo(raw)).toEqual([
      {
        address: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
        name: "Alice",
      },
    ]);
  });

  it("maps legacy tuple arrays", () => {
    const raw = [
      ["0x70997970C51812dc3A010C7d01b50e0d17dc79C8", "Bob", true],
    ];

    expect(mapOwnerInfo(raw)).toEqual([
      {
        address: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
        name: "Bob",
      },
    ]);
  });

  it("returns empty array for non-array input", () => {
    expect(mapOwnerInfo(null)).toEqual([]);
    expect(mapOwnerInfo(undefined)).toEqual([]);
  });

  it("skips invalid entries", () => {
    expect(
      mapOwnerInfo([{ wallet: "", name: "X" }, "not-an-object"]),
    ).toEqual([]);
  });

  it("maps multiple owners", () => {
    const raw = [
      {
        wallet: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        name: "Alice",
        registered: true,
      },
      {
        wallet: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        name: "Carol",
        registered: true,
      },
    ];

    expect(mapOwnerInfo(raw)).toHaveLength(2);
    expect(mapOwnerInfo(raw)[1]?.name).toBe("Carol");
  });
});
