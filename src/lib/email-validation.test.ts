import { describe, it, expect } from "vitest";
import { validateEmail } from "./email-validation";

describe("validateEmail", () => {
  it("accepts a real address", () => expect(validateEmail("jane@gmail.com")).toBeNull());
  it("flags gmai.com typo with suggestion", () => expect(validateEmail("jane@gmai.com")).toContain("jane@gmail.com"));
  it("rejects example.com", () => expect(validateEmail("a@example.com")).toContain("reserved"));
  it("rejects seeded .local domain", () => expect(validateEmail("dealer@forecourtms.local")).not.toBeNull());
  it("rejects malformed", () => expect(validateEmail("jane@gmail")).not.toBeNull());
});
