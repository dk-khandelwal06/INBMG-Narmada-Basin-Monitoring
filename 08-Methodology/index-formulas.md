# Remote-Sensing Index Formulas

All formulas below are reproduced exactly as defined in the project's technical report (Chapter 4, "Methodology," and Chapter 5, "Results and Discussion"). All indices are computed from **Sentinel-2 Level-2A surface-reflectance bands** within Google Earth Engine.

---

## 1. NDTI — Normalized Difference Turbidity Index

**Full name:** Normalized Difference Turbidity Index
**Purpose:** Estimates suspended sediment concentration / water turbidity.

```
NDTI = (Red − Green) / (Red + Green)
     = (Band 4 − Band 3) / (Band 4 + Band 3)
```

- **Bands used:** Band 4 (Red), Band 3 (Green)
- **Interpretation:** Values range from −1 to +1. Values closer to zero or positive indicate highly turbid water; highly negative values indicate clearer water.
- **Role in project:** Tracks seasonal turbidity shifts (e.g., pre-monsoon sediment increase) across the Omkareshwar and Maheshwar stretches.
- **Location:** [`04-Remote-Sensing-Analysis/01-NDTI/`](../04-Remote-Sensing-Analysis/01-NDTI/), [`05-Data/NDTI/`](../05-Data/NDTI/), [`06-Results/NDTI/`](../06-Results/NDTI/)

---

## 2. NDWI — Normalized Difference Water Index

**Full name:** Normalized Difference Water Index
**Purpose:** Delineates open water bodies.

```
NDWI = (Green − NIR) / (Green + NIR)
```

- **Bands used:** Green, Near-Infrared (NIR)
- **Interpretation:** Higher values indicate stronger presence of open water; used to map the river's surface extent.
- **Role in project:** Baseline water-body delineation for the study stretches.
- **Location:** [`04-Remote-Sensing-Analysis/02-NDWI/`](../04-Remote-Sensing-Analysis/02-NDWI/), [`05-Data/NDWI/`](../05-Data/NDWI/), [`06-Results/NDWI/`](../06-Results/NDWI/)

---

## 3. MNDWI — Modified Normalized Difference Water Index

**Full name:** Modified Normalized Difference Water Index
**Purpose:** Water extraction with reduced noise from built-up land, achieved by substituting the NIR band used in NDWI with SWIR.

```
MNDWI = (Green − SWIR) / (Green + SWIR)
```

- **Bands used:** Green, Shortwave-Infrared (SWIR)
- **Interpretation:** Suppresses false-positive water signals from urban/built-up surfaces compared to NDWI.
- **Role in project:** Used as the basis for generating the binary water mask applied before computing FAI and TSM.
- **Location:** [`04-Remote-Sensing-Analysis/03-MNDWI/`](../04-Remote-Sensing-Analysis/03-MNDWI/), [`05-Data/MNDWI/`](../05-Data/MNDWI/), [`06-Results/MNDWI/`](../06-Results/MNDWI/)

---

## 4. AWEI — Automated Water Extraction Index

**Full name:** Automated Water Extraction Index
**Purpose:** High-accuracy water extraction, particularly resilient in areas affected by shadows from terrain or structures.

```
AWEI = 4 × (Green − SWIR1) − (0.25 × NIR + 2.75 × SWIR2)
```

- **Bands used:** Green, SWIR1, NIR, SWIR2
- **Interpretation:** Designed to accurately isolate water pixels while filtering out shadow-induced false positives.
- **Role in project:** Used specifically to map dry-season river contraction and shallow-water dynamics (January–June 2025 only — see [`data-availability.md`](./data-availability.md) for why).
- **Location:** [`04-Remote-Sensing-Analysis/04-AWEI/`](../04-Remote-Sensing-Analysis/04-AWEI/), [`05-Data/AWEI/`](../05-Data/AWEI/), [`06-Results/AWEI/`](../06-Results/AWEI/)

---

## 5. FAI — Floating Algae Index

**Full name:** Floating Algae Index
**Purpose:** Detects and quantifies floating algae, phytoplankton, and surface aquatic vegetation; used to identify eutrophication and harmful algal blooms (HABs).

