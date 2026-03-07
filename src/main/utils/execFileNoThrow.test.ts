import { describe, it, expect } from "vitest";
import { execFileNoThrow } from "./execFileNoThrow";
import { tmpdir } from "os";

describe("execFileNoThrow", () => {
  const cwd = tmpdir();

  it("captures stdout from a successful command", async () => {
    const result = await execFileNoThrow("echo", ["hello"], { cwd });
    expect(result.stdout.trim()).toBe("hello");
    expect(result.stderr).toBe("");
    expect(result.code).toBe(0);
  });

  it("returns non-zero code for a failed command", async () => {
    const result = await execFileNoThrow("false", [], { cwd });
    expect(result.code).not.toBe(0);
  });

  it("captures stderr output", async () => {
    const result = await execFileNoThrow(
      "sh",
      ["-c", "echo err >&2"],
      { cwd },
    );
    expect(result.stderr.trim()).toBe("err");
  });

  it("returns error code for a non-existent command without throwing", async () => {
    const result = await execFileNoThrow(
      "this-command-does-not-exist-abc123",
      [],
      { cwd },
    );
    expect(result.code).not.toBe(0);
    expect(result.stdout).toBe("");
  });
});
