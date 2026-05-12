# ADR 0010: Open-weights-only LLM policy

- **Status:** Accepted (encoded in `litellm/config.yaml` routing + comment header)
- **Date:** 2026-03 (best estimate, captured in `litellm/config.yaml` preamble)
- **Decider:** DarrenSJZ (sole maintainer)

## Context

The extraction pipeline depends on LLMs (and VLMs) for classification,
structural reasoning, and JSON-mode field extraction. Closed-weight
frontier models (OpenAI GPT-4, Anthropic Claude, Google Gemini Pro)
would work and would arguably produce stronger raw quality on vision
tasks, but they come with operational properties that are hostile to
this project's profile:

- **Single-provider lock.** A given closed model runs on exactly one
  provider's infrastructure. Any outage, rate-limit, or pricing change
  is a hard stop.
- **Pricing margin.** API price reflects provider margin on top of
  inference cost, not just inference cost itself.
- **Egress dependency.** No local fallback when the internet is flaky
  or the provider is down.

Open-weight models invert all three: the same architecture and weights
can be served by multiple inference providers (Groq, NIM, Google AI
Studio, Ollama Cloud, Doubleword) — or locally — and providers compete
on inference price/latency rather than capturing the model itself.

## Decision

Every model exposed via the LiteLLM proxy is open-weight. The
`litellm/config.yaml` header documents this policy:

> Open-weights models only. Hosted endpoints are fine (Groq, NIM,
> Google AI Studio for Gemma, Doubleword) as long as the underlying
> model is open-source — no Gemini, no GPT, no Claude.

The current `model_list`:

- `ollama-gemma4-31b` — Ollama Cloud serving Gemma 4 31B, vision +
  multi-image, **primary extractor**.
- `gemma-4-31b` — Google AI Studio serving the same Gemma 4 31B
  weights, **fallback when Ollama Cloud is throttled/down**.
- `groq-llama4-scout` / `groq-llama4-maverick` — Groq Llama 4
  (Scout 17Bx16E / Maverick 17Bx128E), vision-capable, multi-image,
  free tier.
- `nim-llama-90b-vision` — NVIDIA NIM Llama 3.2 90B Vision, single
  image per request only (used for single-page classification).
- `doubleword-qwen3.5` — Doubleword Qwen 3.5 397B-A17B FP8 with
  dottxt schema-enforced output, text-only.
- `groq-llama-3.3-70b` — Groq Llama 3.3 70B versatile, text-only.

Provider failover is encoded in `router_settings.fallbacks`: e.g.
`ollama-gemma4-31b → gemma-4-31b → groq-llama4-scout →
groq-llama4-maverick`. Same weights or compatible open-weight families
all the way down.

## Consequences

- **Real failover.** Same weights at multiple providers means a Groq
  outage or an Ollama Cloud throttle drops onto Google AI Studio
  Gemma without a quality cliff, because it's literally the same
  model.
- **Bounded cost.** Pricing tracks inference cost, not API margin.
  Local Ollama (off-cloud) is available as a final fallback for
  offline / cost-floor work.
- **Quality ceiling.** Open vision models lag closed frontier models
  on raw image understanding. The pipeline compensates by leaning on
  Chandra OCR for the heavy structural lift (table cell HTML,
  bounding boxes, reading order) and using the VLM for semantics on
  top of structured anchors, not for unaided document parsing.
- **No-closed-model invariant** is a review gate for new model
  additions. Adding GPT-4 / Claude / Gemini Pro would break the
  failover model and the cost story — `litellm/config.yaml`'s
  comment header is the policy reference.

## Alternatives considered

- **OpenAI GPT-4 / GPT-4o** — strongest raw quality, but closed
  weights, single provider, premium pricing.
- **Anthropic Claude (Sonnet / Opus)** — same trade-off; no
  alternative inference path if Anthropic is down.
- **Google Gemini Pro** — closed weights (distinct from open Gemma);
  one provider only.
- **Mix of open + closed** — defeats the policy. A pipeline whose
  primary path is closed gets no benefit from open weights in the
  fallback chain; the failure mode of "primary closed model down"
  is unsolved.

## References

- Source: `litellm/config.yaml` lines 120–128 (header policy
  statement: "Open-weights models only ... no Gemini, no GPT, no
  Claude").
- Source: `litellm/config.yaml` lines 144–219 (`model_list` — every
  entry is an open-weight model).
- Source: `litellm/config.yaml` lines 221–233
  (`router_settings.fallbacks` — Ollama Cloud Gemma → Google AI
  Studio Gemma → Groq Llama 4 cascade).
- Related: ADR 0003 (LiteLLM proxy as the single LLM ingress).
