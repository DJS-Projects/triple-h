# Infrastructure Cost Analysis — OCR + LLM Combos

**Baseline:** 35,000 pages/month · 420,000 pages/year · MYR at 1 USD = 4.40

## Assumptions

- PaddleOCR on 4-core CPU: ~15 sec/page average → ~240 pages/hr
- PaddleOCR on 8-core CPU: ~8 sec/page → ~450 pages/hr
- PaddleOCR on GPU (A4000): ~2 sec/page → ~1,800 pages/hr
- Marker (self-hosted, GPU): ~3 sec/page → ~1,200 pages/hr · needs 5GB VRAM
- LLM tokens per page: ~1,150 input + ~350 output
- "12h" = business hours (12h/day, 30 days) · "24/7" = continuous

---

## Combo Ranking (sorted by aggregate score)

| # | OCR | LLM | Cost/mo (RM) | Cost/page (RM) | Max pages/mo | Reliability | Quality | Ops Burden | Score |
|---|-----|-----|-------------|---------------|-------------|-------------|---------|------------|-------|
| 1 | PaddleOCR · Hetzner CX32 | Gemini 2.5 Flash | 92 | 0.0026 | 170K | ★★★☆☆ | ★★★★☆ | Self-managed | **4.1** |
| 2 | PaddleOCR · Hetzner CX32 | DeepSeek V3 (OpenRouter) | 73 | 0.0021 | 170K | ★★★☆☆ | ★★★½☆ | Self-managed | **3.9** |
| 3 | PaddleOCR · Hetzner CX32 | Gemini 2.5 Flash Lite | 62 | 0.0018 | 170K | ★★★☆☆ | ★★★☆☆ | Self-managed | **3.8** |
| 4 | PaddleOCR · GCP e2-medium | Gemini 2.5 Flash | 167 | 0.0048 | 170K | ★★★★☆ | ★★★★☆ | Self-managed | **3.8** |
| 5 | PaddleOCR · Hetzner CX32 | GPT-4o Mini (OpenRouter) | 92 | 0.0026 | 170K | ★★★½☆ | ★★★½☆ | Self-managed | **3.8** |
| 6 | PaddleOCR · Hetzner AX42 | Gemini 2.5 Flash | 270 | 0.0077 | 500K | ★★★½☆ | ★★★★☆ | Self-managed | **3.8** |
| 7 | Datalab Balanced API | — (extraction built-in) | 616 | 0.0176 | 10M+ | ★★★★★ | ★★★★½ | Zero ops | **3.7** |
| 8 | PaddleOCR · AWS t3a.medium | GPT-4o Mini (OpenRouter) | 179 | 0.0051 | 170K | ★★★★☆ | ★★★½☆ | Self-managed | **3.7** |
| 9 | Datalab Balanced API | Gemini 2.5 Flash Lite | 645 | 0.0184 | 10M+ | ★★★★★ | ★★★★★ | Zero ops | **3.6** |
| 10 | Marker · RunPod A4000 | — (built-in LLM modes) | 634 | 0.0181 | 1M+ | ★★½☆☆ | ★★★★½ | GPU ops | **3.4** |
| 11 | PaddleOCR · Hetzner CX32 | Claude Haiku 4.5 | 390 | 0.0111 | 170K | ★★★☆☆ | ★★★★½ | Self-managed | **3.4** |
| 12 | PaddleOCR · RunPod A4000 | Gemini 2.5 Flash | 693 | 0.0198 | 1.3M | ★★½☆☆ | ★★★★☆ | GPU ops | **3.2** |
| 13 | Datalab High Accuracy | — (extraction built-in) | 924 | 0.0264 | 10M+ | ★★★★★ | ★★★★★ | Zero ops | **3.1** |
| 14 | Azure Doc Intelligence | Gemini 2.5 Flash Lite | 1,569 | 0.0448 | Unlimited | ★★★★★ | ★★★★☆ | Minimal | **2.4** |
| 15 | AWS Textract | Gemini 2.5 Flash Lite | 2,339 | 0.0668 | Unlimited | ★★★★★ | ★★★★☆ | Minimal | **2.0** |

---

## Scoring Methodology

Each combo scored 1–5 on five dimensions, then averaged:

| Dimension | Weight | 5 (best) | 1 (worst) |
|-----------|--------|----------|-----------|
| **Cost** | 25% | < RM 100/mo | > RM 1,500/mo |
| **Capacity** | 15% | > 1M pages/mo | < 100K pages/mo |
| **Reliability** | 25% | 99.99% SLA, managed, auto-failover | Single box, no SLA |
| **Quality** | 20% | Benchmark-leading extraction, thinking models | Basic OCR + light LLM |
| **Ops Burden** | 15% | Zero ops (fully managed API) | Self-managed GPU servers |

---

## Key Takeaways

### Best overall: #1 — PaddleOCR (Hetzner) + Gemini 2.5 Flash
- **RM 92/month** for 35K pages = RM 0.0026/page
- Current stack, proven, Gemini's thinking capability helps complex docs
- 170K capacity is 5× the 35K requirement
- Only downside: single-box risk (mitigated by adding second node for ~RM 33 more)

### Best zero-ops: #7 — Datalab Balanced API
- **RM 616/month** — 10× more expensive but zero infrastructure to manage
- 99.99% uptime, no servers, no PaddleOCR updates, no GPU management
- Extraction quality is benchmark-leading (they made Marker)
- Could eliminate the LLM step entirely if their structured extraction is good enough

### Best budget: #3 — PaddleOCR (Hetzner) + Gemini Flash Lite
- **RM 62/month** — absurdly cheap
- Quality is slightly lower but Flash Lite handles JSON extraction well

### Best scale: #10 — Marker (RunPod GPU) or #7 — Datalab API
- If volume grows past 500K/month, GPU or managed API is the way
- Datalab scales infinitely, Marker self-hosted scales with GPU count

### Not worth it
- Azure Doc Intelligence (#14) and AWS Textract (#15) are 15–25× more expensive than self-hosted PaddleOCR with no meaningful quality advantage for this use case
- RunPod GPU (#12) only makes sense if you need >500K pages/month

---

## Margin Analysis at RM 0.143/page (24-month plan)

Revenue: RM 5,000/month (35K pages × RM 0.143)

| Stack | Infra Cost | Gross Margin | Margin % |
|-------|-----------|-------------|----------|
| #1 PaddleOCR + Gemini Flash | RM 92 | **RM 4,908** | 98.2% |
| #3 PaddleOCR + Flash Lite | RM 62 | **RM 4,938** | 98.8% |
| #7 Datalab Balanced | RM 616 | **RM 4,384** | 87.7% |
| #9 Datalab + Flash Lite | RM 645 | **RM 4,355** | 87.1% |
| #13 Datalab High Accuracy | RM 924 | **RM 4,076** | 81.5% |

**Note:** Gross margin before support staff, maintenance, and admin overhead (~RM 1,500-3,500/month).

---

## Recommendation

**Start with #1 (current stack), evaluate #7 (Datalab) as a premium tier.**

- The current PaddleOCR + Gemini Flash stack at RM 92/month gives 98% gross margin
- If ops burden becomes painful or quality needs to improve, Datalab at RM 616/month still leaves 87% gross margin
- Both are well within the RM 5K/month revenue at the 24-month plan rate
- The real cost is human support time, not infrastructure
