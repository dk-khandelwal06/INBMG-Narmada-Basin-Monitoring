# Methodology

This document describes the technical workflow behind the **2025 remote-sensing-based river health analysis** currently implemented under the INBMG project. All information here is drawn directly from the project's technical report, *"Narmada Basin Monitoring: A Remote Sensing and Geospatial Analysis Approach for River Health Assessment"* (see [`07-Technical-Report/INBMG-Narmada-Technical-Report.pdf`](../07-Technical-Report/INBMG-Narmada-Technical-Report.pdf)).

> **Scope note:** This methodology covers only the implemented remote-sensing component of INBMG. It does **not** cover the broader conceptual components (crowd monitoring, eDNA sampling, intelligent navigation, digital dashboard, etc.) described in the [project abstract](../02-Project-Abstract/INBMG-Project-Abstract.pdf) and [presentations](../03-Project-Development/), which remain at the concept/proposal stage. See [`09-Future-Work/roadmap.md`](../09-Future-Work/roadmap.md) for that scope.

## 1. Study Area

The analysis focuses on two ecologically sensitive stretches of the Narmada River:

- **Omkareshwar**
- **Maheshwar**

These stretches were selected as the geographic scope for satellite-derived index computation.

## 2. Data Acquisition and Pre-processing

- **Primary dataset:** Sentinel-2 Level-2A (Surface Reflectance) multispectral imagery, provided by the European Space Agency (ESA).
- **Processing environment:** The entire analytical pipeline was executed within the **Google Earth Engine (GEE)** cloud platform.
- **Cloud masking:** A cloud-masking protocol was applied using the **QA60 band** to filter out imagery affected by dense cloud cover and cirrus interference, isolating clear pixels over the river stretches.
- **Temporal coverage:** Calendar year 2025, with month-by-month processing (subject to data-availability constraints described below and in [`data-availability.md`](./data-availability.md)).

## 3. Water Masking

For water-quality and water-surface indices (e.g., FAI, TSM), a binary water mask — derived from MNDWI — was applied prior to index computation to isolate river-channel pixels and eliminate terrestrial reflectance (bare soil, built-up areas, riparian vegetation). This ensures that statistics reflect the aquatic environment specifically rather than the surrounding land.

## 4. Spectral Index Computation

Eight remote-sensing indices were computed from the Sentinel-2 bands:

| # | Index | Purpose |
|---|-------|---------|
| 1 | NDTI | Suspended sediment / turbidity estimation |
| 2 | NDWI | Open water body delineation |
| 3 | MNDWI | Water extraction with suppressed built-up noise |
| 4 | AWEI | High-accuracy water extraction, resilient to shadow |
| 5 | FAI | Floating algae / eutrophication detection |
| 6 | NDVI | Riparian vegetation health |
| 7 | BSI | Exposed riverbank / bare soil detection |
| 8 | TSM | Suspended particulate matter concentration |

Full formulas, bands used, and interpretation are documented in [`index-formulas.md`](./index-formulas.md).

## 5. Monthly Extraction and Statistical Analysis

For each index, per-month statistics were computed from the masked pixel population within the study stretches, and exported from GEE as:

- **Monthly pixel-distribution histograms** — showing the frequency of pixels against their index values for a given month, paired with a statistical summary (mean, spread) exported from GEE.
- **Monthly mean trend charts** — a single time-series chart per index plotting the monthly mean value across the months for which data was available in 2025.

These outputs are organized in the repository under [`04-Remote-Sensing-Analysis/`](../04-Remote-Sensing-Analysis/) (histograms and trend images) and [`06-Results/`](../06-Results/) (trend images only, to avoid duplication).

## 6. Monsoon-Period Data Exclusions

Not every index has data for every calendar month. This is a deliberate, documented exclusion, not missing/incomplete work:

- Sentinel-2 is an **optical** multispectral sensor and cannot penetrate dense cloud cover.
- During the Indian southwest monsoon, the Narmada Basin experiences persistent, heavy cloud cover, which renders the spectral bands used by these indices statistically/optically invalid.
- Depending on the index, the excluded window is either **June–September** or **July–September** (four or three months), with one index (AWEI) additionally excluded for the **entire second half of the year** for methodological reasons specific to that index (see below).
- For **AWEI** specifically, the technical report also notes that once post-monsoon floodplains are re-established, MNDWI is sufficient for water extraction, making continued AWEI computation for the latter half of the year redundant to the study's objective of mapping dry-season river contraction.

The exact month-by-month availability for each index is documented transparently in [`data-availability.md`](./data-availability.md). **Do not interpret a missing month as an error — it reflects either monsoon cloud cover or an intentional analytical design choice explained in the technical report.**

## 7. Interpretation

Each index chapter in the technical report includes a "Discussion and Ecological Implications" section that interprets the observed monthly and seasonal trends (e.g., pre-monsoon turbidity/TSM buildup, post-monsoon algal blooms, dry-season habitat contraction). These interpretations are specific to the Omkareshwar–Maheshwar stretches for the 2025 study period and should not be generalized beyond that scope without further validation.

## 8. Workflow Summary

```
Sentinel-2 (Level-2A) Image Collection via Google Earth Engine
            │
            ▼
Spatial Filtering (Omkareshwar & Maheshwar) & Temporal Bounds
            │
            ▼
Cloud Masking & Atmospheric Correction (QA60 Band)
            │
            ▼
Water Mask Generation to Isolate River Pixels
            │
            ▼
Computation of Spectral Indices (NDTI, NDWI, NDVI, MNDWI, AWEI, FAI, BSI, TSM)
            │
            ▼
Statistical Data Extraction & Time-Series Generation
            │
            ▼
Export of Thematic Maps, CSV Summaries, and Trend Graphs
```

This corresponds to the project workflow diagram in the technical report (Figure 4.1).
