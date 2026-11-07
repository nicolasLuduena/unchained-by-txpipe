# Argentina: regulatory timeline, addressable market and a three-scenario projection to 2030

Research for issue #27, feeding #21 (pitch) and extending #24 (`tokenization-markets.md`). Observation date for everything below is 2026-11-07 unless a different retrieval date is stated. Every figure carries its source, its as-of date and its currency. ARS figures are not converted to USD unless the rate, its date and its source are stated on the same line. "Primary" means a regulator, legal text, exchange, depository, industry body or issuer page that was fetched; "secondary" means press or a law-firm note quoting a primary that could not be fetched; "vendor" means a figure a company reports about itself. Measured figures and projections never share a table. A figure that could not be sourced is written as "not found". Every URL is listed in `sources.md` under "Argentina market (issue #27)". The law itself is restated from issue #1 and not re-derived; only the official texts, dates and anything after August 2026 were looked up.

One exchange-rate note used throughout: the CNV's 2025 annual financing report gives every figure in constant December 2025 pesos and in USD at the BCRA Comunicación "A" 3500 rate of 30 December 2025. The report does not print the rate; dividing its own totals (ARS 49,151,763 million / USD 33,679 million) gives an implied ARS 1,459.4 per USD. Where this file quotes a USD figure from that report, it is the CNV's conversion, not ours.

---

## Part 1. Pitch sheet

### Eight numbers that survive "source?"

