import { afterEach, describe, expect, it, vi } from "vitest";
import { configuredSiteOrigin } from "./site-config";
import { operatorGateway } from "./operator-gateway";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("runtime deployment domain", () => {
  it("changes the public origin without reloading the module and retains legacy deployments", () => {
    vi.stubEnv("TRACEFORGE_SITE_ORIGIN", "");
    vi.stubEnv("TRACEFORGE_OPERATOR_SITE_ORIGIN", "");
    expect(configuredSiteOrigin()).toBeNull();
    vi.stubEnv("TRACEFORGE_SITE_ORIGIN", "http://127.0.0.1:3101");
    expect(configuredSiteOrigin()).toBe("http://127.0.0.1:3101");
    vi.stubEnv("TRACEFORGE_SITE_ORIGIN", "https://new.example.com");
    expect(configuredSiteOrigin()).toBe("https://new.example.com");
    vi.stubEnv("TRACEFORGE_SITE_ORIGIN", "");
    vi.stubEnv("TRACEFORGE_OPERATOR_SITE_ORIGIN", "https://legacy.example.com");
    expect(configuredSiteOrigin()).toBe("https://legacy.example.com");
  });

  it("rejects unsafe or conflicting origins", () => {
    vi.stubEnv("TRACEFORGE_OPERATOR_SITE_ORIGIN", "");
    for (const origin of ["http://public.example", "https://user:password@example.com", "https://example.com/private", "https://example.com?token=secret"]) {
      vi.stubEnv("TRACEFORGE_SITE_ORIGIN", origin);
      expect(() => configuredSiteOrigin()).toThrow();
    }
    vi.stubEnv("TRACEFORGE_SITE_ORIGIN", "https://new.example.com");
    vi.stubEnv("TRACEFORGE_OPERATOR_SITE_ORIGIN", "https://old.example.com");
    expect(() => configuredSiteOrigin()).toThrow(/Conflicting/);
  });

  it("applies the changed domain to login origin checks before contacting the API", async () => {
    vi.stubEnv("TRACEFORGE_SITE_ORIGIN", "https://new.example.com");
    vi.stubEnv("TRACEFORGE_OPERATOR_SITE_ORIGIN", "");
    vi.stubEnv("TRACEFORGE_OPERATOR_API_ORIGIN", "https://api.example.com");
    vi.stubEnv("TRACEFORGE_SESSION_STORE", "memory");
    const fetch = vi.fn().mockResolvedValue(Response.json({ error: { code: "invalid_credentials" } }, { status: 401 }));
    vi.stubGlobal("fetch", fetch);
    const request = (origin: string) => new Request("https://new.example.com/operator/api/login", {
      method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com", password: "SyntheticPassword123!" }),
    });
    expect((await operatorGateway(request("https://old.example.com"), "login")).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
    expect((await operatorGateway(request("https://new.example.com"), "login")).status).toBe(401);
    expect(fetch).toHaveBeenCalledOnce();
  });
});
