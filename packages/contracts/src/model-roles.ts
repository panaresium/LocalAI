export const MODEL_ROLE_ALIASES = [
  "controller.fast",
  "agent.general",
  "agent.deep",
  "agent.code",
  "agent.summarize",
  "agent.verify",
  "vision.general",
  "vision.ui_grounding",
  "vision.document",
  "vision.video",
  "speech.vad",
  "speech.asr.fast",
  "speech.asr.accurate",
  "speech.tts.fast",
  "speech.tts.quality",
  "retrieval.embedding",
  "retrieval.reranker",
  "image.generate",
  "image.edit",
  "image.verify",
  "video.analyze",
  "video.generate",
  "translation.fast",
  "translation.quality"
] as const;

export type ModelRoleAlias = (typeof MODEL_ROLE_ALIASES)[number];
