/**
 * Processor Registry — Aggregates all feature-specific processors
 */
import { registerDubbingProcessors } from "./dubbing.processor";
import { registerVideoTranslateProcessors } from "./video-translate.processor";

export function registerAllProcessors() {
    registerDubbingProcessors();
    registerVideoTranslateProcessors();
}