| # | Number | What it is | Source (as of) |
|---|---|---|---|
| 1 | **12.3 million people, 24.6 million accounts** | Argentines with a comitente account at Caja de Valores, end of May 2026, 55 percent of the economically active population; 1,087,847 accounts active in an average month. BYMA's own site shows 13.93 million "investor accounts" at end of Q2 2026 and its April 2026 shareholder release 26.3 million accounts at December 2025 (different counting bases, see Part 3). | BYMA report via El Cronista 2026-07-02 (secondary); BYMA homepage (primary, Q2 2026); BYMA newsroom 2026-04-10 (primary) |
| 2 | **US$16,295 million in six months** | CEDEAR turnover on BYMA, first half of 2026, measured in MEP dollars, up more than 104 percent on the first half of 2025. More than 1 million comitentes hold CEDEAR positions and 878,000 accounts traded them in the last year. CEDEARs are art. 1 c of Título XXII. | BYMA newsroom 2026-09-02 (primary); BYMA report via El Cronista 2026-07-02 (secondary) |
| 3 | **128 fideicomisos financieros, US$1,990 million; 323 obligaciones negociables, US$17,748 million** | The 2025 primary issuance of the two asset classes Título XXII art. 1 b and d make tokenizable, in constant December 2025 pesos converted by the CNV at Com. "A" 3500 of 2025-12-30. FF amount up 71 percent on 2024. Total capital-markets financing 2025: US$33,679 million. | CNV Informe de Financiamiento Anual 2025 (primary, PDF) |
| 4 | **About 20 million; 5 million; 3.3 to 3.5 million** | Investment accounts at Mercado Pago in Argentina (company statement, June 2026); Lemon's total user base across Argentina and Peru with more than 1 million monthly actives (company statement, October 2025); Belo's users (co-founder, June 2026). Lemon (162) and Belo (52) are in the CNV PSAV registry (from #1). | La Nación 2026-06-11 (secondary, company figure); Infobae 2025-10-09 (secondary, company figure); La República 2026-06-22 (secondary, company figure) |
| 5 | **3 issues, US$9.1 million placed, 13 months of sandbox** | Tokenized issues authorized under Título XXII so far: Landtoken I (authorized 2025-08-20, up to US$20 million, placed amount not found), Illa Belgrano I (US$4,150,330, tokenization authorized 2026-04-08), Espacio Añelo (US$4,961,000, tokenization authorized 2026-07-22). Nothing newer found. Sandbox ends 2027-12-31 (RG 1150 art. 38). | PAGBAM deal notices (primary, law firm on the deal); LexLatin (secondary); RG 1150/2026 in the Boletín Oficial (primary) |
| 6 | **6 resoluciones generales in 16 months, and a bill in Congress** | RG 1069 (2025-06-13), 1081 (2025-08-21), 1087 (2025-10-23), 1125 (2026-04-07), 1137 (2026-05-04, consultation), 1150 (2026-06-11), 1172 (2026-10-15, PSAV chapter). On 2026-11-02 the executive sent the Ley de Competitividad Financiera (240 articles) to Diputados; it would make DLT issuance and trading permanent law and create "Otros Ámbitos de Negociación Autorizados" run by PSAVs. Not law. | Boletín Oficial and argentina.gob.ar texts (primary); Infobae 2026-11-03 and DiarioBitcoin 2026-11-04 (secondary) |
| 7 | **81 PSAVs, 34 in all five categories, 1 running a resale venue** | CNV PSAV registry count (from #1; a third-party guide gives 81 as of 2026-10-13). Only PSAVs registered in all categories may participate (art. 14). Volsmart (Vol-Pro S.R.L.) is the only PSAV operating a tokenized-securities venue; BYMA Digital Assets (PSAV 86) runs a title registry, with custody and tokenization "próximamente". | Issue #1; JFC Attorneys guide (secondary, 2026-10-13); bymadigitalassets.com.ar (primary, vendor) |
| 8 | **US$40 million, US$320 million, US$1.3 billion** | Projection, not a measurement: tokenized issuance in Argentina in the year 2030 under the low, base and high scenarios of Part 4 (8, 40 and 130 issues). Cuota's revenue in 2030 under the #1 model (per-issuance fee plus PSAV licence, no trade fee): about US$0.13 million, US$1.1 million and US$4.7 million. | This file, Part 4 and Part 5 (model, every assumption sourced in the table) |

### Two pasteable pitch sentences

1. "Twelve million Argentines already hold an investment account, a million of them hold CEDEARs, and the wallets they use every day, Mercado Pago, Lemon and Belo, count their users in the tens of millions; last year the two asset classes the regime tokenizes first, trust certificates and corporate bonds, raised twenty billion dollars in the primary market, and so far three issues worth nine million dollars have been tokenized, all by one operator, with thirteen months of sandbox left."

2. "Argentina wrote six resoluciones generales in sixteen months and sent a bill to Congress last week to make it permanent; if tokenized issuance only follows Japan's ramp, forty issues a year by 2030, Cuota's fee-and-licence model earns about a million dollars a year without ever touching a trade, and under Brazil's crowdfunding ramp it is closer to five."

---

## Part 2. Regulatory timeline, told as news

Dates are the sanction date and the Boletín Oficial publication date, from the official text where it was fetched. "What it unlocked" is the one-line effect for a slide. Issue dates are from the law firm that acted on the deal (PAGBAM) or press, as marked.

| Date | Item | Official source (status) | What it unlocked |
|---|---|---|---|
| 2025-06-11, BO 2025-06-13 (No. 35687) | **RG 1069/2025** creates Título XXII of the CNV Normas after the RG 1060 consultation. Art. 1: trust securities and closed-fund units backed by real-world assets. Art. 38: a one-year sandbox from entry into force (2025-06-14). | argentina.gob.ar texto original (primary, fetched); Boletín Oficial aviso 326947 (primary, search result) | Tokenized securities became legal for the first time; real-estate and farmland trusts could be sold as tokens through PSAV apps. |
| 2025-08-20, BO 2025-08-21 (No. 35732) | **RG 1081/2025** replaces the whole Capítulo I of Título XXII. Art. 1 adds shares (including dual-listed), obligaciones negociables and CEDEARs. Art. 5 c: registered holders may be PSAVs, AAPIC, custodians or ALyC Integral. Art. 5 e: at most five PSAVs per issue. Art. 38: sandbox "vigente hasta el día 21 de agosto del 2026, inclusive". | argentina.gob.ar norma 416670 (primary, fetched) | Listed instruments became tokenizable and the five-venue, PSAV-only trading structure that Cuota implements was written down. |
| 2025-08-20 | **Landtoken I** authorized by the CNV: tokenized participation certificates of a farmland fideicomiso financiero, up to US$20 million expandable, trustee Allaria Fiduciaria, tokenizer Tech Demeter (Justoken), minimum US$50. Subscription 2025-12-09 to 2025-12-16 (Roadshow). Placed amount: not found. | LexLatin (secondary); Roadshow (secondary) | First issue under the regime, the same day RG 1081 was signed. |
| 2025-10-22, BO 2025-10-23 | **RG 1087/2025** extends the regime to the automatic-authorization regimes of mediano impacto, emisores frecuentes and emisiones frecuentes de fideicomisos financieros; issuers add a tokenization chapter to the prospectus; new art. 40: no listing required when 100 percent of the issue is digital. | argentina.gob.ar news release (primary, fetched); Boletín Oficial DetalleNorma 333326 (primary, search result; text copy at colegio-escribanos.org.ar) | Frequent issuers and routine trust programs could tokenize without a bespoke authorization, and a fully tokenized trust no longer needs an exchange listing. |
| 2025-12-02 | **Illa Belgrano I** fideicomiso financiero inmobiliario issued, US$4,150,330, trustee CFA, placement by Longo Elia Bursátil and DMA Broker, minimum US$100. | PAGBAM via abogados.com.ar (primary, law firm on the deal) | The traditional security that would be tokenized four months later. |
| BO 2026-04-07 | **RG 1125/2026** brings crowdfunding ("Financiamiento Colectivo") into the automatic-authorization regimes (Sección XVI low impact, Sección XVII medium impact), raises the medium-impact cap from 7 million to 15 million UVA, lets registered crowdfunding platforms be the placement channel; art. 148 sets the per-investor caps (3,000 UVA per issue, 10,000 UVA cumulative, 5 and 10 percent of net worth). In force 2026-04-08. | Boletín Oficial aviso 340413 and argentina.gob.ar norma 424560 (primary, search results); abogados.com.ar (secondary) | Small retail offerings with investor caps got a legal lane that RG 1150 would make tokenizable two months later. |
| 2026-04-08 | **Illa Belgrano I tokenization** authorized by RESFC-2026-23510; Vol-Pro S.R.L. (Volsmart) is PSAV, registered holder and DLT entity; issuance document on the AIF 2026-05-20. | PAGBAM (primary, law firm on the deal) | Second tokenized issue; first with a PSAV-run resale venue (inside Volsmart's app and through DMA Broker and Winvest by LEBSA, per iProfesional, secondary). |
| 2026-04-30, BO 2026-05-04 (No. 35901) | **RG 1137/2026** opens an "Elaboración Participativa de Normas" consultation (Decreto 1172/2003) on the draft "Proyecto RG Tokenización - Oferta Automática y Prórroga Sandbox"; 15 business days, closing 2026-05-27 (JFC Attorneys). It is a consultation, not an amendment. | argentina.gob.ar resumen 425458 (primary, fetched); JFC Attorneys (secondary) | Announced the sandbox extension to 2027 and the automatic-regime expansion that RG 1150 enacted. |
| 2026-05-28 | **Espacio Añelo** fideicomiso financiero inmobiliario (Vaca Muerta) issued, US$4,961,000, 100 percent placed, trustee CFA, placement DMA Broker, minimum US$1,000. | PAGBAM (primary, law firm on the deal); Revista Mercado 2026-05-28 (secondary) | Third traditional security headed for tokenization. |
| 2026-06-10, BO 2026-06-11 | **RG 1150/2026** replaces arts. 1, 2, 5, 10, 14, 18, 28, 36, 38 and 39 of Título XXII. Art. 1: shares, ONs, CEDEARs, trust securities and closed-fund units backed by real assets, FCIA ETF units and CEVA ETPs; automatic-authorization regimes qualify for shares, ONs, trust securities and closed-fund units (not FCIA); low-impact issues need a voluntary prospectus; SVS and VS securities excluded. The crowdfunding modality of RG 1125 becomes tokenizable. Art. 38: sandbox "hasta el día 31 de diciembre del 2027, inclusive". Art. 39: the PSAV app is an authorized venue. Minimum dispersion five investors. In force 2026-06-12. | Boletín Oficial aviso 343010 (primary, fetched); argentina.gob.ar norma 426586 (primary, search result) | The sandbox got nineteen more months, every automatic-authorization issue except open funds became tokenizable, and retail crowdfunding issues joined the regime. CNV called it the close of the "Big Bang" regulatory package (El Observador, secondary). |
| 2026-07-22 | **Espacio Añelo tokenization** authorized by RESFC-2026-23599; issuance document on the AIF 2026-07-31; Volsmart as PSAV. | PAGBAM via abogados.com.ar (primary, law firm on the deal) | Third tokenized issue, second on Volsmart's venue. Nothing later was found. |
| 2026-09-02 | BYMA reports CEDEAR turnover of more than US$16,295 million (MEP) in the first half of 2026, up 104 percent, and lists 13 new Comafi CEDEARs. | BYMA newsroom (primary) | Context for the CEDEAR row of the eligible pool; not a tokenization event. |
| 2026-10-14, BO 2026-10-15 (No. 36013) | **RG 1172/2026** replaces Capítulo III of Título XIV (the PSAV chapter that Título XXII art. 14 points to). Natural persons register only above 35,000 UVA per month; minimum net worth US$150,000 for categories 1, 2 and 4 (US$35,000 to US$150,000 across categories per abogados.com.ar); client-asset segregation; mixers banned; monthly report to the CNV through the AIF (clients, volume, assets in custody) enforceable from 2026-11-01; PSAVs may advertise tokenized-securities services within their authorized activities. In force 2026-10-16. | argentina.gob.ar norma 431259 and Boletín Oficial aviso 348986 (primary, search results); Allende & Brea 2026-10-16 and abogados.com.ar (secondary, fetched) | Set the capital and reporting bar that any wallet embedding Cuota must already meet, and gave PSAVs a monthly report that a compliance feed can fill. |
| 2026-10-29 | Argentina Fintech Forum, Buenos Aires. CNV president Roberto Silva spoke of a digital registry that would allow native tokenization of securities and of the omnibus bill modernizing 17 capital-markets laws. No count of tokenization applications was given in anything found. | iProUP (secondary, search snippet; page did not render); Revista Mercado (secondary) | Signals the next step: native issuance on-chain rather than wrappers. |
| 2026-11-02 (Monday, "este lunes" per Infobae 2026-11-03) | **Ley de Competitividad Financiera** sent to Diputados: 240 articles; securities may be issued, held, transferred and traded on DLT without a central depository; CNV has exclusive competence over issuance, registry and trading of tokenized securities; BCRA keeps payments and settlement; "Otros Ámbitos de Negociación Autorizados" may be PSAV-run apps with the same legal standing as authorized markets; open funds may hold virtual assets. A CEDEAR look-through tax clause (from 2026-10-31) was called an old draft and is to be withdrawn. Not law. | Infobae 2026-11-03 (secondary); DiarioBitcoin 2026-11-04 (secondary) | If passed, the sandbox question disappears and the wallet-as-venue model becomes statute. |
| 2027-12-31 | **Sandbox ends** (RG 1150, art. 38). No new tokenization after this date except as art. 17 requires; authorizations unused for two years lapse. | Boletín Oficial aviso 343010 (primary) | Thirteen months from today for new issues unless extended or superseded by the bill. |

Not found: any CNV or government statement giving the number of tokenization applications in the pipeline (searched CNV releases, the Fintech Forum coverage, Ámbito, Cronista, iProUP, Criptonoticias). Also not found: any fourth authorized issue after Espacio Añelo, and Landtoken I's placed amount. The CNV's "Regulatory Developments in Tokenization" coverage (Coinfomania, secondary) carries no numbers.

---

## Part 3. Eligible pool and demand

### 3a. Eligible pool: one row per Título XXII art. 1 asset class (measured)

Flow means primary issuance in the year; stock means outstanding or market value on a date. Each row names its own currency. CNV USD figures are the CNV's own conversion at Com. "A" 3500 of 2025-12-30 (implied ARS 1,459.4 per USD).

| Art. 1 class | Measure | Value | As-of | Source (status) | Notes |
|---|---|---|---|---|---|
| a) Shares | Stock: market capitalization of equities listed on ByMA | ARS 122,758 billion (2026-06-30); ARS 79,973 billion (2025-06-30); 83 listed companies; average daily share volume ARS 103,975 million | 2026-06-30 | Cresud Form 20-F FY2026, "Information regarding the ByMA" (primary, SEC filing, downloaded and grepped) | BYMA's homepage shows "$9.4 B" for domestic listed companies with no currency label or date (primary, vendor). The two are not reconciled here. |
| a) Shares | Flow: equity issuance 2025 | ARS 246,223 million (USD 169 million) | 2025 | CNV Informe de Financiamiento Anual 2025 (primary) | Tiny next to debt. |
| b) Obligaciones negociables | Flow: 2025 issuance | 323 issues, ARS 25,902,092 million (USD 17,748 million); 25 international ONs for USD 9,502 million; 2024: USD 12,479 million, 356 issues | 2025 | CNV Informe de Financiamiento Anual 2025 (primary); La Nación 2026-07-21 for 2024 (secondary, citing BYMA and CNV) | H1 2026: 176 placements for US$8,285 million (BYMA via La Nación, secondary). September 2026 alone US$2,722 million (PwC via MDZ, secondary). Mostly large energy issuers; the tokenizable slice is the SME and medium-impact tail. |
| b) ON, stock | Outstanding stock of ONs | not found | | CNV, BYMA searched | |
| c) CEDEARs | Flow: traded volume H1 2026 | more than US$16,295 million at MEP dollars, up more than 104 percent year on year | 2026-06-30 | BYMA newsroom 2026-09-02 (primary) | CEDEARs were 49 percent of BYMA volume January to May 2026 (BYMA CEO via iProfesional, secondary). |
| c) CEDEARs | Stock: value of CEDEAR holdings | not found | | Caja de Valores and BYMA statistics searched | Proxy: more than 1 million comitentes hold positions (BYMA via El Cronista, secondary). More than 400 CEDEARs available (Caja de Valores, primary). |
| d) Fideicomisos financieros | Flow: 2025 issuance | 128 trusts (+1 percent in count), ARS 2,904,541 million (USD 1,990 million), +71 percent in amount; 2024: USD 987 million (PwC via Infobae) | 2025 | CNV Informe de Financiamiento Anual 2025 (primary); Infobae 2026-02-03 (secondary, PwC) | PwC counts USD 1,944 million at CCL for the same 128 trusts. Most are consumer-credit trusts; the real-asset-backed subset that art. 1 d requires is not broken out anywhere found. |
| d) FF, stock | Outstanding stock of FF | not found | | CNV searched | |
| e) Closed-end funds (FCIC) backed by real assets | Flow: 2025 issuance | two issues (April and October), ARS 28,123 million (USD 19 million) | 2025 | CNV Informe de Financiamiento Anual 2025 (primary) | Examples of real-estate FCICs in the CNV list: Allaria Residencial I (ARS 4,000 million), Puerto Nizuc (VALO, secondary). Patrimonio of the FCIC segment: not found. |
| f) FCIA ETF-type units | Stock | not found as a segment | | CNV, CAFCI | Whole open-fund industry for scale only: ARS 118.86 billion (trillion in English usage), 1,119 funds, 59 managers, close of 2026-11-05 (CAFCI data via fonditos.ar, secondary; CAFCI PDFs returned 403). Open funds themselves are not tokenizable under art. 1; only ETF-type FCIA units are. |
| g) CEVA ETPs | Stock | not found | | | New instrument; nothing measured found. |
| Real-estate crowdfunding and tokenized real-estate platforms | Cumulative | Crowdium: 205,129 registered investors, US$34 million invested, 157 funded properties (undated, vendor site, copyright 2026) | undated | crowdium.com.ar (primary, vendor) | SimpleState, Sumar Inversión, Bricksave, Raíz: no figures found. Count of CNV-registered crowdfunding platforms under RG 1125: not found. Landtoken before the trust: 12,000 registered users, 1,250 investments, US$2.2 million in two years (Roadshow, secondary, 2025). |

