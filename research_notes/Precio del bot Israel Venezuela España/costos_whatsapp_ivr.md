# Variable operating costs: WhatsApp Cloud API + Telnyx IVR + OpenAI + hosting (Israel, Venezuela, Spain) as of November 2026

Research date: 2026-11-12. All prices in USD and pay-as-you-go list prices unless stated otherwise.

## 1. Meta WhatsApp Business Platform: per-message pricing (Israel, Spain, Venezuela)

### Takeaway
Meta charges per delivered template message by category and destination country (model in force since 2025-07-01). **The big 2026 change is that since 2026-10-01 Meta again charges for service messages (free-form replies inside the 24h window) above 1,000 free per phone number per month, and utility templates sent inside an open window are no longer free.** Current rates (rate card effective 2026-10-01; none of the three markets changed in October): Israel marketing $0.0353 and utility/auth/service $0.0053; Spain $0.0707 and $0.0200; Venezuela is billed as "Rest of Latin America" at $0.0740 and $0.0113.

### Cited Findings
**Pricing model and rules (official Meta docs)**
- Per-message pricing has been in force since July 1, 2025. "Businesses are only charged when a message is delivered." Rates depend on category and destination market. Messages from users to the business are not charged. — [Meta: Pricing on the WhatsApp Business Platform](https://developers.facebook.com/docs/whatsapp/pricing)
- Categories: marketing, utility and authentication (templates, "can be delivered at any time"); service (non-template replies inside an open window); Meta Business Agent (AI replies, $2.00 per 1M tokens, roughly 4–5¢ per message). — [Meta pricing](https://developers.facebook.com/docs/whatsapp/pricing)
- Customer service window (CSW): it opens when the user writes or calls and lasts 24 hours. Non-template messages can only be sent while it is open. — [Meta pricing](https://developers.facebook.com/docs/whatsapp/pricing)
- **Service messages are charged again from October 1, 2026.** Meta "resumed charging, on a per-message basis, for messages that were previously free". Service had been free since Nov 1, 2024. — [Meta: Pricing updates](https://developers.facebook.com/docs/whatsapp/pricing/updates-to-pricing)
- **Free tier:** "Each business phone number has one free tier of 1,000 delivered service messages per month." Unused messages do not roll over, and the tier resets monthly at 12am in the account timezone. Without a payment method, service messages stop being delivered once the free tier is used up. — [Meta pricing updates](https://developers.facebook.com/docs/whatsapp/pricing/updates-to-pricing)
- **Utility inside an open window:** these were free from July 1, 2025. Since October 1, 2026 they are charged, and the pricing type changed "from `free_customer_service` to `regular`". — [Meta pricing](https://developers.facebook.com/docs/whatsapp/pricing); [Meta pricing updates](https://developers.facebook.com/docs/whatsapp/pricing/updates-to-pricing)
- Free Entry Point (FEP): when a user writes from a Click-to-WhatsApp ad (Android/iOS), that message is free and opens a window of up to 7 days in which marketing, utility, authentication and service messages are all free. — [Meta pricing](https://developers.facebook.com/docs/whatsapp/pricing)
- Volume tiers: "Volume tiers only apply to utility and authentication messages." They are calculated per market and category, aggregated at the business portfolio level, reset monthly, and only count charged messages. There are no volume tiers for service. — [Meta pricing](https://developers.facebook.com/docs/whatsapp/pricing); [Formbeep](https://formbeep.com/whatsapp-api-pricing/)
- "Meta may update pricing only on the 1st day of each quarter." 16 billing currencies are enabled since July 1, 2026, and "once selected, a currency cannot be changed." — [Meta pricing](https://developers.facebook.com/docs/whatsapp/pricing)
- 2026 changes affecting these markets: on **July 1, 2026, Spain marketing went up ("Higher")**. Israel and Rest of Latin America show no changes in 2026. On October 1, 2026, marketing rose in 7 other markets (Kuwait, Mexico, Morocco, Saudi Arabia, UAE, Rest of APAC, Rest of Middle East). — [Meta pricing updates](https://developers.facebook.com/docs/whatsapp/pricing/updates-to-pricing)
- **Venezuela is billed as "Rest of Latin America"**: "Venezuela (VE) - 58" is listed inside that region, which groups 15 markets. — [Meta pricing updates](https://developers.facebook.com/docs/whatsapp/pricing/updates-to-pricing)
- Starting in 2026, businesses on the Marketing Messages API can set a maximum price per marketing message. — [Meta pricing](https://developers.facebook.com/docs/whatsapp/pricing)

**Rates (USD per delivered message, rate card effective 2026-10-01)**

| Market | Marketing | Utility | Authentication | Service (above 1,000 free) |
|---|---|---|---|---|
| Israel | $0.0353 | $0.0053 | $0.0053 | $0.0053 |
| Spain | $0.0707 | $0.0200 | $0.0200 | $0.0200 |
| Rest of Latin America (incl. Venezuela) | $0.0740 | $0.0113 | $0.0113 | $0.0113 |

- Source for the table: [Formbeep, "WhatsApp Business API Pricing (Nov 2026)"](https://formbeep.com/whatsapp-api-pricing/) (cites Meta's USD rate card, page updated 2026-10-29) and [Voltade](https://voltade.com/resources/guides/whatsapp/whatsapp-business-api-pricing) (same figures, says service = the market's utility rate). Israel figures are also confirmed by [Flowcall](https://www.flowcall.co/blog/whatsapp-business-api-pricing). Spain and Rest of LatAm figures also match [Chatfuel](https://chatfuel.com/blog/whatsapp-business-pricing) and [WhatsPilot](https://whatsapppilot.esafqa.com/blog/whatsapp-business-api-pricing-explained).
- Contradicting source: [Gallabox](https://docs.gallabox.com/pricing-and-billing/whatsapp-pricing/rate-card) shows higher marketing figures (Spain $0.0813, Israel $0.0406, Rest of LatAm $0.0851), probably because it includes a markup or carries inconsistent data. It is discarded in favor of the 4 sources that agree.
- Minor discrepancy: Formbeep places the Spain marketing increase in the Q4 2026 update, while Meta's official page dates it to **July 1, 2026**. Meta's page should be trusted.

### Inferences
- **Since service and utility have the same price in each market from 2026-10-01**, sending the confirmation or a reminder as free-form text inside the window instead of as a utility template **saves only while that shop's number stays under its 1,000 free service messages per month**. Above that, the cost per message is the same either way. The free tier is per phone number, so in the multi-tenant model each shop with its own number gets its own 1,000 free.
- The "come back after a month" message and the weekday-discount promos will most likely be classified as **marketing** by Meta. They are 6–7 times more expensive than utility: $0.0353 IL, $0.0707 ES, $0.0740 VE.
- In Spain and Venezuela, marketing costs about the same per message (~$0.07), but utility in Spain is almost twice the Venezuelan rate ($0.0200 vs $0.0113).

### Gaps
- Meta's official CSV/PDF rate card could not be downloaded directly: the developers page links to it but the URL was not reachable, and the interactive table on whatsappbusiness.com renders with JavaScript. The rates come from 4 secondary sources that agree with each other and cite Meta's USD card.
- The volume tier thresholds and discounts for utility in Israel, Spain and Rest of LatAm were not found. For a small portfolio (tens of shops) they would not apply in the first months anyway.
- Taxes (VAT) that Meta adds to the invoice depending on the billing country were not researched.
- Not confirmed: whether Meta classifies a "come back and book" message as utility or marketing. The template classifier decides, and promotional wording is usually treated as marketing.

## 2. Telnyx: Israeli number, inbound and outbound minutes, TeXML and TTS

### Takeaway
Israel on Telnyx: a number from $3/month (local) or $3.60/month (national/mobile), inbound from $0.005/min of SIP plus $0.002/min of Voice API/TeXML (≈$0.007/min total), outbound to Israeli mobiles $0.0369/min plus $0.002. The Azure Hebrew voice in use (`Azure.he-IL-AvriNeural`) has **no published per-character price** on Telnyx's pricing page. The worst case would be about $0.000045–0.000048 per character.

### Cited Findings
- Israel numbers (Telnyx USD table, country=il): "Local numbers: From $3 per month", "National numbers: From $3.60 per month", "Mobile numbers: From $3.60 per month", "Toll-free numbers: From $15 per month". — [Telnyx pricing API, numbers?country=il](https://telnyx.com/api/pricing/numbers?country=il) (data behind [telnyx.com/pricing/numbers/il](https://telnyx.com/pricing/numbers/il))
- Project records: the actual purchase of the +972 76-567-1114 number cost "US$3 setup + US$3/month". — `/home/user/whatapp/CLAUDE.md` (internal record, not a public price list). The "076" prefix is not tied to a city, so it is unclear whether Telnyx bills it as "local" ($3) or "national" ($3.60). The real charge was $3/month.
- Israel SIP (Elastic SIP, country=il): outbound "Local - Fixed $0.0085 per minute", "Local - Mobile $0.0369 per minute"; inbound "Local calls: Starting at $0.005 per minute"; "Toll-free calls: Starting at $0.04 per minute". — [Telnyx pricing API, elastic-sip?country=il](https://telnyx.com/api/pricing/elastic-sip?country=il)
- Voice API / TeXML: "Make outbound calls: $0.002 per minute + the SIP Trunking fee"; "Local number: $0.002 per minute + the SIP Trunking fee for inbound calls"; "If you're using TeXML, you'll be charged the same $0.002 fee." Platform fee: $0. "Call transfer: $0.10 per invocation." — [Telnyx Voice API pricing](https://telnyx.com/pricing/voice-api) ([.md version](https://telnyx.com/pricing/call-control.md))
- Telnyx TTS per character: Telnyx TTS $0.000003; Amazon Polly Standard $0.000009; Polly Neural $0.000024; Telnyx HD $0.000048; "Azure Neural HD TTS: BYO API key (billed by Azure)". Azure standard (non-HD) voices are not listed. — [Telnyx TTS pricing](https://telnyx.com/pricing/text-to-speech) ([API country=il](https://telnyx.com/api/pricing/text-to-speech?country=il))
- A Telnyx release note (June 2025) gave Azure HD voices at "$0.000045 per character". It conflicts with the current page, which says BYO key. — [Telnyx release note: Azure Neural HD voices](https://telnyx.com/release-notes/azure-neural-hd-voices-telnyx-tts)
- For comparison, if the IVR is replicated in other countries: **Spain** local number from $1/month (national/mobile $1.50), inbound "Starting at $0 per minute", outbound to mobile $0.024/min. **Venezuela** local number from $12/month, inbound from $0.015/min, outbound from $0.02/min. — [Telnyx numbers ES](https://telnyx.com/api/pricing/numbers?country=es), [SIP ES](https://telnyx.com/api/pricing/elastic-sip?country=es), [numbers VE](https://telnyx.com/api/pricing/numbers?country=ve), [SIP VE](https://telnyx.com/api/pricing/elastic-sip?country=ve)

### Inferences
- Inbound Israel IVR minute ≈ $0.005 (SIP) + $0.002 (TeXML) = **$0.007/min**. A transfer to the barber (option 0, `<Dial>` to an Israeli mobile) adds ≈ $0.0369 + $0.002 = **$0.039/min** for the outgoing leg, plus the $0.10 "Call transfer" fee if Telnyx counts it as an invocation (unconfirmed for TeXML `<Dial>`).
- Hebrew TTS: if the Azure standard voice were billed at the HD price ($0.000045–0.000048/char), a 2-minute call with ~1,000 characters of prompts would cost ≈ $0.05. That is the conservative ceiling.

### Gaps
- No published price was found for **Azure standard voices (e.g. he-IL-AvriNeural) in TeXML `<Say>`**, nor whether Telnyx charges for them at all. The way to confirm is to check the "TTS" line on the real invoice in the Telnyx portal.
- The listed "Starting at" / "From" figures are minimums. Telnyx says "Rates may vary by destination and volume tier".
- Not confirmed whether `<Dial>` in TeXML triggers the $0.10 "Call transfer" fee.

## 3. OpenAI: transcription (voice notes) and NLU

### Takeaway
whisper-1 costs $0.006/min (gpt-4o-mini-transcribe $0.003/min). gpt-4o-mini costs $0.15 input / $0.075 cached input / $0.60 output per 1M tokens. For one shop this is cents per month.

### Cited Findings
- whisper-1: $0.006 per minute; gpt-4o-transcribe: $0.006/min; gpt-4o-mini-transcribe: $0.003/min. — [OpenAI API pricing](https://developers.openai.com/api/docs/pricing)
- gpt-4o-mini: input $0.15, cached input $0.075, output $0.60 per 1M tokens. — [OpenAI API pricing](https://developers.openai.com/api/docs/pricing)

### Inferences
- Switching `bot/transcribe.js` from whisper-1 to gpt-4o-mini-transcribe would halve the audio cost. The amount is so small that it does not change the price.

### Gaps
- Not verified whether OpenAI rounds each audio up to a full minute or bills per second. The worked example assumes per second. If it rounds per audio, 50 voice notes would cost 50 × $0.006 = $0.30 instead of $0.10.

## 4. Hosting: Railway and Firebase Blaze

### Takeaway
Railway Hobby costs $5/month with $5 of usage included (Pro $20 with $20 included); a small Node bot fits in roughly $5–10/month. Firebase Blaze has generous free quotas (2M invocations/month, 50K reads/day, 20K writes/day) that one shop does not exhaust. The real fixed cost on Firebase is the `minInstances: 1` on the IVR.

### Cited Findings
- Railway: Hobby "$5/month fee, including $5/month of usage credit"; Pro "$20/month per workspace, including $20/month of usage credit". Usage: memory ≈ $10 per GB RAM/month ($0.00000386/GB/s), CPU ≈ $20 per vCPU/month, volumes $0.15/GB/month, egress $0.05/GB. — [Railway pricing](https://railway.com/pricing)
- Firebase Blaze free quotas: Firestore 1 GiB storage, 50K reads/day, 20K writes/day, 20K deletes/day, 10 GiB/month egress. Cloud Functions: 2M invocations/month free (then $0.40/million), 400K GB-s, 200K CPU-s, 5 GB egress (then $0.12/GB). Hosting: 10 GB storage and 360 MB/day of transfer free (then $0.026/GB and $0.15/GB). — [Firebase pricing](https://firebase.google.com/pricing)
- Project records: `minInstances: 1` on `ivrIncomingCall` was estimated at "~$2/month". — `/home/user/whatapp/CLAUDE.md` (internal estimate, not checked against an invoice)

### Inferences
- In the multi-tenant model, the Cloud API bot (webhook) is a single Node service shared by every shop. Railway's cost (~$5–20/month) is split across shops and tends toward cents per shop. Baileys instead needs one socket per number, which raises RAM per shop.
- One shop with 400 appointments/month generates far fewer Firestore reads and writes than the daily free quota. In practice, Firebase cost per shop ≈ $0 apart from `minInstances`.

### Gaps
- Firestore per-operation prices in `me-west1` above the free quota were not looked up (the Firebase page links to Google Cloud pricing without the figures). They are only relevant with dozens of shops.
- Railway's real invoice for the current bot was not checked.

## 5. Worked example: barbershop with 400 appointments/month (variable cost per country)

### Takeaway
Under the rules in force since 2026-10-01, the WhatsApp cost of 1,200 utility templates (1 confirmation + 2 reminders × 400) is **$6.36 in Israel, $13.56 in Venezuela and $24.00 in Spain**, and **the "50% inside the window" no longer saves anything**. If the bot's conversational replies (~6 per booking) exceed the 1,000 free service messages, add $7.42 IL / $15.82 VE / $28.00 ES. Total monthly variable cost per shop ≈ **$10–21 in Israel (with IVR), $14–30 in Venezuela, $24–52 in Spain** (without IVR in VE/ES).

### Cited Findings
- Rates used: WhatsApp from section 1 ([Formbeep](https://formbeep.com/whatsapp-api-pricing/), [Voltade](https://voltade.com/resources/guides/whatsapp/whatsapp-business-api-pricing), rules from [Meta](https://developers.facebook.com/docs/whatsapp/pricing/updates-to-pricing)); Telnyx from section 2 ([numbers IL](https://telnyx.com/api/pricing/numbers?country=il), [SIP IL](https://telnyx.com/api/pricing/elastic-sip?country=il), [Voice API](https://telnyx.com/pricing/voice-api)); OpenAI from section 3 ([OpenAI](https://developers.openai.com/api/docs/pricing)).

### Inferences (calculations; assumptions stated)
Assumptions: 400 bookings → 400 confirmations + 800 reminders (24h and 2h) = 1,200 utility messages. 60 calls × 2 min = 120 inbound minutes. 50 voice notes × 20 s = 16.7 min. ~400 NLU calls of ~600 input and ~60 output tokens. Scenario B adds ~6 bot replies per booking = 2,400 service messages (1,000 free → 1,400 charged).

**WhatsApp (Meta)**

| Item | Israel | Venezuela (RoLatAm) | Spain |
|---|---|---|---|
| 1,200 utility (all charged since 2026-10-01) | 1,200×0.0053 = **$6.36** | 1,200×0.0113 = **$13.56** | 1,200×0.0200 = **$24.00** |
| *Reference: before 2026-10-01, 50% free in window (600 charged)* | *$3.18* | *$6.78* | *$12.00* |
| Scenario B: +1,400 service above the free tier | +$7.42 | +$15.82 | +$28.00 |
| Optional: 30-min reminder (+400 utility) | +$2.12 | +$4.52 | +$8.00 |
| Optional: 100 "come back"/promo messages (marketing) | +$3.53 | +$7.40 | +$7.07 |

- "Optimizing" by sending the confirmation and in-window reminders as free-form text: 400 templates + 3,200 service (2,200 charged) = Israel $2.12 + $11.66 = $13.78, **exactly the same** as the unoptimized version (scenario B: $6.36 + $7.42 = $13.78), because service = utility in price. It only saves if total service messages stay ≤ 1,000/month.

**Israeli IVR (Telnyx)**
- Number: $3.00/month (real charge, per project records; list "from $3").
- 120 inbound min × ($0.005 + $0.002) = **$0.84**.
- Hebrew TTS: $0 to ~$2.88 (60 calls × ~1,000 characters × $0.000048, an unconfirmed ceiling).
- Transfers to the barber (assumed 6 calls × 1 min): 6 × $0.039 = $0.23 (+ $0.60 if the $0.10 transfer fee applies).
- Total IVR ≈ **$4.07 – $7.55/month**.

**OpenAI**
- Whisper: 16.7 min × $0.006 = **$0.10**.
- gpt-4o-mini: 240K input × $0.15/1M + 24K output × $0.60/1M = **≈ $0.05**.

**Infrastructure** (per shop, initially): Firebase ≈ $0 within quotas + ~$2 `minInstances` for the IVR (internal estimate). Railway $5–10/month for the whole service, shared across shops.

**Total variable cost per shop / month (excluding shared Railway)**

| | Israel (WA + IVR) | Venezuela (WA only) | Spain (WA only) |
|---|---|---|---|
| A: replies within the 1,000 free | 6.36 + 4.07–7.55 + 0.15 + ~2 (minInst.) ≈ **$12.6 – 16.1** | 13.56 + 0.15 ≈ **$13.7** | 24.00 + 0.15 ≈ **$24.2** |
| B: +1,400 service charged | ≈ **$20.0 – 23.5** | ≈ **$29.5** | ≈ **$52.2** |
| If an IVR is added in that country | (included) | +$12 number + 120×$0.017 = +$14.0 + TTS | +$1–1.50 number + 120×$0.002 ≈ +$1.7 + TTS |

- Minimum viable price (inference): to keep a ~70% gross margin on these variable costs, price ≥ cost / 0.3. That gives roughly **Israel ≥ $45–80**, **Venezuela ≥ $45–100**, **Spain ≥ $80–175** per month at this volume (400 bookings). For shops with fewer bookings (e.g. 150/month), WhatsApp cost scales roughly linearly and service replies would probably fit inside the free 1,000.
- The variable that matters most is **how many bot messages each booking generates**: every extra reply above the free 1,000 costs the same as a utility template. Cutting conversational steps (NLU that resolves day and time in a single message) saves money directly.
- A local IVR in Venezuela is expensive relative to the market ($12/month just for the number, plus $0.015/min). In Spain it is very cheap.

### Gaps
- The real number of bot messages per booking (scenario B assumes 6) was not measured. It could be counted from Firestore (`waConversations`) or from the Cloud API webhooks (`pricing.category` field).
- Payment processing fees (Tranzila/Stripe/Pago Móvil), taxes, support and acquisition costs are not included.
- The TTS cost of the Azure Hebrew voice and the TeXML transfer fee remain unconfirmed (see section 2).
