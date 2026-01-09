import { describe, it, expect, beforeEach } from "bun:test";
import { validateEnvironment, getEnvironment } from "../../src/config/env";

describe("validateEnvironment", () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        // Reset to original env before each test
        process.env = { ...originalEnv };
    });

    it("throws error when ODDSSHOPPER_API_URL is missing", () => {
        delete process.env.ODDSSHOPPER_API_URL;

        expect(() => validateEnvironment()).toThrow("Environment validation failed");
    });

    it("throws error when ODDSSHOPPER_API_URL is invalid format", () => {
        process.env.ODDSSHOPPER_API_URL = "not-a-url";

        expect(() => validateEnvironment()).toThrow("Environment validation failed");
    });

    it("accepts valid http URL for ODDSSHOPPER_API_URL", () => {
        process.env.ODDSSHOPPER_API_URL = "http://example.com";

        expect(() => validateEnvironment()).not.toThrow();
    });

    it("accepts valid https URL for ODDSSHOPPER_API_URL", () => {
        process.env.ODDSSHOPPER_API_URL = "https://example.com";

        expect(() => validateEnvironment()).not.toThrow();
    });

    it("throws error when PORT is not numeric", () => {
        process.env.PORT = "not-a-number";
        process.env.ODDSSHOPPER_API_URL = "https://example.com";

        expect(() => validateEnvironment()).toThrow("Environment validation failed");
    });

    it("accepts valid PORT as string number", () => {
        process.env.PORT = "3000";
        process.env.ODDSSHOPPER_API_URL = "https://example.com";

        const result = validateEnvironment();
        expect(result.PORT).toBe(3000);
    });

    it("uses default PORT when not provided", () => {
        delete process.env.PORT;
        process.env.ODDSSHOPPER_API_URL = "https://example.com";

        const result = validateEnvironment();
        expect(result.PORT).toBe(8080);
    });

    it("throws error when NODE_ENV is invalid", () => {
        process.env.NODE_ENV = "invalid";
        process.env.ODDSSHOPPER_API_URL = "https://example.com";

        expect(() => validateEnvironment()).toThrow("Environment validation failed");
    });

    it("accepts valid NODE_ENV values", () => {
        const validEnvs: Array<"development" | "production" | "test"> = ["development", "production", "test"];

        for (const env of validEnvs) {
            process.env.NODE_ENV = env;
            process.env.ODDSSHOPPER_API_URL = "https://example.com";

            const result = validateEnvironment();
            expect(result.NODE_ENV).toBe(env);
        }
    });

    it("uses default NODE_ENV when not provided", () => {
        delete process.env.NODE_ENV;
        process.env.ODDSSHOPPER_API_URL = "https://example.com";

        const result = validateEnvironment();
        expect(result.NODE_ENV).toBe("development");
    });

    it("accepts optional REDIS_URL", () => {
        process.env.ODDSSHOPPER_API_URL = "https://example.com";
        delete process.env.REDIS_URL;

        const result = validateEnvironment();
        expect(result.REDIS_URL).toBeUndefined();
    });

    it("validates REDIS_URL format when provided", () => {
        process.env.ODDSSHOPPER_API_URL = "https://example.com";
        process.env.REDIS_URL = "redis://localhost:6379";

        const result = validateEnvironment();
        expect(result.REDIS_URL).toBe("redis://localhost:6379");
    });

    it("uses default REDIS_API_CACHE_TTL when not provided", () => {
        process.env.ODDSSHOPPER_API_URL = "https://example.com";
        delete process.env.REDIS_API_CACHE_TTL;

        const result = validateEnvironment();
        expect(result.REDIS_API_CACHE_TTL).toBe(60);
    });

    it("coerces REDIS_API_CACHE_TTL to number", () => {
        process.env.ODDSSHOPPER_API_URL = "https://example.com";
        process.env.REDIS_API_CACHE_TTL = "120";

        const result = validateEnvironment();
        expect(result.REDIS_API_CACHE_TTL).toBe(120);
    });

    it("uses default REDIS_EV_CACHE_TTL when not provided", () => {
        process.env.ODDSSHOPPER_API_URL = "https://example.com";
        delete process.env.REDIS_EV_CACHE_TTL;

        const result = validateEnvironment();
        expect(result.REDIS_EV_CACHE_TTL).toBe(300);
    });

    it("coerces REDIS_EV_CACHE_TTL to number", () => {
        process.env.ODDSSHOPPER_API_URL = "https://example.com";
        process.env.REDIS_EV_CACHE_TTL = "300";

        const result = validateEnvironment();
        expect(result.REDIS_EV_CACHE_TTL).toBe(300);
    });
});

describe("getEnvironment", () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    it("returns parsed environment after validation", () => {
        process.env.ODDSSHOPPER_API_URL = "https://example.com";
        process.env.PORT = "3000";

        const result = getEnvironment();
        expect(result.ODDSSHOPPER_API_URL).toBe("https://example.com");
        expect(result.PORT).toBe(3000);
    });

    it("throws error when environment is invalid", () => {
        delete process.env.ODDSSHOPPER_API_URL;

        expect(() => getEnvironment()).toThrow();
    });
});
