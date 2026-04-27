import sys
import json
import os
from faster_whisper import WhisperModel

# Allowed output directory (prevent path traversal)
ALLOWED_OUTPUT_DIR = os.environ.get("WHISPER_OUTPUT_DIR", "/tmp")
MAX_AUDIO_SIZE_MB = 500


def validate_audio_path(path: str) -> None:
    if not os.path.isfile(path):
        raise ValueError(f"Audio file not found: {path}")
    size_mb = os.path.getsize(path) / (1024 * 1024)
    if size_mb > MAX_AUDIO_SIZE_MB:
        raise ValueError(f"Audio file too large: {size_mb:.1f}MB > {MAX_AUDIO_SIZE_MB}MB")


def validate_output_path(path: str) -> None:
    real_output = os.path.realpath(path)
    real_allowed = os.path.realpath(ALLOWED_OUTPUT_DIR)
    if not real_output.startswith(real_allowed + os.sep) and real_output != real_allowed:
        raise ValueError(f"Output path must be inside {ALLOWED_OUTPUT_DIR}")


def transcribe(audio_path, output_json):
    validate_audio_path(audio_path)
    validate_output_path(output_json)

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

    try:
        transcribe(audio_path, output_json)
        print(f"OK: {output_json}")
    except ValueError as e:
        print(f"VALIDATION_ERROR: {e}", file=sys.stderr)
        sys.exit(2)
    except Exception as e:
        print(f"TRANSCRIBE_ERROR: {e}", file=sys.stderr)
        sys.exit(3)
