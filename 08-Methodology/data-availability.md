# Data Availability

Not every remote-sensing index in this project has data for every month of 2025. This is **intentional and documented**, not an error or an incomplete dataset. This page explains exactly which months are available for each index and why, based directly on the technical report.

## Why Months Are Missing

Sentinel-2 is an **optical** multispectral satellite sensor — it cannot see through cloud cover. During the Indian southwest monsoon, the Narmada Basin experiences persistent, heavy cloud cover that makes the reflectance values used by these indices statistically or optically invalid. The technical report therefore excludes those months from analysis for each affected index, rather than presenting unreliable results.

One index — **AWEI** — has an additional, separate reason for exclusion beyond the monsoon months, explained below.

## Month-by-Month Availability Table

✅ = data available and documented (monthly histogram + included in trend chart)
❌ = excluded (monsoon cloud cover, unless noted otherwise)

| Index | Jan | Feb | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct | Nov | Dec | Months Available |
|-------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **NDTI**  | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | 9 |
| **NDWI**  | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | 9 |
| **MNDWI** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | 8 |
| **AWEI**  | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 6 |
| **FAI**   | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | 8 |
| **NDVI**  | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | 8 |
| **BSI**   | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | 8 |
| **TSM**   | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | 8 |

## Explanation Per Index

### NDTI, NDWI — 9 months (Jan–Jun, Oct–Dec)
Data for **July, August, and September** was excluded due to persistent monsoon cloud cover preventing optical measurement.

### MNDWI, FAI, NDVI, BSI, TSM — 8 months (Jan–May, Oct–Dec)
Data for **June, July, August, and September** was excluded due to persistent monsoon cloud cover.

### AWEI — 6 months (Jan–Jun only)
AWEI is the one index with a different pattern. Per the technical report, data is **strictly constrained to January–June 2025**, and July–December was excluded for two combined reasons:
1. The monsoon (July–September) makes AWEI computation optically invalid, same as the other indices.
2. For the remainder of the year (October–December), the report notes that **once post-monsoon floodplains re-establish, MNDWI is sufficient for water extraction**, making continued AWEI computation redundant to the study's specific objective of tracking dry-season river contraction and shallow-water dynamics.

## A Note on the NDWI Trend Chart

The technical report's NDWI trend chart is labeled as covering "January to July 2025," while the corresponding monthly histograms are only presented for January–June and October–December (9 months total, no July histogram). This document reports the months for which histogram-level data is actually documented in the report (see table above). This minor labeling inconsistency exists in the source technical report itself and is flagged here rather than silently resolved.

## Where to Find the Data

- **Histograms and trend images:** [`04-Remote-Sensing-Analysis/<index-folder>/monthly-histograms/`](../04-Remote-Sensing-Analysis/) and [`.../trend/`](../04-Remote-Sensing-Analysis/)
- **Trend images (deduplicated copy):** [`06-Results/<index>/`](../06-Results/)
- **Underlying CSV data:** [`05-Data/<index>/`](../05-Data/), named using the convention `NN-INDEX-Month-2025.csv` (e.g., `01-NDTI-January-2025.csv`)

> **Note on repository assets:** As of this documentation pass, the CSV files, monthly histogram images, and trend chart images described above are referenced by folder structure but have not yet been supplied as files for this repository build. Add the actual exported CSVs and images from the Google Earth Engine workflow into the corresponding folders to complete the dataset. Do not fabricate placeholder data in their place.
