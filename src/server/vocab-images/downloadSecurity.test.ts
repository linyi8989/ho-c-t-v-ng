import assert from "node:assert/strict";
import test from "node:test";
import { downloadImageSecurely, hostnameMatchesAllowlist, isPrivateNetworkAddress, validateImageBytes } from "./downloadSecurity";

const publicResolver = async () => [{ address: "93.184.216.34", family: 4 }];
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);

test("provider host allowlists accept only exact hosts and their subdomains", () => {
  assert.equal(hostnameMatchesAllowlist("upload.wikimedia.org", ["upload.wikimedia.org"]), true);
  assert.equal(hostnameMatchesAllowlist("cdn.pixabay.com", ["pixabay.com"]), true);
  assert.equal(hostnameMatchesAllowlist("pixabay.com.attacker.test", ["pixabay.com"]), false);
});

test("private and special network addresses are blocked", () => {
  for (const address of ["127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.1", "169.254.1.1", "::1", "fd00::1", "fe80::1"]) {
    assert.equal(isPrivateNetworkAddress(address), true, address);
  }
  assert.equal(isPrivateNetworkAddress("93.184.216.34"), false);
  assert.equal(isPrivateNetworkAddress("2606:4700:4700::1111"), false);
});

test("secure download checks HTTPS, DNS, MIME, magic bytes and redirect hosts", async () => {
  const successfulFetch: typeof fetch = async () => new Response(png, {
    status: 200,
    headers: { "content-type": "image/png", "content-length": String(png.length) },
  });
  const result = await downloadImageSecurely("https://upload.wikimedia.org/apple.png", {
    fetchImpl: successfulFetch,
    resolveHost: publicResolver,
    allowedHosts: ["upload.wikimedia.org"],
    timeoutMs: 2_000,
    maxBytes: 64 * 1024,
  });
  assert.equal(result.mimeType, "image/png");
  assert.equal(result.extension, "png");
  assert.deepEqual(result.bytes, png);

  await assert.rejects(() => downloadImageSecurely("http://upload.wikimedia.org/apple.png", {
    fetchImpl: successfulFetch,
    resolveHost: publicResolver,
    allowedHosts: ["upload.wikimedia.org"],
    timeoutMs: 2_000,
    maxBytes: 64 * 1024,
  }), /HTTPS/);

  await assert.rejects(() => downloadImageSecurely("https://upload.wikimedia.org/apple.png", {
    fetchImpl: successfulFetch,
    resolveHost: async () => [{ address: "127.0.0.1", family: 4 }],
    allowedHosts: ["upload.wikimedia.org"],
    timeoutMs: 2_000,
    maxBytes: 64 * 1024,
  }), /blocked network/);

  await assert.rejects(() => downloadImageSecurely("https://upload.wikimedia.org/apple.svg", {
    fetchImpl: async () => new Response("<svg/>", { headers: { "content-type": "image/svg+xml" } }),
    resolveHost: publicResolver,
    allowedHosts: ["upload.wikimedia.org"],
    timeoutMs: 2_000,
    maxBytes: 64 * 1024,
  }), /unsupported content type/);

  await assert.rejects(() => downloadImageSecurely("https://upload.wikimedia.org/apple.png", {
    fetchImpl: async () => new Response(null, { status: 302, headers: { location: "https://attacker.test/image.png" } }),
    resolveHost: publicResolver,
    allowedHosts: ["upload.wikimedia.org"],
    timeoutMs: 2_000,
    maxBytes: 64 * 1024,
  }), /host is not allowed/);
});

test("raw upload validation checks size, declared MIME and magic bytes", () => {
  assert.equal(validateImageBytes(png, "image/png", 64 * 1024).extension, "png");
  assert.throws(() => validateImageBytes(Buffer.from("not-image"), "image/png", 64 * 1024), /định dạng ảnh/);
  assert.throws(() => validateImageBytes(png, "image/jpeg", 64 * 1024), /không khớp/);
  assert.throws(() => validateImageBytes(Buffer.alloc(70 * 1024), "image/png", 64 * 1024), /lớn hơn/);
});
