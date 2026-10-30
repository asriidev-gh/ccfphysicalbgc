import { describe, expect, it } from "vitest";
import { parseReference } from "./lead";

describe("parseReference", () => {
  it("reads the short code from a scan or typed value, any case", () => {
    expect(parseReference("CCFBGC-0427")).toEqual({ code: "CCFBGC-0427" });
    expect(parseReference(" ccfbgc-0427 ")).toEqual({ code: "CCFBGC-0427" });
  });
  it("still reads a legacy long reference or URL", () => {
    expect(parseReference("http://localhost:3000/registration/PB-AB2C-D3EF-GH4J")).toEqual({ reference: "PB-AB2C-D3EF-GH4J" });
  });
  it("rejects unrelated text", () => {
    expect(parseReference("https://example.com")).toBeNull();
  });
});
