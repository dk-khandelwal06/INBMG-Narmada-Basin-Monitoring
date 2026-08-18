# Data Sources

This document describes the data sources actually used for the 2025 remote-sensing analysis, as documented in the project's technical report.

## Satellite / Imagery Source

- **Satellite platform:** Sentinel-2, operated by the **European Space Agency (ESA)**.
- **Product level:** Sentinel-2 **Level-2A** (Surface Reflectance) collection.
- **Revisit time:** Approximately 5 days (a general characteristic of the Sentinel-2 mission, per the technical report's literature review).
- **Relevant bands used across indices:** Blue, Green, Red, Near-Infrared (NIR), Shortwave-Infrared (SWIR1, SWIR2). See [`index-formulas.md`](./index-formulas.md) for the exact bands used per index.

## Processing Platform

- **Google Earth Engine (GEE):** The entire analytical pipeline — spatial filtering, cloud masking, index computation, statistical extraction, and export — was executed within the GEE cloud environment. This choice enables large-scale, repeatable processing without local computational bottlenecks.
- **Cloud masking:** Performed using the Sentinel-2 **QA60 band** to exclude cloud- and cirrus-affected pixels.

## Study Period

- **Calendar year 2025**, processed on a month-by-month basis. Not all months are available for every index — see [`data-availability.md`](./data-availability.md) for the exact monthly breakdown and the reasons for exclusions.

## Geographic Study Area

- **Omkareshwar** and **Maheshwar** — two stretches of the Narmada River, described in the technical report as ecologically sensitive reaches selected for this study.

## How the Data Was Used

1. Sentinel-2 imagery for the study area and time window was queried via GEE.
2. Cloud-affected imagery was filtered out using the QA60 band.
3. A water mask (derived from MNDWI) was applied to isolate river pixels from terrestrial noise for water-focused indices.
4. Eight spectral indices (NDTI, NDWI, MNDWI, AWEI, FAI, NDVI, BSI, TSM) were computed pixel-by-pixel for each available month.
5. Monthly statistics (pixel-distribution histograms and summary statistics) and monthly mean values (for trend charts) were exported from GEE.

## Data Artifacts in This Repository

| Artifact | Location | Description |
|---|---|---|
| Monthly histograms | [`04-Remote-Sensing-Analysis/`](../04-Remote-Sensing-Analysis/) | Per-index, per-month pixel-distribution histograms with statistical summaries |
| Trend charts | [`04-Remote-Sensing-Analysis/`](../04-Remote-Sensing-Analysis/) and [`06-Results/`](../06-Results/) | Per-index monthly mean trend line for 2025 |
| CSV datasets | [`05-Data/`](../05-Data/) | Month-wise CSV exports underlying the histograms and trends |
| Technical report | [`07-Technical-Report/`](../07-Technical-Report/) | Full write-up of methodology, results, and discussion |

## What Is Not Included

The technical report does not specify additional third-party or ground-truth datasets (e.g., in-situ water-quality sampling, government hydrological records) as being used to validate or calibrate the satellite-derived indices for this particular study. No such datasets are claimed here, and none should be assumed.
