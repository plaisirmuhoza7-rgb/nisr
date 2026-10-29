# Data methodology

`data/insights.json` is a small curated bundle of national published aggregates for product context. Its source of truth is `data/curated_aggregates.json`; run `python data/build_indicators.py` from the repository root to validate required definitions and provenance fields and regenerate the bundle.

The values are transcribed from the official NISR FinScope 2024 and EICV7 publications listed in [DATA_SOURCES.md](DATA_SOURCES.md). The recorded locator identifies the publication page, report section, figure, or printed page. The script validates traceability and percentage ranges; it does not estimate values from microdata. No district-level values or local impact estimates are included.

The 96% figure is the overall financial inclusion estimate among adults. FinScope's text immediately before Figure 35 explicitly describes savings groups as used by about 4 million adults (52%); Figure 35 lists saving channels, which may overlap. The 86% mobile-money figure combines account owners and people who have used another person's wallet. EICV7's 27.4% is the national poverty estimate using updated methodology. These distinct denominators and definitions must travel with the numbers.

These estimates describe Rwanda, not Huriza users or participating groups. Demo transactions and product scenarios are synthetic and cannot demonstrate adoption or poverty reduction. Do not infer causal impact from these cross-sectional published aggregates.
