import { describe, expect, it } from "vitest";
import { isGithubConfigured, normalizeSettings } from "./settings";

describe("normalizeSettings", () => {
  // A trailing space in the owner is invisible in the input but turns the
  // request into /repos/kupalsa%20/repo, which 404s as "no such repository".
  it("trims whitespace that would corrupt the request URL", () => {
    const s = normalizeSettings({
      githubOwner: "kupalsa ",
      githubRepo: " Kupalsa-Trading-Data",
      githubToken: "github_pat_abc",
    });
    expect(s.githubOwner).toBe("kupalsa");
    expect(s.githubRepo).toBe("Kupalsa-Trading-Data");
  });

  it("strips the newline a copy-pasted token often carries", () => {
    expect(normalizeSettings({ githubToken: "github_pat_abc\n" }).githubToken).toBe(
      "github_pat_abc",
    );
  });

  it("fills missing fields with empty strings", () => {
    expect(normalizeSettings({})).toEqual({
      githubToken: "",
      githubOwner: "",
      githubRepo: "",
    });
  });

  it("leaves already-clean values alone", () => {
    const clean = { githubOwner: "kupalsa", githubRepo: "data", githubToken: "t" };
    expect(normalizeSettings(clean)).toEqual(clean);
  });

  it("does not count a whitespace-only field as configured", () => {
    expect(
      isGithubConfigured(
        normalizeSettings({ githubOwner: "   ", githubRepo: "data", githubToken: "t" }),
      ),
    ).toBe(false);
  });
});
