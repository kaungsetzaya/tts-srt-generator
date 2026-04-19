# 🏗 Strict Architecture Rules

## 🔒 Service Rules

### Service Definition
- Services must be **atomic** and **single-purpose**
- Services must **NOT orchestrate** workflows
- Services must **NOT call** multiple other services in sequence
- Each service does ONE thing well

### Examples
```typescript
// GOOD - atomic service
class WhisperService {
  async transcribe(audioBuffer: Buffer): WhisperResult
}

// GOOD - atomic service  
class EdgeTtsService {
  async generate(input: TtsInput): TtsOutput
}

// BAD - orchestration service (NOT allowed)
class TranslateAndTtsService {
  async process() {  // This orchestrates!
    const transcript = await whisper.transcribe()     // calling service
    const translated = await gemini.translate()   // calling another
    const audio = await tts.generate()       // calling another
    // VIOLATION!
  }
}
```

---

## 🔒 Pipeline Rules

### Pipeline Definition
- **Only pipelines** orchestrate multi-step workflows
- Pipelines must call services **step-by-step**
- Pipelines must **NOT call** other pipelines

### Structure
```typescript
// GOOD - clear step-by-step orchestration
class DubbingPipeline {
  async process(input: DubbingInput): Promise<DubbingOutput> {
    // Step 1: Extract audio
    const audioBuffer = await media.extractAudio(input.videoBuffer);
    
    // Step 2: Transcribe
    const whisperResult = await whisper.transcribe(audioBuffer);
    
    // Step 3: Translate segments
    const translated = await translateSegments(whisperResult.segments);
    
    // Step 4: Generate TTS
    const ttsAudio = await edgeTts.generate({...});
    
    // Step 5: Merge
    return await media.merge(...);
  }
}

// BAD - calling other pipelines
class BadPipeline {
  async process() {
    // VIOLATION - calling pipeline!
    const translationResult = await translationPipeline.process(audio);
  }
}
```

---

## 🔒 Translation Rules

### Gemini Service (ONE SOURCE ONLY)
- **Only ONE** `gemini.service.ts` is allowed
- Must expose:
  - `translateFullText(text: string): Promise<string>` - for Translation pipeline
  - `translateSegments(segments: Segment[]): Promise<TranslatedSegment[]>` - for Dubbing pipeline

### Forbidden
- ❌ `geminiDubTranslator.ts`
- ❌ `translateForDubbing()`
- ❌ Duplicate translation functions

---

## 🔒 Media Rules

### FFmpeg Isolation
- **ALL** ffmpeg logic must exist only in `media` module
- No other module may directly use ffmpeg
- All media operations go through `media` service

```typescript
// GOOD - use media service
const audioBuffer = await media.extractAudio(videoBuffer);

// BAD - direct ffmpeg import
import ffmpeg from "fluent-ffmpeg"; // in dubbing module - FORBIDDEN!
```

---

## 🔒 API Rules

### Controller Thinness
- Controllers/Routes must be **thin**
- No business logic inside routes
- Routes only call pipelines

```typescript
// GOOD - thin route
router.mutation('dubVideo', async ({ input }) => {
  return dubbingPipeline.process(input);  // Just calls pipeline
});

// BAD - fat route (FORBIDDEN)
router.mutation('dubVideo', async ({ input }) => {
  // VIOLATION - business logic inline!
  const audio = await extractAudio(...);
  const segments = await whisper.transcribe(...);
  const translated = await gemini.translate(...);
  // ...
});
```

---

## 🔒 Pipeline Quality Requirements

Each pipeline **MUST** have:

1. ✅ Clearly **numbered steps** in comments
2. ✅ Exactly **one service** per step
3. ✅ **Readable** and debuggable
4. ✅ **Structured** output

---

## ❌ Forbidden Patterns

| Pattern | Rule |
|---------|------|
| Pipeline calling pipeline | FORBIDDEN |
| Duplicate translation logic | FORBIDDEN |
| Mixed responsibilities in services | FORBIDDEN |
| Inline complex logic in pipelines | FORBIDDEN |
| Multiple Segment type definitions | FORBIDDEN |
| Direct ffmpeg in feature modules | FORBIDDEN |
| Fat routes/controllers | FORBIDDEN |

---

## 📋 Directory Enforcement

```
src/modules/
├── tts/              # ONLY tts
│   └── services/      # NOT pipeline
├── translation/      # ONLY translation  
│   └── services/    # whisper, gemini (ONE each)
├── dubbing/        # ONLY dubbing
│   └── services/   # assBuilder only
└── media/         # ONLY media
    └── services/   # ffmpeg ONLY
```

**No feature module may contain:**
- ❌ Pipeline files
- ❌ Orchestration logic
- ❌ Direct imports of other services

---

## 🔑 Service Reuse Guidelines

| Feature | Can Use | Cannot Use |
|---------|--------|-----------|
| TTS module | (standalone) | whisper, gemini, media |
| Translation module | whisper, gemini | tts, dubbing |
| Dubbing module | whisper, gemini, tts, media | translation.pipeline |

**Key**: Dubbing reuses `whisper.service` and `gemini.service` directly - NOT `translation.pipeline`.