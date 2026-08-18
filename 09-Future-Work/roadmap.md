# Future Work & Roadmap

INBMG — Intelligent Narmada Basin Monitoring & Governance — began as a broad, multi-domain AI concept for the Narmada Basin. Over time, the project has narrowed toward a concrete, implemented technical component while retaining the broader vision for future phases. This document draws a clear line between what has actually been built and what remains proposed.

## Status Legend

- **Implemented** — Built, executed, and documented with real outputs (technical report, data, or repository files).
- **Current Research** — Actively part of the current documented technical scope.
- **Planned** — Named as a near-term phase in project planning materials (abstract/presentations), not yet built.
- **Future Scope / Long-Term Vision** — Part of the original broad concept, not yet planned in detail or implemented.

---

## Implemented

- **2025 remote-sensing river-health analysis** for the Omkareshwar and Maheshwar stretches of the Narmada River, using Sentinel-2 imagery processed in Google Earth Engine.
- Computation of eight spectral indices: NDTI, NDWI, MNDWI, AWEI, FAI, NDVI, BSI, TSM.
- Monthly statistical analysis (histograms) and yearly trend analysis for each index, documented in the technical report.

This is the only component of INBMG that has moved from concept to a documented, executed technical output as of this repository.

---

## Current Research / Documented Concept (Not Yet Implemented as Software)

These components appear in the project abstract and technical-report framing as part of the intended INBMG architecture, but do not yet have implemented code, models, or datasets in this repository:

- **Predictive crowd management** using computer vision (the abstract references YOLOv8 and SSD-MobileNet for CCTV-based crowd density monitoring at Ghats).
- **Environmental DNA (eDNA)-based biodiversity monitoring**, described in the abstract as a key planned innovation for matching satellite reflectance data with eDNA water sampling to track pollution and endangered species.
- **Satellite-based flood-cycle, river-edge, and floodplain-encroachment mapping** using Sentinel-1 and LISS-IV data with Random Forest / CNN models (per the abstract), distinct from the Sentinel-2 optical index work that has actually been implemented.

## Planned (Named Phases in Project Materials)

The project abstract lays out a three-phase strategic implementation roadmap:

1. **Phase I — Safety Excellence:** Computer-vision crowd alerts and a navigation app, starting in Omkareshwar.
2. **Phase II — Ecological Resilience:** Satellite mapping and DNA-based pollution tracking.
3. **Phase III — Governance Integration:** Connecting all components to a digital dashboard and command center.

As of this repository, work has proceeded on **environmental/river-health remote sensing** (part of the ecological monitoring theme), while the crowd-safety and governance-dashboard phases remain planned/proposed.

## Future Scope / Long-Term Vision (Broader Original Concept)

These areas were part of the original broad Narmada Project concept (see the initial workflow in [`01-Project-Concept/`](../01-Project-Concept/)) and the early conceptual presentations. They represent long-term vision items and are **not implemented**:

- AI-based real-time crowd measurement and heatmap-based crowd safety alerts
- CCTV/camera-based threat detection and false-pattern removal
- Intelligent river navigation with current/hazard prediction and multilingual voice alerts (English, Hindi, Nimadi)
- A public-facing digital website/platform with live crowd data, safe/unsafe ghat status, and multilingual support
- Broader biodiversity assessment, including species-extinction and flora/fauna tracking beyond the eDNA component
- Integrated digital governance dashboard unifying crowd, river-health, and navigation data for administrators
- Drone-based active safety intervention (e.g., automated life-jacket deployment), as referenced in the abstract

## What This Roadmap Is Not

This roadmap does not claim that any of the "Current Research," "Planned," or "Future Scope" items have working prototypes, trained models, or deployed systems. Only the remote-sensing river-health analysis described under **Implemented** has produced verifiable outputs in this repository. Presentation slides and the abstract describe *intended* system capabilities (e.g., real-time dashboards, AI-based prediction) as part of the project's broader design vision — these are documented as such in [`10-Presentation-Images/`](../10-Presentation-Images/) and [`02-Project-Abstract/`](../02-Project-Abstract/), not as delivered software.
