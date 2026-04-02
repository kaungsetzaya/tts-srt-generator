import { describe, it, expect } from "vitest";
import { checkVPSTTSHealth, getVPSAudioUrl } from "./vps-tts";

describe("VPS TTS Service", () => {
  describe("checkVPSTTSHealth", () => {
    it("should check VPS TTS server health", async () => {
      const isHealthy = await checkVPSTTSHealth();
      // Should return a boolean regardless of server status
      expect(typeof isHealthy).toBe("boolean");
    });
  });

  describe("getVPSAudioUrl", () => {
    it("should construct correct audio URL from path", () => {
      const audioPath = "audio-2026-04-02-12345.mp3";
      const url = getVPSAudioUrl(audioPath);
      expect(url).toContain("217.76.48.32");
      expect(url).toContain("5000");
      expect(url).toContain("audio-2026-04-02-12345.mp3");
    });

    it("should handle paths with leading slash", () => {
      const audioPath = "/audio/audio-2026-04-02-12345.mp3";
      const url = getVPSAudioUrl(audioPath);
      expect(url).toContain("217.76.48.32");
      expect(url).toContain("5000");
      // Should not have double slashes
      expect(url).not.toContain("//audio/audio");
    });

    it("should construct proper base URL", () => {
      const audioPath = "test.mp3";
      const url = getVPSAudioUrl(audioPath);
      expect(url).toMatch(/^http:\/\/217\.76\.48\.32:5000\/audio\//);
    });
  });
});
