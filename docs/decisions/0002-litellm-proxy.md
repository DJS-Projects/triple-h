# ADR 0002: All LLM traffic via LiteLLM proxy

- **Status:** Accepted
- **Date:** 2026-04-10
- **Decider:** DarrenSJZ (sole maintainer)

## Context

The pipeline touches multiple LLM providers: Ollama Cloud (Gemma 4 31B), Groq (Llama 4 Scout/Maverick, Llama 3.3 70B), NVIDIA NIM (Llama 3.2 90B Vision), Doubleword (Qwen3.5-397B), Google AI Studio (Gemma fallback). Each provider has its own SDK, auth scheme, error model, and quirks (NIM's hard 1-image-per-request limit; Groq's tight `max_completion_tokens`; Qwen's `<think>` blocks).

We need:

- **One API surface** so the application doesn't fan out into per-provider clients.
- **One observability hook** so every LLM call (regardless of provider) is captured in Langfuse with consistent fields (prompt, completion, tokens, cost, latency).
- **Fallback routing** so when Ollama Cloud throttles we transparently retry on Google AI Studio, then Groq, without per-call logic in the application.
- **A policy boundary** to enforce "open-weights only" (no Gemini, GPT, or Claude) at the config layer rather than relying on developer discipline at call sites.

## Decision

- All LLM calls go to the LiteLLM proxy at `http://litellm:4000`.
- Model catalogue lives in `litellm/config.yaml` (`model_list`).
- Fallback chains live in `router_settings.fallbacks` (Ollama primary; Google AI Studio + Groq cascade as fallbacks).
- Observability is wired via `litellm_settings.success_callback: ["langfuse"]` and `failure_callback: ["langfuse"]`.
- **No direct provider SDK clients in `fastapi_backend/`.** This is stated explicitly in `CLAUDE.md` ("Don't add direct provider clients to backend code").

## Consequences

- Adding or swapping a provider is a `litellm/config.yaml` change plus an env-var add via `mise env:addkey`. Application code is untouched.
- Every LLM call is automatically traced in Langfuse — the application never imports the Langfuse SDK for LLM telemetry (it only does for non-LLM events).
- Local dev, staging, and prod hit the same surface (`http://litellm:4000` inside the docker network, or whatever the deployed proxy URL is). Reduces "works on my machine" cases.
- Provider-specific quirks (max tokens, thinking-mode flags, image-count limits, retry behaviour) are encoded once, in the proxy config — see comments in `litellm/config.yaml` for the multi-image policy and the Qwen / Gemma 4 thinking-disable A/B tests.
- We are coupled to LiteLLM. If LiteLLM disappears or breaks, every LLM path breaks. Mitigation: the proxy is a thin, well-maintained adapter; replacement options exist (OpenRouter as a hosted alternative, or per-provider clients as a fallback).

## Alternatives considered

- **Direct provider SDKs (`openai`, `groq`, `google-genai`, etc.) in app code** — no unified observability hook, scattered retry/timeout logic, harder to enforce the open-weights-only policy.
- **LangChain / LlamaIndex with provider integrations** — already removed from the codebase in commit `629d7ca`. Heavyweight abstractions, opinionated about chains/agents, and the chat-completion layer drifts behind direct provider APIs.
- **OpenRouter as the proxy** — viable, but it is a third-party hosted service rather than a self-hosted proxy. Adding a hop through someone else's infra for every LLM call is operationally heavier.
- **Build our own routing layer** — months of work to reproduce LiteLLM's fallbacks, callbacks, and multi-provider auth handling. Not justified for a solo-dev project.

## References

- Source: `CLAUDE.md` "Other rules" section ("All LLM calls go through the LiteLLM proxy at `http://litellm:4000`").
- Source: `litellm/config.yaml` (full model catalogue, router settings, Langfuse callback wiring).
- Source: `docker-compose.yml` `litellm` service.
- Removal of LangChain abstractions: commit `629d7ca`.
