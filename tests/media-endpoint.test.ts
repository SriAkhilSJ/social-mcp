import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GET } from "../app/api/media/[filename]/route";
import { parseByteRange } from "../lib/media/byte-range";

describe("Priority 4: Media Endpoint Byte-Range Validation & Streaming", () => {
  const TOTAL_SIZE = 1000;

  it("1. parseByteRange: returns status 200 when no range header is supplied", () => {
    const res = parseByteRange("", TOTAL_SIZE);
    assert.equal(res.status, 200);
  });

  it("2. parseByteRange: returns 206 for valid start-end range (0-499)", () => {
    const res = parseByteRange("bytes=0-499", TOTAL_SIZE);
    assert.equal(res.status, 206);
    if (res.status === 206) {
      assert.equal(res.range.start, 0);
      assert.equal(res.range.end, 499);
      assert.equal(res.range.chunkSize, 500);
    }
  });

  it("3. parseByteRange: returns 206 for open-ended range (500-)", () => {
    const res = parseByteRange("bytes=500-", TOTAL_SIZE);
    assert.equal(res.status, 206);
    if (res.status === 206) {
      assert.equal(res.range.start, 500);
      assert.equal(res.range.end, 999);
      assert.equal(res.range.chunkSize, 500);
    }
  });

  it("4. parseByteRange: returns 206 for suffix byte range (-200)", () => {
    const res = parseByteRange("bytes=-200", TOTAL_SIZE);
    assert.equal(res.status, 206);
    if (res.status === 206) {
      assert.equal(res.range.start, 800);
      assert.equal(res.range.end, 999);
      assert.equal(res.range.chunkSize, 200);
    }
  });

  it("5. parseByteRange: caps end at totalSize - 1 when requested end exceeds file size", () => {
    const res = parseByteRange("bytes=900-5000", TOTAL_SIZE);
    assert.equal(res.status, 206);
    if (res.status === 206) {
      assert.equal(res.range.start, 900);
      assert.equal(res.range.end, 999);
      assert.equal(res.range.chunkSize, 100);
    }
  });

  it("6. parseByteRange: returns 416 when start is greater than or equal to totalSize", () => {
    const res = parseByteRange("bytes=1000-", TOTAL_SIZE);
    assert.equal(res.status, 416);

    const res2 = parseByteRange("bytes=5000-6000", TOTAL_SIZE);
    assert.equal(res2.status, 416);
  });

  it("7. parseByteRange: returns 416 when start is greater than end (500-200)", () => {
    const res = parseByteRange("bytes=500-200", TOTAL_SIZE);
    assert.equal(res.status, 416);
  });

  it("8. parseByteRange: returns 416 for malformed or non-numeric range inputs", () => {
    assert.equal(parseByteRange("bytes=abc-def", TOTAL_SIZE).status, 416);
    assert.equal(parseByteRange("bytes=-0", TOTAL_SIZE).status, 416);
    assert.equal(parseByteRange("bytes=--50", TOTAL_SIZE).status, 416);
  });

  it("9. GET /api/media/[filename]: returns 404 for nonexistent file", async () => {
    const req = new Request("http://localhost:3000/api/media/nonexistent_file_12345.mp4");
    const res = await GET(req, { params: Promise.resolve({ filename: "nonexistent_file_12345.mp4" }) });
    assert.equal(res.status, 404);
  });

  it("10. GET /api/media/[filename]: returns 200 with Accept-Ranges and correct Content-Length for full file", async () => {
    const filename = "An_Intelligent_Blind_Gangster_Part1_MasterCut_42s.mp4";
    const req = new Request(`http://localhost:3000/api/media/${filename}`);
    const res = await GET(req, { params: Promise.resolve({ filename }) });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Accept-Ranges"), "bytes");
    assert.equal(res.headers.get("Content-Type"), "video/mp4");
    assert.equal(res.headers.get("Content-Length"), "7214129");
  });

  it("11. GET /api/media/[filename]: returns 206 with Content-Range for valid byte range request", async () => {
    const filename = "An_Intelligent_Blind_Gangster_Part1_MasterCut_42s.mp4";
    const req = new Request(`http://localhost:3000/api/media/${filename}`, {
      headers: { range: "bytes=0-1023" },
    });
    const res = await GET(req, { params: Promise.resolve({ filename }) });

    assert.equal(res.status, 206);
    assert.equal(res.headers.get("Accept-Ranges"), "bytes");
    assert.equal(res.headers.get("Content-Type"), "video/mp4");
    assert.equal(res.headers.get("Content-Length"), "1024");
    assert.equal(res.headers.get("Content-Range"), "bytes 0-1023/7214129");

    const chunk = await res.arrayBuffer();
    assert.equal(chunk.byteLength, 1024);
  });

  it("12. GET /api/media/[filename]: returns 416 for unsatisfiable byte range request", async () => {
    const filename = "An_Intelligent_Blind_Gangster_Part1_MasterCut_42s.mp4";
    const req = new Request(`http://localhost:3000/api/media/${filename}`, {
      headers: { range: "bytes=999999999-" },
    });
    const res = await GET(req, { params: Promise.resolve({ filename }) });

    assert.equal(res.status, 416);
    assert.equal(res.headers.get("Content-Range"), "bytes */7214129");
  });
});
