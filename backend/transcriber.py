#!/usr/bin/env python3
"""
Video Dubbing Transcription Pipeline
Uses OpenAI Whisper with base model for reliable transcription.
"""

import sys
import json
import argparse
from pathlib import Path


def transcribe_audio(audio_path: str, output_json_path: str) -> dict:
    """
    Transcribe audio using OpenAI Whisper CLI.
    Returns segments with timestamps.
    """
    import subprocess
    
    print(f"[Transcriber] Transcribing with whisper base...")
    
    # Get output directory
    output_dir = str(Path(output_json_path).parent)
    base_name = Path(audio_path).stem
    
    # Run whisper CLI
    result = subprocess.run([
        "whisper",
        audio_path,
        "--model", "base",
        "--output_dir", output_dir,
        "--output_format", "json",
        "--word_timestamps", "True"
    ], capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"[Transcriber] Whisper error: {result.stderr}")
        sys.exit(1)
    
    # Read the JSON output
    json_output = Path(output_dir) / f"{base_name}.json"
    with open(json_output, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    # Convert to our format
    all_segments = []
    text_parts = []
    
    for i, seg in enumerate(data.get("segments", [])):
        seg_data = {
            "index": i,
            "start": round(seg.get("start", 0), 3),
            "end": round(seg.get("end", 0), 3),
            "text": seg.get("text", "").strip()
        }
        all_segments.append(seg_data)
        text_parts.append(seg_data["text"])
    
    # Stitch segments for gapless subtitles (set end = next start)
    for i in range(len(all_segments) - 1):
        all_segments[i]["end"] = all_segments[i + 1]["start"]
    
    # Cleanup temp file
    json_output.unlink(missing_ok=True)
    
    output_data = {
        "segments": all_segments,
        "text": " ".join(text_parts)
    }
    
    print(f"[Transcriber] Transcribed {len(all_segments)} segments")
    return output_data


def main():
    parser = argparse.ArgumentParser(description="Video transcription with whisper")
    parser.add_argument("audio_path", help="Path to audio file")
    parser.add_argument("output_json", help="Output JSON path")
    args = parser.parse_args()
    
    if not Path(args.audio_path).exists():
        print(f"[ERROR] Audio file not found: {args.audio_path}")
        sys.exit(1)
    
    result = transcribe_audio(args.audio_path, args.output_json)
    
    # Save output
    with open(args.output_json, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"[Transcriber] Done! {len(result['segments'])} segments saved to {args.output_json}")


if __name__ == "__main__":
    main()
