# Mexico — country profile for an AI appointment-booking SaaS (WhatsApp bot + IVR + web panel)

Exchange rate used for conversions: **~17.5 MXN = 1 USD** (Banxico FIX 14 Jul 2026 = 17.5023; Jun 2026 range 17.29–17.62) — [N+ / nmas.com.mx, 14 Jul 2026](https://www.nmas.com.mx/economia/dolar/precio-del-dolar-hoy-martes-14-de-julio-de-2026-como-esta-el-tipo-de-cambio-con-el-peso/); [La Opinión, 25 Jun 2026](https://laopinion.com/?p=4141517). No October 2026 FIX was found; treat USD figures as approximate.

## 1. How many target establishments exist (INEGI DENUE / Censos Económicos)?

### Takeaway
Mexico has roughly **470,000 formal establishments** in the core categories (beauty/hair ~310k, medical offices ~86k, dental offices ~76k per DENUE May 2026), almost all micro (0–10 employees). That is a very large addressable base, about 10x Israel's. But it is dominated by tiny, mostly informal businesses with low wages.

### Cited Findings
- **Beauty/hair (SCIAN rama 8121, "Salones y clínicas de belleza, baños públicos y bolerías"):** 310,869 economic units in DENUE May 2026. Top states: Estado de México 47,105; CDMX 25,295; Jalisco 24,818 — [DataMéxico / Secretaría de Economía, rama 8121](https://www.economia.gob.mx/es/profile/industry/8121)
- Size distribution, rama 8121 (DENUE May 2026): 0–10 employees 310,161; 11–50: 691; 51–100: 10; >100: 7. So **99.8% are micro** — [DataMéxico 8121](https://www.economia.gob.mx/es/profile/industry/8121)
- Rama 8121 employment (ENOE 2026-T1): 2.31 million people, 71.5% women. Average monthly wage MXN 6,480 (~US$370). **82.1% informal workers** (avg MXN 5,980), 17.9% formal (avg MXN 8,780) — [DataMéxico 8121](https://www.economia.gob.mx/es/profile/industry/8121)
- Rama 8121 gross production in Censo Económico 2019: MXN 36,097 million (~US$2.1 bn) — [DataMéxico 8121](https://www.economia.gob.mx/es/profile/industry/8121)
- Growth: a third-party data vendor says the count was 236,378 "two years ago", vs 310,869 now (unverified) — [scrap.io](https://scrap.io/es/base-de-datos-peluquerias-mexico). Older Censo counts (216,466 in 2019 vs 476,517 in 2014) are not comparable because of method changes — [DataMéxico 8121](https://www.economia.gob.mx/es/profile/industry/8121)
- **Medical offices (rama 6211, Consultorios médicos):** 85,908 units in DENUE May 2026. 0–10 employees 81,721; 11–50: 4,152; 51–100: 21; >100: 14. Top states: Edomex 7,266; CDMX 6,736; Jalisco 5,431. Sector employment 1.42 M (2026-T1), average wage MXN 8,790 — [DataMéxico rama 6211](https://www.economia.gob.mx/es/profile/industry/6211)
- **Dental offices (rama 6212):** 76,188 units in DENUE May 2026. Top states: Edomex 10,164; CDMX 7,467; Jalisco 4,794 — [DataMéxico rama 6212](https://www.economia.gob.mx/es/profile/industry/6212) (via search summary). A vendor citing DENUE May 2025 gives ~73,635 dental offices with 0–10 employees — [scrap.io dentists](https://scrap.io/es/base-de-datos-dentistas-mexico)
- Total DENUE 05/2026: 6,138,075 establishments nationwide. Next DENUE update is scheduled for 25 Nov 2026 — [INEGI DENUE 2026/05 press release](https://www.inegi.org.mx/contenidos/saladeprensa/boletines/2026/denue/DENUE2026_05.pdf)
- **Pharmacy-adjacent clinics (consultorios adyacentes a farmacias, CAF):** estimates vary widely: ~81,945 (DENUE 2024-based estimate); ~18,000 (NielsenIQ via El Financiero); 78,000 (Cofepris 2022, of which ~32,000 estimated illegal). Consultation price is MXN 30–60 — [search compilation: mexicobusiness.news](https://mexicobusiness.news/health/news/mexicos-pharmacy-clinics-evolve-primary-care-and-drive-growth); [Publimetro 2025](https://www.publimetro.com.mx/nacional/2025/07/29/consultorios-de-farmacia-cuales-nuevos-servicios-ofrecen-y-la-diferencia-con-hospitales/)
- Mexico has about 270,000 physicians, citing INEGI (Doctoralia interview, date unclear) — [DPL News](https://dplnews.com/mexico-crecen-consultas-por-internet-falta-regular-las-recetas/)

### Inferences
- Core TAM ≈ 310,869 + 85,908 + 76,188 ≈ **473,000 formal units**. Rama 8121 also includes public baths and shoe-shine stands, but salons and barbershops (SCIAN 812110) almost certainly make up most of it.
- A meaningful share of rama 6211 is probably pharmacy-adjacent clinics (Dr. Simi/Similares etc.). These are chain-run walk-in businesses that do not book appointments, so they are **not a real target**. The realistic medical target is probably more like 40–60k independent private offices (rough inference, not sourced).
- Salon owners' purchasing power is low: average staff wage is ~US$370/month and 82% of workers are informal. Price sensitivity will be very high in the mass segment. The viable segment is the upper tier (Polanco, San Pedro Garza García, Guadalajara, Monterrey, Querétaro) and dental/medical offices.

### Gaps
- No DENUE count isolated for SCIAN 812110 alone (vs. the full rama 8121); the DataMéxico page does not break it out. Could be obtained from the DENUE download filtered by code 812110.
- No separate count for nail salons / barbershops (both fall inside 812110).
- Censos Económicos 2024 definitive national tables were not retrieved (see section 3).

## 2. WhatsApp penetration, WhatsApp Business among SMBs, and how bookings are taken today

### Takeaway
WhatsApp is close to universal in Mexico (~90–96% of internet users; ~105–110 M internet users), and Meta claims 92% of MSMEs use WhatsApp Business. Bookings are taken mainly by WhatsApp chat and phone, handled by hand. That is a perfect fit for a WhatsApp-native bot. I found no independent survey measuring this.

### Cited Findings
- ENDUTIH 2025 (INEGI): **104.9 million internet users = 86.1% of population aged 6+** (up from 83.1% in 2024) — [INEGI ENDUTIH 2025 presentation](https://www.inegi.org.mx/contenidos/programas/endutih/2025/doc/presentacion_endutih2025.pdf); [Yucatán (Jun 2026)](https://www.yucatan.com.mx/mexico/2026/06/16/mexico-alcanza-86-1-de-usuarios-de-internet-suma-43-millones-en-una-decada-inegi.html)
- ENDUTIH 2025: **instant messaging is the #1 use of mobile internet (90.6%)**, ahead of social networks (80.4%) — [Uno TV](https://www.unotv.com/ciencia-y-tecnologia/quienes-utilizan-mas-internet-en-mexico-inegi-responde/). DPL News reports 93% "communicate via internet" — [DPL News](https://dplnews.com/endutih-2025-mexico-mas-conectado-pero-todavia-desigual/)
- DataReportal Digital 2026 Mexico (Oct 2025 data): population 132 M; 110 M internet users (83.5%); 145 M mobile connections (110%); 99.0 M social media identities (74.9%). The report page gives no WhatsApp figure (Meta does not sell WhatsApp ads) — [DataReportal Digital 2026: Mexico](https://datareportal.com/reports/digital-2026-mexico)
- Asociación de Internet MX, 2024 study (20th edition): 101.9 M internet users. **WhatsApp is the most-used platform at 96% of internet users**, ahead of Facebook 86% and Instagram 81%. The 2023 edition gave 95.9% — [LOS40 summary of AIMX 2024](https://los40.com.mx/2024/05/17/asi-navegan-por-internet-los-mexicanos/) (AIMX notes these are not official statistics)
- Third-party estimates: ~69.7 M WhatsApp users — [Timelines.ai](https://timelines.ai/whatsapp-stats); ~75% population penetration — [Infobip](https://infobip.com/blog/whatsapp-statistics) (unverified aggregators)
- **Meta (Feb 2025, FinTech Mexico Festival): 92% of Mexican MSMEs use WhatsApp Business**, and 88% say it generated new business opportunities. This is Meta's own claim; no methodology was published — [Mobile Time, 28 Feb 2025](https://mobiletime.la/noticias/28/02/2025/whatsapp-business-pymes-mexico/)
- Older study, "El impacto económico de WhatsApp en México" (year unclear, pre-2025): 1 in 3 SMEs said they developed their business on WhatsApp; 57% reported higher sales — [Milenio](https://www.milenio.com/negocios/whatsapp-business-eleva-ventas-57-pymes)
- Booking practice (vendor material only): AgendaPro describes the traditional model of booking only by phone or in a paper notebook, now shifting to WhatsApp and online booking — [AgendaPro blog](https://agendapro.com/blog/whatsapp-como-motor-de-ventas/)
- El Contribuyente (May 2026): salons in CDMX, Guadalajara and Monterrey complain about **15–20% commissions** charged by Fresha/Booksy marketplaces, and are moving to direct booking. It claims 60–70% of marketplace bookings come from repeat clients; no source is cited — [El Contribuyente, May 2026](https://www.elcontribuyente.mx/2026/05/peluquerias-en-mexico-eliminan-comisiones-con-reserva-directa/)

### Inferences
- WhatsApp is the default channel, so a booking bot that lives *inside* WhatsApp has less adoption friction in Mexico than an app or a web booking page. That is the product's core advantage here.
- The phone IVR is a weaker differentiator in Mexico than in Israel. The "kosher phone" use case does not exist, and WhatsApp already covers nearly everyone. IVR would mainly appeal to medical offices serving older patients.
- Unofficial WhatsApp libraries (Baileys) carry ban risk. In a market where the business's WhatsApp number *is* its storefront, a ban would be catastrophic for the client. That reinforces the planned move to the official Cloud API before scaling.

### Gaps
- No independent (non-Meta, non-vendor) survey of how Mexican salons or clinics take bookings (phone vs WhatsApp vs app vs walk-in).
- The AIMX 2025 edition figures were not found; latest verified is 2024.
- No data was collected on WhatsApp Business Platform (Cloud API) per-message pricing for Mexico. Check Meta's rate card.

## 3. SMB digitalization, software adoption, willingness to pay, and typical service prices

### Takeaway
Digital maturity among Mexican micro-businesses is low. Only ~21–39% of economic units used internet for their activities (Censos Económicos 2024 preliminary, state level), and only ~15% of SMEs have an effective digital strategy. Willingness to pay is constrained: haircuts cost MXN 100–530 (US$6–30) and incumbent booking software starts at ~MXN 299/month (~US$17).

### Cited Findings
- Censos Económicos 2024 measured digital technology use by economic units for the first time. Preliminary results (Jan 2025): Hidalgo **25.4%** of units used internet for their activities; Morelos **21.5%**; Guanajuato 25.2%, Durango 35.8% and Sonora 39.2% used some digital technology (the excerpt is truncated) — [INEGI CE 2024 Hidalgo](https://www.inegi.org.mx/contenidos/saladeprensa/boletines/2025/ce/CE2024_RO_HG.pdf); [INEGI CE 2024 Morelos](https://www.inegi.org.mx/contenidos/saladeprensa/boletines/2025/ce/CE_2024_RO_Mor.pdf); [INEGI CE 2024 Sonora](https://www.inegi.org.mx/contenidos/saladeprensa/boletines/2025/ce/CE_2024_RO_Son.pdf). These figures cover all sectors, not salons specifically.
- Concanaco Servytur diagnostic (2024): only ~15% of SMEs run an effective digital strategy; 10% don't use online banking; 20% don't use digital platforms to know their customers — [Forbes México](https://www.forbes.com.mx/solo-15-de-las-pymes-tienen-una-estrategia-digital-efectiva-concanaco-servytur/)
- Concanaco Servytur 6th SME Digitalization Study (2026): the incentives most valued for trying a digital solution are **training (39.61%)** and **personalized hand-holding (34.85%)** — [Líder Empresarial](https://www.liderempresarial.com/capacitacion-y-acompanamiento-los-incentivos-que-mas-valoran-las-pymes-en-mexico-para-digitalizar-sus-operaciones/amp/)
- Vendor claim (Zafiro Software, 2026): only ~30% of >5 M SMEs are migrating to digitalization (unverified) — [The Logistics World](https://thelogisticsworld.com/historico/necesario-que-pymes-migren-hacia-facturacion-electronica)
- INEGI: >4.1 M SMEs in Mexico, 97.6% of them micro — [Mobile Time](https://mobiletime.la/noticias/28/02/2025/whatsapp-business-pymes-mexico/)
- **Haircut prices (barbershops, Profeco Revista del Consumidor, via DeDinero, 10 Jun 2025):** premium areas (Polanco CDMX, San Pedro Garza García NL) MXN 380–530 (~US$22–30), including wash/massage; accessible areas (Coacalco Edomex, Puebla) from MXN 100 (~US$6); Puebla barbershop MXN 200; NL packages up to MXN 800 (~US$46) — [DeDinero / El Universal](https://www.dedinero.com.mx/gasto/cuanto-cuesta-un-corte-en-una-barberia-lista-de-precios-en-revista-del-consumidor-de-profeco/)
- A CDMX salon example lists a haircut with "visagismo" at MXN 350 (~US$20) — [cal.com listing](https://cal.com/oscars-prive-mcvsbk). "Organic" salon haircuts in CDMX are MXN 700–1,400 per a services marketplace (commercial estimate) — [Cronoshare](https://www.cronoshare.com.mx/cuanto-cuesta/peluqueria-organica)
- **Medical consultation:** pharmacy-adjacent clinics charge MXN 30–60 (~US$2–3.4), sometimes 40. Typical private GP is ~MXN 500 (~US$29), per a doctor quoted. ENSANUT 2021 median spend per consultation was MXN 450 (~US$26) (older data, 2021) — [vLex](https://vlex.com.mx/vid/consultorios-farmacias-gran-negocio-909957631); [Informabtl citing ENSANUT 2021](https://www.informabtl.com/lista-de-felicitaciones-para-un-medico-de-farmacias-similares-por-el-dia-del-medico-2025/)
- Incumbent booking-software pricing reference: AgendaPro Mexico Basic **MXN 299/month (~US$17)**, Premium **MXN 1,500/month (~US$86)** (vendor blog, Oct 2025) — [AgendaPro vs Booksy](https://agendapro.com/blog/agendapro-vs-booksy/)

### Inferences
- At a MXN 200 haircut, a MXN 299–600/month subscription equals about 1.5–3 haircuts a month. That is affordable for a salon doing >10 cuts/day, if the bot demonstrably saves time or no-shows. Price needs to sit in the ~MXN 300–700 (US$17–40) band for salons. Dental and medical offices (MXN 450–1,000+ per consult) can bear more.
- The Concanaco finding that training and hand-holding are the top adoption incentives suggests self-serve signup alone will convert poorly. Onboarding support in Spanish (WhatsApp-based support) is likely needed.
- The low internet-use rate among all economic units (~21–39%) is a headwind for the mass market. The near-universal personal WhatsApp use of owners partly offsets it.

### Gaps
- No Mexico-specific survey on SaaS adoption or willingness to pay among salons/clinics was found (ENAPROCE / Censos 2024 definitive digital tables not retrieved).
- No reliable manicure/nail price data was found (search returned nothing citable).
- No data on salon/clinic average monthly revenue beyond the 2019 Censo aggregate.

## 4. Payments and tax: collecting subscriptions, CFDI, and VAT on foreign digital services

### Takeaway
Collecting card subscriptions is workable (Stripe Billing and Mercado Pago Suscripciones both exist in Mexico). But only ~68% of adults hold a debit/credit card, and cash or transfer methods (OXXO, SPEI) are not natively recurring. Tax: a foreign SaaS provider without a Mexican establishment selling to Mexican businesses must register with SAT (RFC) under the digital-services regime (LIVA Arts. 18-B to 18-M), charge **16% IVA** and file monthly. Otherwise card intermediaries withhold IVA, or the Mexican customer self-assesses it as an import of services. Business customers will strongly want a **CFDI** for deductibility, which pushes toward a Mexican entity or reseller.

### Cited Findings
**Payments**
- Stripe Mexico (pricing page): domestic cards **3.6% + MXN 3.00**; international cards +0.5%; currency conversion +2%; "other local methods" (bank transfer, likely OXXO/SPEI) 4% + MXN 3.00; **Stripe Billing 0.7% of billing volume**; Invoicing 0.4%; meses sin intereses from 5% (3 months); fees exclude IVA — [Stripe MX pricing](https://stripe.com/mx/pricing)
- Stripe OXXO: available to Mexico accounts. It uses cash vouchers that expire after 5 days by default (configurable 1–7 days), documented as one-off PaymentIntents, not subscriptions — [Stripe OXXO docs](https://docs.stripe.com/payments/oxxo.md)
- Stripe launched in Mexico with Billing for subscriptions — [Stripe newsroom](https://stripe.com/newsroom/news/stripe-launches-mexico)
- Mercado Pago Mexico Suscripciones: create a plan (name, amount, frequency) and share a link by WhatsApp. It charges credit or debit cards or account balance, and the payer needs no MP account — [Mercado Pago blog](https://www.mercadopago.com.mx/blog/como-recibir-pagos-recurrentes); [MP Suscripciones](https://www.mercadopago.com.mx/herramientas-para-vender/suscripciones). A third-party calculator gives 3.49% + MXN 4 + IVA for immediate availability (payment link, 2026, unofficial) — [calcforlife](https://calcforlife.com/?p=3417)
- Card commissions in Mexico run 3–4%. Bank direct debit (domiciliación) costs ~0.3% per a fintech founder whose company sells direct debit, so the claim is biased — [Emprendedor.com column (2026)](https://emprendedor.com/suscripciones-mexico-problema-cobro-pagos-recurrentes/)
- ENIF 2024 (INEGI/CNBV): **68.2% of adults 18–70 have an account with at least one debit or credit card** (55.3% in 2018); 63% have a formal savings account; 37.3% have formal credit — [BBVA Research citing ENIF](https://www.bbvaresearch.com/publicaciones/mexico-tenencia-de-tarjetas-una-aproximacion-anual-a-partir-de-la-endutih/); [El Imparcial](https://www.elimparcial.com/dinero/2025/03/23/aumentan-en-mexico-los-pagos-con-tarjeta-y-transferencias-enif-2024/)

**Tax (IVA / CFDI)**
- Since June 2020, foreign residents without a permanent establishment who provide digital services to recipients in Mexico must: register in the RFC; charge 16% IVA separately; give the recipient a payment receipt showing the IVA; file monthly by the 17th of the following month; and report operations quarterly. This is per Criterio normativo 4/IVA/N, which cites RMF 2026 rules 12.1.1–12.1.12 — [SDV summary of 4/IVA/N](https://sdv.com.mx/compendio/criterios-normativos-sat/criterio-4-iva-n/)
- Covered digital services (Art. 18-B LIVA) include: download of or access to images, text, **information**, video, audio, games and other multimedia; intermediation between buyers and sellers; online clubs/dating; and distance learning — [Kintsugi Mexico VAT guide 2026](https://trykintsugi.com/es-419/sales-tax-guides/latam/mexico); [SDV](https://sdv.com.mx/compendio/criterios-normativos-sat/criterio-4-iva-n/). Kintsugi states SaaS is taxable at 16% — [Kintsugi](https://trykintsugi.com/es-419/sales-tax-guides/latam/mexico). SDV's summary does not explicitly mention SaaS.
- If the foreign provider is not registered, banks and payment platforms involved in the charge must withhold the 16% IVA — [SDV](https://sdv.com.mx/compendio/criterios-normativos-sat/criterio-4-iva-n/). Per IDC, services from unlisted providers are treated as an import of services, and the IVA must be paid by the recipient — [IDC (2020)](https://idconline.mx/fiscal-contable/2020/11/17/sat-actualiza-listado-de-prestadores-de-servicios-digitales); [IDC "IVA virtual en la importación de servicios" (2020)](https://idconline.mx/fiscal-contable/2020/07/10/iva-virtual-en-la-importacion-de-servicios)
- SAT publishes a list of registered foreign digital-service providers (updated bimonthly; latest annex May 2026) — [IMCP, Anexo 1 DOF listado servicios digitales (May 2026)](https://imcp.org.mx/wp-content/uploads/2026/05/Anexo-1-DOF_Listado_Serv-Dig-Noticia-104.pdf); [IMCP 2020 note](https://imcp.org.mx/noticias-fiscales-2020-151-shcp-oficio-mediante-el-cual-se-da-a-conocer-listado-de-prestadores-de-servicios-digitales-inscritos-en-el-rfc-en-terminos-del-articulo-18-d-fraccion-i-de-la-liva)
- On CFDI: SDV's summary of the criterion requires only a "comprobante de pago que incluya el IVA" from the foreign provider. It warns that Mexican recipients may lack a CFDI to credit the IVA, and recommends keeping the provider's RFC certificate and receipts — [SDV](https://sdv.com.mx/compendio/criterios-normativos-sat/criterio-4-iva-n/). A 2020 ECIJA memo lists issuing CFDIs among the obligations, so the sources conflict — [ECIJA (2020)](https://ecija.com/wp-content/uploads/2020/05/ECIJA-México_Impuesto-Servicios-Digitales.pdf)

### Inferences
- **Practical setup options:** (a) a foreign entity registers in the RFC as a digital-service provider, charges 16% IVA and issues non-CFDI receipts. This is legal, but Mexican business customers can't easily credit the IVA or deduct the expense, which hurts B2B sales. (b) Incorporate a Mexican entity (S. de R.L./S.A.S.) or use a local reseller/merchant-of-record, issue real CFDI 4.0, and use Stripe MX / Mercado Pago with a Mexican bank account. Option (b) is what serious B2B SaaS in Mexico do. For a Phase-1 launch, a merchant-of-record (e.g., Paddle/Lemon Squeezy-type) could bridge, but CFDI issuance by such MoRs should be verified.
- Stripe MX and Mercado Pago both require a Mexican legal entity/account to onboard as a merchant (general knowledge, not verified in this research). A non-Mexican company could instead bill Mexican cards through Stripe in another country, paying the +0.5% international card fee and +2% FX fee.
- About a third of adults have no card, so subscriptions should support card-on-file *plus* a fallback (OXXO/SPEI invoices each month, or annual prepay). Expect higher churn from failed payments than in Israel.

### Gaps
- Could not confirm from a primary SAT source whether B2B SaaS (a booking tool) falls clearly under Art. 18-B fracción I or under general "importación de servicios". Needs a Mexican tax advisor.
- Did not verify whether foreign registered providers can or must issue CFDI (sources conflict), nor ISR deductibility rules for payments to foreign SaaS without a CFDI.
- Official Mercado Pago subscription fee and Conekta pricing not retrieved. Whether Stripe Billing can collect recurring payments by SPEI/OXXO automatically is unconfirmed.

## 5. Data protection law (new LFPDPPP 2025) and health data

### Takeaway
A **new LFPDPPP was published in the DOF on 20 Mar 2025 (in force 21 Mar 2025)**, replacing the 2010 law. The regulator is now the Secretaría Anticorrupción y Buen Gobierno (INAI was abolished). The framework is largely continuous. A booking SaaS is a processor (encargado) for the salon or clinic. Health data is explicitly "sensitive" and requires **express (written) consent**, which matters for medical and dental clients.

### Cited Findings
- New LFPDPPP published in DOF 20 Mar 2025, in force 21 Mar 2025. The Secretaría de Anticorrupción y Buen Gobierno replaces INAI as regulator — [Garrigues](https://www.garrigues.com/es_ES/noticia/mexico-nueva-ley-federal-proteccion-datos-personales-posesion-particulares-introduce); [GT Law (Mar 2025)](https://www.gtlaw.com/es/insights/2025/3/nueva-ley-general-proteccion-de-datos); [EY Law Flash](https://www.ey.com/content/dam/ey-unified-site/ey-com/es-mx/technical/tax/documents/ey-law-flash-nueva-lfpdppp.pdf)
- Consent may be express or tacit. Tacit consent is valid when the privacy notice was made available and the person did not object, unless the law requires express consent — [Garrigues](https://www.garrigues.com/es_ES/noticia/mexico-nueva-ley-federal-proteccion-datos-personales-posesion-particulares-introduce). Consent must be free, specific and informed — [GT Law](https://www.gtlaw.com/es/insights/2025/3/nueva-ley-general-proteccion-de-datos)
- Sensitive data explicitly includes **present or future health status**, genetic data, ethnic origin, beliefs and sexual preference — [Garrigues](https://www.garrigues.com/es_ES/noticia/mexico-nueva-ley-federal-proteccion-datos-personales-posesion-particulares-introduce); [Basham](https://basham.com.mx/nueva-ley-federal-de-proteccion-de-datos-personales-en-posesion-de-los-particulares/). Sensitive data requires **express and written consent** — [Usercentrics](https://usercentrics.com/es/knowledge-hub/lfpdppp-mexico/)
- Privacy notice (aviso de privacidad) must list the data processed, flagging sensitive data, and the purposes, distinguishing those needing consent. Electronic collection requires a simplified notice linking to the full one — [Garrigues](https://www.garrigues.com/es_ES/noticia/mexico-nueva-ley-federal-proteccion-datos-personales-posesion-particulares-introduce)
- ARCO rights (access, rectification, cancellation, opposition): 20 business days to respond plus 15 to execute. Fines up to 320,000 UMA, doubled for sensitive data (secondary source) — [Usercentrics](https://usercentrics.com/es/knowledge-hub/lfpdppp-mexico/). The sanction unit changed from minimum wage to UMA; the defense route is now amparo before specialized courts — [Garrigues](https://www.garrigues.com/es_ES/noticia/mexico-nueva-ley-federal-proteccion-datos-personales-posesion-particulares-introduce)
- The definition of personal data is no longer limited to natural persons — [Littler](https://www.littler.com/es/news-analysis/asap/mexico-tiene-nueva-ley-en-materia-de-proteccion-de-datos-personales)

### Inferences
- For salons, compliance is light: a Spanish aviso de privacidad (including a WhatsApp-delivered simplified notice at the first bot interaction), ARCO handling, and a processor agreement with each salon.
- For medical and dental offices, the bot should avoid collecting the reason for the visit or symptoms unless express consent is captured. Storing clinical records would also trigger health-sector norms (e.g., NOM-004-SSA3 clinical record, NOM-024-SSA3 health information systems). This was not verified in this research; flag it for legal review.
- Since the regulator moved to an executive-branch ministry, enforcement intensity after 2025 is uncertain.

### Gaps
- New implementing regulations (Reglamento) status and transition deadlines not found.
- Rules on processors/cloud and international transfers (data hosted in us-central1 or me-west1) under the 2025 law were not detailed in the sources retrieved.
- Health-sector NOMs (NOM-024, NOM-004) applicability to a pure scheduling tool not verified.

## 6. Local players already strong in Mexico (names and position only)

### Takeaway
The market is contested. **Doctoralia** dominates medical booking (330k+ specialists, 23M appointments/year). **AgendaPro** (claims 8,000+ Mexican salons/spas), **Booksy** (absorbed Versum) and **Fresha** lead in beauty. Marketplace commissions of 15–20% create resentment that a direct-WhatsApp tool can exploit.

### Cited Findings
- **Doctoralia Mexico (Oct 2025):** >330,000 specialists and >23 million appointments per year (self-reported). Earlier: >185k doctors registered of ~270k in the country, 12 M appointments in the prior year; record 1.7 M appointments in Jan 2024 — [Publimetro, 23 Oct 2025](https://www.publimetro.com.mx/queretaro/2025/10/23/reconocen-a-medicas-y-medicos-por-su-contribucion-al-sistema-de-salud-mexicano/); [DPL News](https://dplnews.com/mexico-crecen-consultas-por-internet-falta-regular-las-recetas/); [descubre.vc (Sep 2024)](https://www.descubre.vc/noticia/doctoralia-celebra-7-a-os-en-m-xico-con-un-r-cord-de-citas-agendadas-2024-09-23)
- **AgendaPro:** claims >8,000 salons and spas in Mexico and >2.5 M appointments processed per month (self-reported). It describes itself and Booksy (formerly Versum) as among the best-known platforms in Mexico (vendor blog, Oct 2025) — [AgendaPro landing](https://agendapro.com/lp/crea-tu-cuenta-post); [AgendaPro vs Booksy](https://agendapro.com/blog/agendapro-vs-booksy/). It already markets WhatsApp reminders — [AgendaPro salon software MX](https://agendapro.com/mx/salon-de-belleza/software-para-salon-de-belleza)
- **Fresha:** >450,000 professionals globally (not Mexico-specific), 4.8/5 on Capterra — [Capterra](https://www.capterra.es/alternatives/218709/agendapro)
- **Booksy / Fresha marketplace commissions of 15–20%** cause complaints among CDMX/Guadalajara/Monterrey salons (unsourced claim) — [El Contribuyente, May 2026](https://www.elcontribuyente.mx/2026/05/peluquerias-en-mexico-eliminan-comisiones-con-reserva-directa/)
- Others seen in passing: cal.com used by individual salons — [cal.com example](https://cal.com/oscars-prive-mcvsbk); WhatsApp-booking tools such as SchedulingKit and Trengo marketing in Spanish — [SchedulingKit](https://schedulingkit.com/es/whatsapp-booking/salons); [Trengo](https://trengo.com/es/blog/salon-booking-software)

### Inferences
- Medical is the hardest segment to enter because of Doctoralia's network effects and patient-facing marketplace. The opening there is "AI receptionist on the doctor's own WhatsApp/phone", which complements Doctoralia rather than replacing it.
- Beauty: AgendaPro and Booksy are web/app-first with WhatsApp *reminders*. A conversational AI bot that *books inside WhatsApp* (text and voice notes) is a plausible differentiator. Incumbents could copy it quickly, though.

### Gaps
- No independent market-share data for Mexico. All player figures are self-reported.
- Local Mexican startups (e.g., WhatsApp-AI receptionist startups) were not identified in this search round.
- Detailed competitor pricing is out of scope (covered by another researcher).

---
### Researcher's overall feasibility read (inference, for the report writer)
- **Strengths:** a huge base (~473k formal units, 3 metros with >25k salons each), near-universal WhatsApp, Spanish already supported by the product, and a weak-currency-adjusted but still meaningful upper segment.
- **Weaknesses:** very low ARPU potential in the mass segment (wages ~US$370/month, haircuts from US$6), high informality, low SMB digital maturity, a strong incumbent in medical (Doctoralia), active beauty incumbents (AgendaPro, Booksy, Fresha), tax/CFDI friction for a foreign seller, ~32% of adults without cards, and Baileys ban risk on business-critical numbers.
- Tentative score: **~6.5/10**. Feasible and large, but it requires a Mexican entity (or MoR) for CFDI, the official WhatsApp API, aggressive pricing (~MXN 300–700/month) and assisted onboarding. The best initial targets are dental offices and upper-tier salons/barbershops in CDMX, Monterrey and Guadalajara.