Reading the table: the eligible **annual primary flow** that art. 1 a, b, d and e cover was about **USD 19.9 billion in 2025** (ONs 17,748 + FF 1,990 + equity 169 + FCIC 19, CNV figures). That flow, not the ARS 122.8 trillion equity stock or the ARS 118.9 trillion open-fund AUM, is the denominator the model uses, because tokenization is a per-issue decision taken at issuance.

### 3b. Demand: investor accounts and PSAV users (measured)

| Who | Number | As-of | Source (status) | Notes |
|---|---|---|---|---|
| Persons with a comitente account at Caja de Valores | more than 12.3 million; 24.6 million accounts (about two per investor), +35 percent year on year; 7 million new accounts in 2024, 6.7 million in 2025, 3 million in January to May 2026 | end of May 2026 | BYMA ninth-anniversary report via El Cronista 2026-07-02 (secondary) | 47 percent of accounts outside Buenos Aires; 40 percent women. |
| Active comitente accounts, monthly average | 1,087,847 | May 2026 | same | One in 21 economically active people trades in a given month. |
| Investor accounts (BYMA count) | 13.93 million | end of Q2 2026 | BYMA homepage (primary) | BYMA's April 2026 shareholder release gives 26.3 million "cuentas de inversión" at December 2025 (primary). Three counting bases coexist (persons, Caja accounts, BYMA investor accounts); quote one and name it. |
| Comitentes holding CEDEARs; accounts that traded CEDEARs in the last year | more than 1 million; 878,000 | mid-2026 | BYMA via El Cronista 2026-07-02 and iProfesional (secondary) | |
| Mercado Pago investment accounts in Argentina | about 20 million; 1 million users earning yield on USD accounts | 2026-06-11 | La Nación (secondary, company statement) | These are FCI-linked accounts, not PSAV wallets. Mercado Pago's PSAV status was not checked. Market estimate in the same article: 28.8 million operational investment accounts in the country. |
| Lemon (PSAV 162) | about 5 million users in Argentina and Peru; more than 1 million monthly actives; more than US$160 million in user assets | 2025-10-09 | Infobae (secondary, company statement at Series B) | A Lemon "Reporte de Usuarios Q1 2026" cited by blockchain.cl gives 2.1 million active users (secondary, report not seen). Lemon's wiki page "Ya somos 2 millones de usuarios" is undated (vendor, search result). |
| Belo (PSAV 52) | between 3.3 and 3.5 million users (all countries) | 2026-06-22 | La República interview with co-founder Edwin Rager (secondary, company statement) | Argentina-only figure not found. Tether invested US$14 million in April 2026 (Infobae, secondary). |
| Ripio | 2.1 million users in Argentina and Brazil | 2021-12-09 | El Cronista (secondary, company statement) | Stale. 2026 comparison sites claim "25 million users" with no source; not used. |
| Volsmart resale venue | users, hours and volumes: not found | | volsmart.com (JavaScript shell) | Volsmart reports "costs and commissions for each investment are disclosed before the transaction" (vendor site via search). |
| Crypto users in Argentina | 11 million (country-level, not wallet-level) | 2026-03-02 | blockchain.cl citing Chainalysis 2025 (secondary) | For scale only. |

