# TTS to SRT Generator - Project TODO

## Backend Development
- [x] Install Edge TTS library and dependencies
- [x] Create database schema for storing conversion history
- [x] Build tRPC procedure for audio generation with Edge TTS
- [x] Build tRPC procedure for SRT file generation
- [x] Implement tone/pitch adjustment logic
- [x] Implement speed adjustment logic
- [x] Implement aspect ratio selection (9:16 and 16:9)
- [x] Add audio preview endpoint with short test text
- [ ] Write backend tests for TTS and SRT generation

## Frontend Development
- [x] Design cyberpunk color palette and theme (neon pink, electric cyan, deep black)
- [x] Create global styles with neon glow effects and HUD elements
- [x] Build text input component for user content
- [x] Build voice selection dropdown (Thiha, Nilar)
- [x] Build tone adjustment slider/input control
- [x] Build speed adjustment slider/input control
- [x] Build aspect ratio selector (9:16, 16:9)
- [x] Build audio preview player component
- [x] Build generate button with loading state
- [x] Build download links for audio and SRT files
- [x] Implement cyberpunk UI styling with geometric elements and corner brackets
- [x] Add neon text glow effects and technical lines

## Integration & Testing
- [x] Connect frontend to backend API for audio generation
- [x] Connect frontend to backend API for SRT generation
- [x] Implement audio preview functionality with test text
- [x] Test file download functionality for both audio and SRT
- [x] Test all voice, tone, and speed combinations
- [x] Test aspect ratio output for SRT files
- [x] Verify responsive design on different screen sizes
- [x] Test error handling and user feedback
- [x] Write and run backend unit tests for TTS service

## VPS Integration
- [x] Add VPS TTS configuration to environment variables
- [x] Create VPS TTS service module
- [x] Update backend procedures to use VPS API
- [x] Implement fallback to built-in Edge TTS
- [x] Write and test VPS integration (4 tests passing)
- [x] Verify security (VPS IP not exposed to frontend)

## Testing & Deployment
- [x] Remove authentication for testing
- [x] Enable public access to TTS generator
- [x] Remove user tracking from database
- [ ] Test web application with VPS integration
- [ ] Test audio generation from VPS
- [ ] Test SRT file generation
- [ ] Test file downloads
- [ ] Implement Telegram bot authentication (pending)
- [ ] Implement admin dashboard (pending)
