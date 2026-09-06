import { describe, expect, it } from "vitest";

import { crc32 } from "./audio_upload.ts";

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe("crc32", () => {
  // These are the values the device's own implementation produces, checked
  // by compiling it and running it against the same inputs. If either side
  // is ever rewritten, this is what keeps them the same computation.
  it("matches the device, and standard CRC-32", () => {
    expect(crc32(bytes(""))).toBe(0x00000000);
    expect(crc32(bytes("a"))).toBe(0xe8b7be43);
    expect(crc32(bytes("abc"))).toBe(0x352441c2);
    expect(crc32(bytes("123456789"))).toBe(0xcbf43926);
    expect(crc32(bytes("The quick brown fox jumps over the lazy dog"))).toBe(
      0x414fa339,
    );
  });

  it("matches the device over a file-sized run of bytes", () => {
    const data = new Uint8Array(5000);
    for (let index = 0; index < data.length; index++) {
      data[index] = (index * 31 + 7) & 0xff;
    }

    expect(crc32(data)).toBe(0x8ad9f129);
  });

  it("stays an unsigned 32-bit value", () => {
    expect(crc32(bytes("a"))).toBeGreaterThan(0);
    expect(Number.isInteger(crc32(bytes("a")))).toBe(true);
  });
});
