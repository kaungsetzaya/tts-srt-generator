import { describe, it, expect } from "vitest";
import {
  estimateSpeechDuration,
  formatSrtTime,
  generateSRT,
  SUPPORTED_VOICES,
} from "./tts";

describe("TTS Service", () => {
  describe("SUPPORTED_VOICES", () => {
    it("should have thiha and nilar voices", () => {
      expect(SUPPORTED_VOICES.thiha).toBeDefined();
      expect(SUPPORTED_VOICES.nilar).toBeDefined();
      expect(SUPPORTED_VOICES.thiha.name).toBe("Thiha");
      expect(SUPPORTED_VOICES.nilar.name).toBe("Nilar");
    });

    it("should have valid voice codes", () => {
      expect(SUPPORTED_VOICES.thiha.shortName).toBe("my-MM-ThihaNeural");
      expect(SUPPORTED_VOICES.nilar.shortName).toBe("my-MM-NilarNeural");
    });
  });

  describe("estimateSpeechDuration", () => {
    it("should calculate duration for simple text", () => {
      const text = "Hello world";
      const duration = estimateSpeechDuration(text, 1.0);
      expect(duration).toBeGreaterThan(0);
      expect(typeof duration).toBe("number");
    });

    it("should account for speech rate", () => {
      const text = "This is a test sentence";
      const normalSpeed = estimateSpeechDuration(text, 1.0);
      const fasterSpeed = estimateSpeechDuration(text, 2.0);
      const slowerSpeed = estimateSpeechDuration(text, 0.5);

      expect(fasterSpeed).toBeLessThan(normalSpeed);
      expect(slowerSpeed).toBeGreaterThan(normalSpeed);
    });

    it("should handle empty text", () => {
      const duration = estimateSpeechDuration("", 1.0);
      // Empty string splits to array with one empty element
      expect(duration).toBeLessThanOrEqual(400);
    });

    it("should handle whitespace-only text", () => {
      const duration = estimateSpeechDuration("   ", 1.0);
      expect(duration).toBeLessThanOrEqual(400); // Whitespace counts as 1 word
    });
  });

  describe("formatSrtTime", () => {
    it("should format time correctly for zero milliseconds", () => {
      const formatted = formatSrtTime(0);
      expect(formatted).toBe("00:00:00,000");
    });

    it("should format time correctly for seconds", () => {
      const formatted = formatSrtTime(5000); // 5 seconds
      expect(formatted).toBe("00:00:05,000");
    });

    it("should format time correctly for minutes", () => {
      const formatted = formatSrtTime(65000); // 1 minute 5 seconds
      expect(formatted).toBe("00:01:05,000");
    });

    it("should format time correctly for hours", () => {
      const formatted = formatSrtTime(3665000); // 1 hour 1 minute 5 seconds
      expect(formatted).toBe("01:01:05,000");
    });

    it("should format milliseconds correctly", () => {
      const formatted = formatSrtTime(1234); // 1 second 234 milliseconds
      expect(formatted).toBe("00:00:01,234");
    });

    it("should pad values with zeros", () => {
      const formatted = formatSrtTime(100); // 100 milliseconds
      expect(formatted).toBe("00:00:00,100");
    });
  });

  describe("generateSRT", () => {
    it("should generate valid SRT format", () => {
      const text = "Hello world";
      const srt = generateSRT(text, 1.0);

      expect(srt).toContain("1"); // Subtitle index
      expect(srt).toContain("-->"); // SRT time separator
      expect(srt).toContain("Hello world"); // Text content
    });

    it("should handle multiple lines", () => {
      const text = "First line\nSecond line";
      const srt = generateSRT(text, 1.0);

      expect(srt).toContain("First line");
      expect(srt).toContain("Second line");
      expect(srt).toContain("1"); // First subtitle
      expect(srt).toContain("2"); // Second subtitle
    });

    it("should split long lines into chunks", () => {
      const longText = "This is a very long line that should be split into multiple subtitle chunks because it exceeds the character limit";
      const srt = generateSRT(longText, 1.0, 42);

      // Should have multiple subtitle entries
      const lines = srt.split("\n");
      const subtitleCount = lines.filter((line) => /^\d+$/.test(line)).length;
      expect(subtitleCount).toBeGreaterThan(1);
    });

    it("should respect speech rate in timing", () => {
      const text = "Test text";
      const normalSrt = generateSRT(text, 1.0);
      const fasterSrt = generateSRT(text, 2.0);

      // Extract end time from normal speed SRT
      const normalMatch = normalSrt.match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);
      // Extract end time from faster speed SRT
      const fasterMatch = fasterSrt.match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);

      expect(normalMatch).toBeTruthy();
      expect(fasterMatch).toBeTruthy();

      // Faster speed should have shorter duration
      if (normalMatch && fasterMatch) {
        const normalEnd = normalMatch[2];
        const fasterEnd = fasterMatch[2];
        expect(normalEnd).not.toBe(fasterEnd);
      }
    });

    it("should skip empty lines", () => {
      const text = "Line one\n\n\nLine two";
      const srt = generateSRT(text, 1.0);

      expect(srt).toContain("Line one");
      expect(srt).toContain("Line two");
      // Should not have excessive empty subtitle entries
      const emptySubtitles = (srt.match(/\n\n\n/g) || []).length;
      expect(emptySubtitles).toBeLessThan(3);
    });

    it("should generate valid timing progression", () => {
      const text = "First\nSecond\nThird";
      const srt = generateSRT(text, 1.0);

      const timeMatches = srt.match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/g);
      expect(timeMatches).toBeTruthy();
      expect(timeMatches!.length).toBeGreaterThanOrEqual(3);

      // Times should be in ascending order
      if (timeMatches && timeMatches.length > 1) {
        for (let i = 0; i < timeMatches.length - 1; i++) {
          const current = timeMatches[i];
          const next = timeMatches[i + 1];
          // Extract end time of current and start time of next
          const currentEnd = current.split(" --> ")[1];
          const nextStart = next.split(" --> ")[0];
          // String comparison works for time format HH:MM:SS,mmm
          expect(currentEnd! <= nextStart!).toBe(true);
        }
      }
    });
  });
});
