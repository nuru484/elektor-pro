import { describe, expect, it } from "vitest";

import {
  changePasswordSchema,
  emailChangeSchema,
  loginSchema,
  otpCodeSchema,
  phoneChangeSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from "@/validations/auth-validation";

describe("auth validation schemas (mirror the backend contract)", () => {
  it("loginSchema requires both fields", () => {
    expect(loginSchema.safeParse({ emailOrPhone: "", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ emailOrPhone: "a@b.com", password: "abc" }).success).toBe(
      false,
    );
    expect(
      loginSchema.safeParse({ emailOrPhone: "a@b.com", password: "Password123!" }).success,
    ).toBe(true);
  });

  it("changePasswordSchema enforces strength and matching confirmation", () => {
    const base = { currentPassword: "old" };
    expect(
      changePasswordSchema.safeParse({
        ...base,
        confirmPassword: "weak",
        newPassword: "weak",
      }).success,
    ).toBe(false);
    expect(
      changePasswordSchema.safeParse({
        ...base,
        confirmPassword: "Mismatch123",
        newPassword: "Password123",
      }).success,
    ).toBe(false);
    expect(
      changePasswordSchema.safeParse({
        ...base,
        confirmPassword: "Password123",
        newPassword: "Password123",
      }).success,
    ).toBe(true);
  });

  it("resetPasswordSchema requires matching strong passwords", () => {
    expect(
      resetPasswordSchema.safeParse({ confirmPassword: "a", newPassword: "a" }).success,
    ).toBe(false);
    expect(
      resetPasswordSchema.safeParse({
        confirmPassword: "Password123",
        newPassword: "Password123",
      }).success,
    ).toBe(true);
  });

  it("updateProfileSchema requires non-empty names", () => {
    expect(updateProfileSchema.safeParse({ firstName: "", lastName: "A" }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ firstName: "Ada", lastName: "Mensah" }).success).toBe(
      true,
    );
  });

  it("emailChangeSchema validates addresses", () => {
    expect(emailChangeSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
    expect(emailChangeSchema.safeParse({ email: "new@example.com" }).success).toBe(true);
  });

  it("phoneChangeSchema bounds length", () => {
    expect(phoneChangeSchema.safeParse({ phone: "123" }).success).toBe(false);
    expect(phoneChangeSchema.safeParse({ phone: "+233244123456" }).success).toBe(true);
  });

  it("otpCodeSchema bounds the code", () => {
    expect(otpCodeSchema.safeParse({ code: "12" }).success).toBe(false);
    expect(otpCodeSchema.safeParse({ code: "123456" }).success).toBe(true);
  });
});
