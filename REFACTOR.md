# Clean Architecture Refactor

## New Folder Structure

```
src/
├── modules/                    # Feature modules (isolated workflows)
│   ├── tts/                   # Module 1: TTS + SRT
│   │   ├── index.ts            # Public API
│   │   ├── types.ts            # TTS-specific types
│   │   ├── pipeline.ts        # TTS processing pipeline
│   │   └── services/
│   │       └── edgeTts.ts     # Edge TTS engine
│   │
│   ├── translation/           # Module 2: Text Translation (VIDEO → TEXT)
│   │   ├── index.ts         # Public API
│   │   ├── types.ts         # Translation types
│   │   ├── pipeline.ts     # Translation pipeline
│   │   └── services/
│   │       ├── whisper.ts   # Whisper transcription
│   │       └── gemini.ts  # Gemini translation
│   │
│   └── dubbing/             # Module 3: Video Dubbing (FULL)
│       ├── index.ts        # Public API
│       ├── types.ts      # Dubbing types
│       ├── pipeline.ts  # Dubbing pipeline
│       └── services/
│           ├── merger.ts    # Video/audio merger
│           └── assBuilder.ts # ASS subtitle builder
│
├── shared/
│   └── types/
│       ├── segment.ts    # Segment, TranslatedSegment (SHARED)
│       └── api.ts       # API response types
│
└── jobs/                   # (future) Job system
```

## Data Flow

### TTS Pipeline
```
Input: text → EdgeTTS → Output: audio + SRT
```

### Translation Pipeline  
```
Input: audio → Whisper → Gemini → Output: text (paragraph)
```

### Dubbing Pipeline
```
Input: video → Extract Audio → Whisper → Gemini → TTS → Merge → Output: dubbed video
```

## Key Principles

1. **No cross-calling**: Dubbing uses Translation's services, not Translation's pipeline
2. **Shared types**: Segment, TranslatedSegment used across all modules
3. **Clean boundaries**: Each module has its own index.ts for public API
4. **Thin pipelines**: Services handle heavy logic, pipelines orchestrate