import sys
import json
import os
from faster_whisper import WhisperModel

def transcribe(audio_path, output_json):
    model_size = "base"
    # Run on CPU with int8 quantization to save RAM on VPS
    model = WhisperModel(model_size, device="cpu", compute_type="int8")

    segments, info = model.transcribe(audio_path, beam_size=5)

    results = []
    full_text = ""
    for segment in segments:
        results.append({
            "start": segment.start,
            "end": segment.end,
            "text": segment.text.strip()
        })
        full_text += segment.text + " "

    output_data = {
        "text": full_text.strip(),
        "segments": results
    }

    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 transcriber.py <audio_path> <output_json>")
        sys.exit(1)
    
    audio_path = sys.argv[1]
    output_json = sys.argv[2]
    transcribe(audio_path, output_json)
