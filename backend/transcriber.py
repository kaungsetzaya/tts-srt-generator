#!/usr/bin/env python3
"""
Video Dubbing Transcription Pipeline
Uses faster-whisper for quick, accurate transcription.
"""

import sys
import json
import argparse
from pathlib import Path


def transcribe_audio(audio_path: str, output_json_path: str) -> dict:
    """
    Transcribe audio using faster-whisper.
    Returns segments with accurate timestamps.
    """
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("[Transcriber] faster-whisper not installed. Run: pip install faster-whisper")
        sys.exit(1)
    
    print(f"[Transcriber] Loading Whisper base model...")
    model = WhisperModel("base", device="cpu", compute_type="int8")
    
    print(f"[Transcriber] Transcribing {audio_path}...")
    segments, info = model.transcribe(
        audio_path,
        word_timestamps=True,
        language="en"
    )
    
    print(f"[Transcriber] Detected language: {info.language} ({info.language_probability:.2f})")
    
    all_segments = []
    text_parts = []
    
    for i, seg in enumerate(segments):
        seg_data = {
            "index": i,
            "start": round(seg.start, 3),
            "end": round(seg.end, 3),
            "text": seg.text.strip()
        }
        all_segments.append(seg_data)
        text_parts.append(seg.text.strip())
        print(f"[Transcriber] Segment {i}: {seg.start:.2f}s - {seg.end:.2f}s | {seg.text[:50]}...")
    
    # Stitch segments for gapless subtitles (set end = next start)
    for i in range(len(all_segments) - 1):
        all_segments[i]["end"] = all_segments[i + 1]["start"]
    
    output_data = {
        "segments": all_segments,
        "text": " ".join(text_parts)
    }
    
    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    
    print(f"[Transcriber] Saved {len(all_segments)} segments to {output_json_path}")
    return output_data


def main():
    parser = argparse.ArgumentParser(description="Video transcription")
    parser.add_argument("audio_path", help="Path to audio file")
    parser.add_argument("output_json", help="Output JSON path")
    args = parser.parse_args()
    
    if not Path(args.audio_path).exists():
        print(f"[ERROR] Audio file not found: {args.audio_path}")
        sys.exit(1)
    
    result = transcribe_audio(args.audio_path, args.output_json)
    print(f"[Transcriber] Done! {len(result['segments'])} segments transcribed.")


if __name__ == "__main__":
    main()