```
FAI = ρ(NIR) − [ ρ(Red) + (ρ(SWIR1) − ρ(Red)) × (λ(NIR) − λ(Red)) / (λ(SWIR1) − λ(Red)) ]
```

Where ρ represents surface reflectance (NIR = Band 8, Red = Band 4, SWIR1 = Band 11) and λ represents the respective central wavelengths of those bands.

- **Bands used:** NIR (Band 8), Red (Band 4), SWIR1 (Band 11)
- **Interpretation:** Positive FAI values indicate floating algae presence; higher values correspond to denser algal blooms. Highly resistant to atmospheric interference and sunglint compared to standard vegetation indices.
- **Role in project:** Monitors eutrophication and post-monsoon algal bloom dynamics; computed only over the MNDWI-derived water mask.
- **Location:** [`04-Remote-Sensing-Analysis/05-FAI/`](../04-Remote-Sensing-Analysis/05-FAI/), [`05-Data/FAI/`](../05-Data/FAI/), [`06-Results/FAI/`](../06-Results/FAI/)

---

## 6. NDVI — Normalized Difference Vegetation Index

**Full name:** Normalized Difference Vegetation Index
**Purpose:** Evaluates riparian vegetation density and health.

```
NDVI = (NIR − Red) / (NIR + Red)
```

- **Bands used:** NIR, Red
- **Interpretation:** Higher values indicate denser, healthier vegetation cover along the riverbanks.
- **Role in project:** One of the two "Riparian Health Indices" used to assess conditions along the riverbanks (paired with BSI).
- **Location:** [`04-Remote-Sensing-Analysis/06-NDVI/`](../04-Remote-Sensing-Analysis/06-NDVI/), [`05-Data/NDVI/`](../05-Data/NDVI/), [`06-Results/NDVI/`](../06-Results/NDVI/)

---

## 7. BSI — Bare Soil Index

**Full name:** Bare Soil Index
**Purpose:** Highlights exposed riverbanks and potential erosion zones.

```
BSI = [(SWIR1 + Red) − (NIR + Blue)] / [(SWIR1 + Red) + (NIR + Blue)]
```

- **Bands used:** SWIR1, Red, NIR, Blue
- **Interpretation:** Higher values indicate greater bare-soil exposure, often associated with erosion or shrinking water extent.
- **Role in project:** The second "Riparian Health Index," paired with NDVI to assess riverbank exposure and erosion risk.
- **Location:** [`04-Remote-Sensing-Analysis/07-BSI/`](../04-Remote-Sensing-Analysis/07-BSI/), [`05-Data/BSI/`](../05-Data/BSI/), [`06-Results/BSI/`](../06-Results/BSI/)

---

## 8. TSM — Total Suspended Matter

**Full name:** Total Suspended Matter
**Purpose:** Estimates the physical concentration of suspended particles in the water column, indicating turbidity, sediment transport, and overall river health.

```
TSM = [A × Red / (1 − Red / C)] + B
```

Where Red = Band 4 (Red band reflectance), and **A, B, C are calibration coefficients** specific to the sensor's radiometric response and regional hydrodynamic properties (based on a semi-analytical model of the Nechad-type used for water-quality remote sensing).

- **Bands used:** Band 4 (Red)
- **Interpretation:** Higher TSM values indicate increased suspended sediments from erosion, runoff, or anthropogenic activity.
- **Role in project:** Quantitative sediment-loading indicator, complementing the qualitative turbidity signal from NDTI; computed only over the MNDWI-derived water mask.
- **Location:** [`04-Remote-Sensing-Analysis/08-TSM/`](../04-Remote-Sensing-Analysis/08-TSM/), [`05-Data/TSM/`](../05-Data/TSM/), [`06-Results/TSM/`](../06-Results/TSM/)

---

## Notes

- The technical report presents all indices as applied specifically to the **Omkareshwar and Maheshwar** stretches of the Narmada River for the **2025 calendar year**.
- Formula variables (Red, Green, NIR, SWIR, SWIR1, SWIR2, Blue) refer to Sentinel-2 Level-2A surface-reflectance bands unless otherwise noted.
- Calibration coefficients for TSM (A, B, C) are described in the report as region/sensor-specific but are not enumerated with explicit numeric values in the source report; refer to the technical report PDF directly if those values are needed.
