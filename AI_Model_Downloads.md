# AI Model Download Locations and Baseline Commands

This file is a quick reference extracted from the main Codex plan. Use official sources only.

## Baseline Ollama models

```powershell
ollama pull qwen3.5:4b
ollama pull qwen3.5:9b
ollama pull qwen3-vl:4b
ollama pull qwen3-embedding:0.6b
```

## Optional Ollama models

```powershell
ollama pull qwen3.5:2b
ollama pull qwen3-vl:8b
ollama pull qwen3:0.6b
ollama pull qwen3.6
```

## Local non-Ollama engines

- Qwen3-Reranker-0.6B: https://huggingface.co/Qwen/Qwen3-Reranker-0.6B
- Qwen3-ASR-0.6B: https://huggingface.co/Qwen/Qwen3-ASR-0.6B
- Qwen3-ASR-1.7B: https://huggingface.co/Qwen/Qwen3-ASR-1.7B
- Qwen3-ASR runtime examples: https://github.com/QwenLM/Qwen3-ASR
- faster-whisper: https://github.com/SYSTRAN/faster-whisper
- Silero VAD: https://github.com/snakers4/silero-vad
- Kokoro-82M: https://huggingface.co/hexgrad/Kokoro-82M
- Kokoro inference: https://github.com/hexgrad/kokoro
- ComfyUI: https://github.com/comfy-org/comfyui
- Comfy Desktop: https://comfy.org/download/

## External provider documentation

- OpenAI API: https://developers.openai.com/api/docs
- Anthropic Claude: https://platform.claude.com/docs
- Google Gemini API: https://ai.google.dev/gemini-api/docs
- LiteLLM routing/load balancing: https://docs.litellm.ai/docs/routing-load-balancing
- OpenRouter: https://openrouter.ai/

## Model lifecycle API note

Ollama `keep_alive` should be used by the app to load/unload models. Use `keep_alive: 0` for immediate unload.
