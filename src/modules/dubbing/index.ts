import type { DubbingInput, DubbingOutput } from "./types";
import { processDubbing } from "./pipeline";

export async function dubVideo(input: DubbingInput): Promise<DubbingOutput> {
  return processDubbing(input);
}

export { type DubbingInput, type DubbingOutput, type DubbingOptions } from "./types";