### 3c. Supply so far (measured)

| Issue | Traditional issue | Tokenization | Amount | PSAV and venue | Source (status) |
|---|---|---|---|---|---|
| Landtoken I (farmland trust) | CNV authorization 2025-08-20; subscription 2025-12-09 to 2025-12-16 | Same authorization | Up to US$20 million expandable; placed amount not found; minimum US$50 | Tokenizer Tech Demeter (Justoken); trustee Allaria Fiduciaria; placement Allaria S.A. | LexLatin, Roadshow, Bichos de Campo (secondary) |
| Illa Belgrano I (Belgrano apartments) | Issued 2025-12-02 | RESFC-2026-23510, 2026-04-08; issuance document on AIF 2026-05-20 | US$4,150,330; minimum US$100 | Vol-Pro S.R.L. (Volsmart) as PSAV, registered holder and DLT entity; resale inside Volsmart's app and via DMA Broker and Winvest by LEBSA | PAGBAM (primary, law firm on the deal); iProfesional (secondary) |
| Espacio Añelo (Vaca Muerta real estate) | Issued 2026-05-28, 100 percent placed | RESFC-2026-23599, 2026-07-22; issuance document on AIF 2026-07-31 | US$4,961,000; minimum US$1,000 | Volsmart as PSAV; placement DMA Broker | PAGBAM (primary); Revista Mercado (secondary) |
| Anything since | none found | | | | Searched CNV, PAGBAM, Ámbito, Cronista, iProUP, Criptonoticias to 2026-11-07 |
| Infrastructure | BYMA Digital Assets (Caja Digital Assets S.A., PSAV 86): BYMA Token Registry live; institutional custody and RWA tokenization "próximamente" | | | Registry only, not a venue | bymadigitalassets.com.ar (primary, vendor); iProUP 2025-08-24 (secondary) |

Measured run-rate: three authorized issues in the fifteen months from 2025-08-20 to 2026-11-07; the two with public amounts average US$4.56 million; one PSAV operates a venue; all three are real-estate or farmland trusts (art. 1 d). No tokenized share, ON or CEDEAR has been authorized in anything found, five months after RG 1150 allowed them.

---

## Part 4. Projection to 2030: three scenarios and the assumption table

**Everything in this part is a projection, not a measurement.** The 2026 row is measured (two tokenizations authorized this year, US$9.11 million) and is the only measured row. Years 2027 to 2030 are modelled from the assumptions in Table 4a. All three scenarios assume the regime continues past 2027-12-31, either by a further extension (the sandbox has already been extended once, by RG 1150) or by the Ley de Competitividad Financiera. If neither happens, issuance in 2028 to 2030 is zero in every scenario and only licence revenue on already-issued tokens survives; that kill-switch is stated once here rather than modelled as a fourth scenario.

### 4a. Assumption table

| Assumption | Low | Base | High | Comparable it comes from (#24 unless stated) |
|---|---|---|---|---|
| Regime continues after 2027-12-31 | yes | yes | yes | RG 1150 already extended it once (16 months, from 2026-08-21 to 2027-12-31); bill in Diputados since 2026-11-02 (Part 2). If false, 2028 to 2030 issuance is zero. |
| Ramp shape for the number of issues per year | EU DLT Pilot Regime: 26 months, 3 venues, 6 share issues worth EUR 11.9 million; ESMA called the caps "too restrictive" | Japan: public security tokens 82 cumulative in about six years, 24 in FY2025, issuance doubling in the fifth year (JPY 168 billion to JPY 333 billion); roughly a doubling per year from a small base | Brazil crowdfunding after the CVM ofícios: 403 offers and R$1.2 billion in 2024 to 861 offers and R$3.9 billion in 2025 (count x2.1, amount x3.25 in one year), from a base of 69 licensed platforms | #24 Parts 1 and 3 |
| Issues per year 2027 / 2028 / 2029 / 2030 | 4 / 5 / 6 / 8 | 8 / 15 / 25 / 40 | 15 / 40 / 80 / 130 | Low: EU shape (about 3 issues a year). Base: Japan shape (double yearly from Argentina's measured 2 to 3 a year, reaching Japan's 24-a-year by 2029). High: Brazil shape (count doubling then more as ONs and CEDEARs join), capped well below 2025's 128 FF plus 323 ON issues. |
| Average size per issue (US$ million) 2027 / 2028 / 2029 / 2030 | 5 / 5 / 5 / 5 | 5 / 6 / 7 / 8 | 6 / 7 / 8 / 10 | Measured Argentine average US$4.56 million (Illa Belgrano I and Espacio Añelo); Dubai pilot AED 18.5 million (about US$5 million) in nine months; BEE4 R$17.1 million across four listings. Base and high rise as medium-impact ONs (cap 15 million UVA under RG 1125) and CEDEAR wrappers enter. Low stays at the trust-certificate ticket. |
| Eligible annual flow (denominator for the share tokenized) | USD 19.9 billion in 2025 (ON 17,748 + FF 1,990 + equity 169 + FCIC 19, CNV primary), held flat | same | same | Part 3a. Held flat in USD so the share is readable; the CNV reports a 34 percent real rise in 2025 and 17 percent in H1 2026, so a flat denominator is conservative for the share. |
| Share of the eligible flow tokenized, 2030 (derived) | 0.2 percent | 1.6 percent | 6.5 percent | Derived: issuance / 19.9 billion. It is an output, not an input: #24 measured Brazil's and Japan's tokenized issuance but not their national denominators, so no foreign share is quoted here. |
| PSAVs participating (cumulative, year end) 2027 / 2028 / 2029 / 2030 | 2 / 3 / 3 / 4 | 3 / 6 / 9 / 12 | 5 / 10 / 16 / 22 | Measured: 1 venue PSAV (Volsmart) plus 1 registry PSAV (BYMA Digital Assets). Ceiling: 34 PSAVs in all five categories (art. 14). Japan START opened with 2 participants and added 2; BEE4 has 2 brokers; Título XXII allows 5 per issue, so the base case assumes about one new PSAV per three issues. |
| Secondary turnover as a share of outstanding tokens per year | 0.2 percent | 2 percent | 10 percent | Japan START FY2024: JPY 326 million traded on JPY 168 billion outstanding, 0.2 percent. BEE4: R$7 million secondary on R$17.1 million raised over about 3.5 years, roughly 12 percent a year, with one session a week. Dubai Prypco: 7.8 million tokens opened to resale, volume not found. Cuota earns nothing on this row; it is here because the spec asks for it and because turnover is the PSAV's revenue, not Cuota's. |
| Per-issuance fee paid by the issuer (US$ per issue) | 10,000 | 20,000 | 30,000 | Tokeny setup US$15,000 to 35,000 and DigiShares US$10,000 to 25,000 (tokenizestartup.com comparison, secondary, March 2026); Securitize US$50,000 to 150,000 (same, secondary; too high for a US$5 million Argentine trust); Bitbond Token Tool self-serve US$499 per asset token plus US$299 per token sale plus US$289 per DvP contract, about US$1,100 (tokentool.bitbond.com, primary, vendor). On a US$5 million issue the range is 0.2 to 0.6 percent of proceeds. Justoken and Volsmart fees: not found. |
| Monthly licence per PSAV wallet (US$ per month) | 1,000 | 2,000 | 3,000 | Tokeny T-REX Standard EUR 3,000 and Advanced EUR 5,000 per month, 12-month minimum (FitGap listing, secondary; tokeny.com/pricing returned 404); DigiShares white-label portal US$1,000 to 2,500 per month; Securitize US$1,500 to 3,000 per month; Brickken US$299 to 1,200 per month (tokenizestartup.com, secondary). Argentine PSAVs are smaller than EU issuers' platforms, so the range sits at the low end. |
| Revenue start | 2027 | 2027 | 2027 | Hackathon demo on Fuji in November 2026; no commercial deployment in 2026. 2026 revenue is zero in every scenario. |
| FX | all US$ nominal, no inflation | same | same | Argentine tokenized issues so far are denominated in US$ (PAGBAM notices). |

### 4b. Issuance model (projection; 2026 row measured)

Issuance in a year = issues x average size. Outstanding = sum of issuance to date (no redemptions assumed; trusts are multi-year). Secondary turnover = outstanding x turnover share. Share of flow = issuance / US$19.9 billion.

| Year | Scenario | Issues | Avg size (US$ M) | Issuance (US$ M) | Outstanding, year end (US$ M) | PSAVs | Turnover share | Secondary volume (US$ M) | Share of eligible flow |
|---|---|---|---|---|---|---|---|---|---|
| 2026 (measured) | all | 2 tokenizations authorized (plus Landtoken I from 2025, amount not found) | 4.56 | 9.11 | 9.11 | 1 | not found | not found | 0.05 percent |
| 2027 | Low | 4 | 5 | 20 | 29 | 2 | 0.2 percent | 0.06 | 0.10 percent |
| 2028 | Low | 5 | 5 | 25 | 54 | 3 | 0.2 percent | 0.11 | 0.13 percent |
| 2029 | Low | 6 | 5 | 30 | 84 | 3 | 0.2 percent | 0.17 | 0.15 percent |
| 2030 | Low | 8 | 5 | 40 | 124 | 4 | 0.2 percent | 0.25 | 0.20 percent |
| 2027 | Base | 8 | 5 | 40 | 49 | 3 | 2 percent | 1.0 | 0.20 percent |
| 2028 | Base | 15 | 6 | 90 | 139 | 6 | 2 percent | 2.8 | 0.45 percent |
| 2029 | Base | 25 | 7 | 175 | 314 | 9 | 2 percent | 6.3 | 0.88 percent |
| 2030 | Base | 40 | 8 | 320 | 634 | 12 | 2 percent | 12.7 | 1.61 percent |
| 2027 | High | 15 | 6 | 90 | 99 | 5 | 10 percent | 9.9 | 0.45 percent |
| 2028 | High | 40 | 7 | 280 | 379 | 10 | 10 percent | 37.9 | 1.41 percent |
| 2029 | High | 80 | 8 | 640 | 1,019 | 16 | 10 percent | 101.9 | 3.22 percent |
| 2030 | High | 130 | 10 | 1,300 | 2,319 | 22 | 10 percent | 231.9 | 6.53 percent |

Sanity checks against #24: base 2030 issuance of US$320 million is about one tenth of Japan's FY2025 security-token issuance (JPY 165 billion) in an economy with a far smaller capital market; high 2030 cumulative US$2.3 billion is in the range of Brazil's single-year 2025 crowdfunding total (R$3.9 billion) and SDX's cumulative CHF 2 billion of digital bonds after five years. Low 2030 cumulative US$124 million is ten times the EU pilot's EUR 11.9 million after 26 months, which is why "low" is not "zero".

---

## Part 5. What Cuota captures

Revenue model from issue #1 only: a per-issuance fee paid by the issuer when a token is registered, plus a monthly licence per PSAV wallet that embeds Cuota. No protocol fee on trades, ever; the secondary-volume column of Part 4 earns Cuota nothing. Capture assumes every tokenized issue in the scenario registers on Cuota and every participating PSAV licenses it, which is the ceiling; a share-of-market haircut is left to the reader (halving both lines halves revenue).

Arithmetic per year: issuance revenue = issues x fee; licence revenue = PSAVs at year end x 12 x monthly licence (a simplification that over-counts PSAVs that join mid-year; the error is within the fee range).

| Year | Scenario | Issues x fee (US$) | PSAVs x 12 x licence (US$) | Cuota revenue (US$) |
|---|---|---|---|---|
| 2026 | all | 0 (not live) | 0 | 0 |
| 2027 | Low | 4 x 10,000 = 40,000 | 2 x 12 x 1,000 = 24,000 | 64,000 |
| 2028 | Low | 5 x 10,000 = 50,000 | 3 x 12 x 1,000 = 36,000 | 86,000 |
| 2029 | Low | 6 x 10,000 = 60,000 | 3 x 12 x 1,000 = 36,000 | 96,000 |
| 2030 | Low | 8 x 10,000 = 80,000 | 4 x 12 x 1,000 = 48,000 | 128,000 |
| 2027 | Base | 8 x 20,000 = 160,000 | 3 x 12 x 2,000 = 72,000 | 232,000 |
| 2028 | Base | 15 x 20,000 = 300,000 | 6 x 12 x 2,000 = 144,000 | 444,000 |
| 2029 | Base | 25 x 20,000 = 500,000 | 9 x 12 x 2,000 = 216,000 | 716,000 |
| 2030 | Base | 40 x 20,000 = 800,000 | 12 x 12 x 2,000 = 288,000 | 1,088,000 |
| 2027 | High | 15 x 30,000 = 450,000 | 5 x 12 x 3,000 = 180,000 | 630,000 |
| 2028 | High | 40 x 30,000 = 1,200,000 | 10 x 12 x 3,000 = 360,000 | 1,560,000 |
| 2029 | High | 80 x 30,000 = 2,400,000 | 16 x 12 x 3,000 = 576,000 | 2,976,000 |
| 2030 | High | 130 x 30,000 = 3,900,000 | 22 x 12 x 3,000 = 792,000 | 4,692,000 |

Cumulative 2027 to 2030: Low US$374,000; Base US$2,480,000; High US$9,858,000.

Sensitivity a juror will ask for: in the base case, the fee is 0.25 percent of a US$8 million issue, so an issuer paying placement fees of a few percent would not notice it; cutting the fee to US$10,000 and the licence to US$1,000 (low-tier pricing on base-tier volume) gives 2030 revenue of 40 x 10,000 + 12 x 12 x 1,000 = US$544,000. Keeping base pricing but capturing half the issues and half the PSAVs gives US$544,000 as well. What Cuota never earns: the US$12.7 million of base-case 2030 secondary turnover, which belongs to the PSAVs.

The three or four numbers a juror hears: **twelve million** investors with an account today; **twenty billion dollars** of eligible primary issuance last year; **three** tokenized issues so far; **about one million dollars a year** for Cuota by 2030 on the base case, from fees and licences, with the secondary market left to the wallets.

---

## Part 6. Do not say

1. Do not quote the ARS 122.8 trillion equity market cap, the ARS 118.9 trillion open-fund AUM or the US$33.7 billion of total 2025 market financing as "addressable". Open funds are not tokenizable (art. 1 excludes FCIA regimes except ETF-type units); market cap is stock, not issuance; and pagarés and cheques (US$13.5 billion of the US$33.7 billion) are not art. 1 instruments. The denominator is the US$19.9 billion eligible primary flow, and the scenarios tokenize 0.2 to 6.5 percent of it by 2030.
2. Do not say "24.6 million investors" or "26.3 million investors". Those are accounts; the persons are 12.3 million, the active accounts in a month are 1.09 million, and BYMA, Caja de Valores and the press use three different counting bases. Say "twelve million people with an account, one million active in a month".
3. Do not add up Mercado Pago's 20 million, Lemon's 5 million, Belo's 3.4 million and Ripio's 2.1 million. They overlap, two are regional totals (Lemon includes Peru, Belo several countries), Ripio's figure is from 2021, and Mercado Pago's accounts are FCI accounts, not PSAV wallets. Quote them one at a time with the date.
4. Do not call the US$16.3 billion of H1 2026 CEDEAR trading "CEDEAR holdings". It is six months of turnover at MEP dollars; the value held in custody was not found.
5. Do not say the sandbox has been extended beyond 2027 or that the Ley de Competitividad Financiera is law. The sandbox ends 2027-12-31 (RG 1150 art. 38); the bill entered Diputados on 2026-11-02 and has 240 articles to get through.
6. Do not present the 2030 figures as forecasts. They are three labelled scenarios whose every input is in Table 4a; the honest sentence is "if Argentina follows Japan's ramp, forty issues a year by 2030".
7. Do not say Landtoken I raised US$20 million (carried over from #24); that is the authorized ceiling and the placed amount is not public. Do not say Ripio has "25 million users"; that figure appears only on comparison sites without a source.
8. Do not convert pesos at a rate of your own. The CNV's USD figures use Com. "A" 3500 of 2025-12-30 (implied ARS 1,459.4 per USD); PwC's use CCL; BYMA's CEDEAR volume uses MEP. Quote the CNV's own USD and name the rate.
9. Do not say "the CNV has a pipeline of N applications". No such number was found anywhere, and the CNV publishes no consolidated list of tokenization authorizations.
10. Do not say Cuota earns from trading, even as a possibility. The #1 model is fees and licences only; the secondary-volume column exists to show what the PSAVs, not Cuota, would earn.
