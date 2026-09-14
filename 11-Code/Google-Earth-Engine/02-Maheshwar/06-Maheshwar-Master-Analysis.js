/***************************************************************
===============================================================
 MAHESHWAR GHAT — NARMADA RIVER
 RIVER HEALTH MONITORING
 2016 — 2025
===============================================================

 LOCATION
 Latitude  : 22.1773
 Longitude : 75.5830

 STUDY AREA
 2 km around Maheshwar Ghat

 SENSOR STRATEGY
 2016     -> Landsat 8 Collection 2 Level-2
 2017-25  -> Sentinel-2 SR Harmonized

 INDICES
 NDVI  = Vegetation condition
 BSI   = Bare / exposed surface pressure
 MNDWI = Water signal
 NDTI  = Turbidity proxy
 TSM   = Suspended-material proxy

 RIVER HEALTH
 Higher NDVI  -> better
 Higher MNDWI -> better
 Higher BSI   -> worse
 Higher NDTI  -> worse
 Higher TSM   -> worse

 OUTPUTS
 1. Annual index statistics
 2. River Health Score 0-100
 3. Health class
 4. Annual health trend
 5. Index trend charts
 6. 2016 vs 2025 comparison
 7. Relative percentage changes
 8. Correlation analysis
 9. Correlation chart
 10. Health maps
 11. NDVI maps
 12. MNDWI maps
 13. NDTI maps
 14. BSI maps
 15. TSM maps
 16. CSV exports

===============================================================
***************************************************************/


// ============================================================
// 1. MAHESHWAR GHAT LOCATION
// ============================================================

var maheshwarPoint = ee.Geometry.Point([
  75.5830,
  22.1773
]);


// 2 km study area
var ROI = maheshwarPoint
  .buffer(2000)
  .bounds();


// Map center
Map.centerObject(
  ROI,
  13
);


// Study area boundary
Map.addLayer(
  ROI,
  {
    color: 'red'
  },
  'Maheshwar Study Area'
);


// Maheshwar Ghat point
Map.addLayer(
  maheshwarPoint,
  {
    color: 'yellow'
  },
  'Maheshwar Ghat'
);


// ============================================================
// 2. ANALYSIS YEARS
// ============================================================

var START_YEAR = 2016;
var END_YEAR = 2025;

var years = ee.List.sequence(
  START_YEAR,
  END_YEAR
);


// ============================================================
// 3. LANDSAT 8 — 2016
// ============================================================

var landsat2016 = ee.ImageCollection(
  'LANDSAT/LC08/C02/T1_L2'
)
.filterBounds(
  ROI
)
.filterDate(
  '2016-01-01',
  '2017-01-01'
)
.filter(
  ee.Filter.lte(
    'CLOUD_COVER',
    70
  )
);


print(
  'Landsat 8 images — 2016:',
  landsat2016.size()
);


// ============================================================
// 4. LANDSAT 8 CLOUD MASK + SCALE
// ============================================================

function maskLandsat(image) {

  var qa = image.select(
    'QA_PIXEL'
  );

  // Bits:
  // 0 Fill
  // 1 Dilated cloud
  // 2 Cirrus
  // 3 Cloud
  // 4 Cloud shadow
  // 5 Snow

  var mask = qa.bitwiseAnd(
    1 << 0
  ).eq(0)
  .and(
    qa.bitwiseAnd(
      1 << 1
    ).eq(0)
  )
  .and(
    qa.bitwiseAnd(
      1 << 2
    ).eq(0)
  )
  .and(
    qa.bitwiseAnd(
      1 << 3
    ).eq(0)
  )
  .and(
    qa.bitwiseAnd(
      1 << 4
    ).eq(0)
  )
  .and(
    qa.bitwiseAnd(
      1 << 5
    ).eq(0)
  );


  // Landsat Collection 2 Level-2
  // surface reflectance scaling
  var optical = image
    .select([
      'SR_B2',
      'SR_B3',
      'SR_B4',
      'SR_B5',
      'SR_B6',
      'SR_B7'
    ])
    .multiply(0.0000275)
    .add(-0.2);


  return optical
    .updateMask(mask)
    .copyProperties(
      image,
      [
        'system:time_start'
      ]
    );
}


// ============================================================
// 5. SENTINEL-2 — 2017 TO 2025
// ============================================================

var sentinel = ee.ImageCollection(
  'COPERNICUS/S2_SR_HARMONIZED'
)
.filterBounds(
  ROI
)
.filterDate(
  '2017-01-01',
  '2026-01-01'
)
.filter(
  ee.Filter.lte(
    'CLOUDY_PIXEL_PERCENTAGE',
    70
  )
);


print(
  'Sentinel-2 images — 2017 to 2025:',
  sentinel.size()
);


// ============================================================
// 6. SENTINEL-2 CLOUD / SHADOW MASK
// ============================================================

function maskSentinel(image) {

  var scl = image.select(
    'SCL'
  );


  // Keep:
  // 4 = vegetation
  // 5 = bare soil
  // 6 = water
  //
  // Remove clouds, shadows, cirrus etc.

  var mask = scl.eq(4)
    .or(
      scl.eq(5)
    )
    .or(
      scl.eq(6)
    );


  return image
    .select([
      'B2',
      'B3',
      'B4',
      'B8',
      'B11',
      'B12'
    ])
    .multiply(0.0001)
    .updateMask(mask)
    .copyProperties(
      image,
      [
        'system:time_start'
      ]
    );
}


// ============================================================
// 7. ADD INDICES — LANDSAT
// ============================================================

function addLandsatIndices(image) {

  var blue = image.select(
    'SR_B2'
  );

  var green = image.select(
    'SR_B3'
  );

  var red = image.select(
    'SR_B4'
  );

  var nir = image.select(
    'SR_B5'
  );

  var swir1 = image.select(
    'SR_B6'
  );


  // NDVI
  var NDVI = nir
    .subtract(red)
    .divide(
      nir.add(red)
    )
    .rename(
      'NDVI'
    );


  // BSI
  var BSI = swir1
    .add(red)
    .subtract(
      nir.add(blue)
    )
    .divide(
      swir1
        .add(red)
        .add(nir)
        .add(blue)
    )
    .rename(
      'BSI'
    );


  // MNDWI
  var MNDWI = green
    .subtract(swir1)
    .divide(
      green.add(swir1)
    )
    .rename(
      'MNDWI'
    );


  // NDTI
  var NDTI = red
    .subtract(green)
    .divide(
      red.add(green)
    )
    .rename(
      'NDTI'
    );


  // TSM spectral proxy
  var TSM = red
    .divide(
      green.max(0.0001)
    )
    .rename(
      'TSM'
    );


  return image
    .addBands(NDVI)
    .addBands(BSI)
    .addBands(MNDWI)
    .addBands(NDTI)
    .addBands(TSM);
}


// ============================================================
// 8. ADD INDICES — SENTINEL
// ============================================================

function addSentinelIndices(image) {

  var blue = image.select(
    'B2'
  );

  var green = image.select(
    'B3'
  );

  var red = image.select(
    'B4'
  );

  var nir = image.select(
    'B8'
  );

  var swir1 = image.select(
    'B11'
  );


  // NDVI
  var NDVI = nir
    .subtract(red)
    .divide(
      nir.add(red)
    )
    .rename(
      'NDVI'
    );


  // BSI
  var BSI = swir1
    .add(red)
    .subtract(
      nir.add(blue)
    )
    .divide(
      swir1
        .add(red)
        .add(nir)
        .add(blue)
    )
    .rename(
      'BSI'
    );


  // MNDWI
  var MNDWI = green
    .subtract(swir1)
    .divide(
      green.add(swir1)
    )
    .rename(
      'MNDWI'
    );


  // NDTI
  var NDTI = red
    .subtract(green)
    .divide(
      red.add(green)
    )
    .rename(
      'NDTI'
    );


  // TSM proxy
  var TSM = red
    .divide(
      green.max(0.0001)
    )
    .rename(
      'TSM'
    );


  return image
    .addBands(NDVI)
    .addBands(BSI)
    .addBands(MNDWI)
    .addBands(NDTI)
    .addBands(TSM);
}


// ============================================================
// 9. PROCESS COLLECTIONS
// ============================================================

var landsatIndexed = landsat2016
  .map(maskLandsat)
  .map(addLandsatIndices);


var sentinelIndexed = sentinel
  .map(maskSentinel)
  .map(addSentinelIndices);


print(
  'Processed Landsat 2016:',
  landsatIndexed
);


print(
  'Processed Sentinel 2017-2025:',
  sentinelIndexed
);


// ============================================================
// 10. EMPTY IMAGE
// ============================================================

var emptyImage = ee.Image.constant([
  0,
  0,
  0,
  0,
  0
])
.rename([
  'NDVI',
  'BSI',
  'MNDWI',
  'NDTI',
  'TSM'
])
.updateMask(
  ee.Image(0)
);


// ============================================================
// 11. YEARLY COMPOSITE FUNCTION
// ============================================================

function makeAnnualImage(year) {

  year = ee.Number(year);


  // ----------------------------------------------------------
  // 2016 = LANDSAT
  // ----------------------------------------------------------

  var landsatCollection =
    landsatIndexed.filterDate(
      ee.Date.fromYMD(
        year,
        1,
        1
      ),
      ee.Date.fromYMD(
        year.add(1),
        1,
        1
      )
    );


  // ----------------------------------------------------------
  // 2017-2025 = SENTINEL
  // ----------------------------------------------------------

  var sentinelCollection =
    sentinelIndexed.filterDate(
      ee.Date.fromYMD(
        year,
        1,
        1
      ),
      ee.Date.fromYMD(
        year.add(1),
        1,
        1
      )
    );


  var collection =
    ee.ImageCollection(
      ee.Algorithms.If(
        year.eq(2016),
        landsatCollection,
        sentinelCollection
      )
    );


  var count =
    collection.size();


  var composite =
    ee.Image(
      ee.Algorithms.If(
        count.gt(0),
        collection.median(),
        emptyImage
      )
    );


  return composite
    .clip(ROI)
    .set(
      'year',
      year
    )
    .set(
      'image_count',
      count
    )
    .set(
      'sensor',
      ee.Algorithms.If(
        year.eq(2016),
        'Landsat-8',
        'Sentinel-2'
      )
    )
    .set(
      'date',
      ee.Date.fromYMD(
        year,
        1,
        1
      ).millis()
    );
}


// ============================================================
// 12. CREATE 2016-2025 ANNUAL COLLECTION
// ============================================================

var annualImages =
  ee.ImageCollection.fromImages(
    years.map(
      makeAnnualImage
    )
  );


print(
  'Annual composites 2016-2025:',
  annualImages
);


// ============================================================
// 13. ANNUAL IMAGE TO FEATURE
// ============================================================

function annualImageToFeature(image) {

  var stats = image
    .select([
      'NDVI',
      'BSI',
      'MNDWI',
      'NDTI',
      'TSM'
    ])
    .reduceRegion({

      reducer:
        ee.Reducer.mean(),

      geometry:
        ROI,

      scale:
        30,

      bestEffort:
        true,

      maxPixels:
        1e9
    });


  return ee.Feature(
    null,
    {

      year:
        image.get(
          'year'
        ),

      sensor:
        image.get(
          'sensor'
        ),

      image_count:
        image.get(
          'image_count'
        ),

      NDVI:
        stats.get(
          'NDVI'
        ),

      BSI:
        stats.get(
          'BSI'
        ),

      MNDWI:
        stats.get(
          'MNDWI'
        ),

      NDTI:
        stats.get(
          'NDTI'
        ),

      TSM:
        stats.get(
          'TSM'
        )
    }
  );
}


// ============================================================
// 14. ANNUAL STATISTICS
// ============================================================

var annualStats =
  ee.FeatureCollection(
    annualImages.map(
      annualImageToFeature
    )
  );


print(
  '================================================'
);

print(
  'ANNUAL RIVER INDEX STATISTICS'
);

print(
  annualStats
);

print(
  '================================================'
);


// ============================================================
// 15. MINIMUM AND MAXIMUM VALUES
// ============================================================

var validAnnual =
  annualStats.filter(
    ee.Filter.notNull([
      'NDVI',
      'BSI',
      'MNDWI',
      'NDTI',
      'TSM'
    ])
  );


var NDVImin =
  ee.Number(
    validAnnual.aggregate_min(
      'NDVI'
    )
  );

var NDVImax =
  ee.Number(
    validAnnual.aggregate_max(
      'NDVI'
    )
  );


var BSImin =
  ee.Number(
    validAnnual.aggregate_min(
      'BSI'
    )
  );

var BSImax =
  ee.Number(
    validAnnual.aggregate_max(
      'BSI'
    )
  );


var MNDWImin =
  ee.Number(
    validAnnual.aggregate_min(
      'MNDWI'
    )
  );

var MNDWImax =
  ee.Number(
    validAnnual.aggregate_max(
      'MNDWI'
    )
  );


var NDTImin =
  ee.Number(
    validAnnual.aggregate_min(
      'NDTI'
    )
  );

var NDTImax =
  ee.Number(
    validAnnual.aggregate_max(
      'NDTI'
    )
  );


var TSMmin =
  ee.Number(
    validAnnual.aggregate_min(
      'TSM'
    )
  );

var TSMmax =
  ee.Number(
    validAnnual.aggregate_max(
      'TSM'
    )
  );


// ============================================================
// 16. SAFE NORMALIZATION FUNCTION
// ============================================================

function normalize(value, minValue, maxValue) {

  return ee.Number(
    ee.Algorithms.If(

      maxValue
        .subtract(minValue)
        .abs()
        .gt(0.000001),

      ee.Number(value)
        .subtract(minValue)
        .divide(
          maxValue.subtract(
            minValue
          )
        )
        .multiply(100),

      50

    )
  );
}


// ============================================================
// 17. RIVER HEALTH SCORE
// ============================================================

/*
 HEALTH LOGIC

 NDVI:
 Higher = better

 MNDWI:
 Higher = better

 BSI:
 Higher = worse

 NDTI:
 Higher = worse

 TSM:
 Higher = worse

 Equal weights:
 NDVI  = 20%
 MNDWI = 20%
 BSI   = 20%
 NDTI  = 20%
 TSM   = 20%
*/


var healthStats =
  validAnnual.map(

    function(feature) {

      var ndvi =
        ee.Number(
          feature.get(
            'NDVI'
          )
        );

      var bsi =
        ee.Number(
          feature.get(
            'BSI'
          )
        );

      var mndwi =
        ee.Number(
          feature.get(
            'MNDWI'
          )
        );

      var ndti =
        ee.Number(
          feature.get(
            'NDTI'
          )
        );

      var tsm =
        ee.Number(
          feature.get(
            'TSM'
          )
        );


      // Positive indicators
      var ndviScore =
        normalize(
          ndvi,
          NDVImin,
          NDVImax
        );


      var mndwiScore =
        normalize(
          mndwi,
          MNDWImin,
          MNDWImax
        );


      // Negative indicators
      var bsiScore =
        ee.Number(100)
          .subtract(
            normalize(
              bsi,
              BSImin,
              BSImax
            )
          );


      var ndtiScore =
        ee.Number(100)
          .subtract(
            normalize(
              ndti,
              NDTImin,
              NDTImax
            )
          );


      var tsmScore =
        ee.Number(100)
          .subtract(
            normalize(
              tsm,
              TSMmin,
              TSMmax
            )
          );


      // Overall health
      var healthScore =
        ndviScore
          .add(
            mndwiScore
          )
          .add(
            bsiScore
          )
          .add(
            ndtiScore
          )
          .add(
            tsmScore
          )
          .divide(5);


      // Health class
      var healthClass =
        ee.Algorithms.If(
          healthScore.gte(80),
          'Excellent',
          ee.Algorithms.If(
            healthScore.gte(60),
            'Good',
            ee.Algorithms.If(
              healthScore.gte(40),
              'Moderate',
              ee.Algorithms.If(
                healthScore.gte(20),
                'Poor',
                'Critical'
              )
            )
          )
        );


      return feature

        .set(
          'NDVI_score',
          ndviScore
        )

        .set(
          'MNDWI_score',
          mndwiScore
        )

        .set(
          'BSI_score',
          bsiScore
        )

        .set(
          'NDTI_score',
          ndtiScore
        )

        .set(
          'TSM_score',
          tsmScore
        )

        .set(
          'River_Health_Score',
          healthScore
        )

        .set(
          'Health_Class',
          healthClass
        );
    }
  );


// ============================================================
// 18. PRINT FINAL HEALTH TABLE
// ============================================================

print(
  '================================================'
);

print(
  '🌊 MAHESHWAR GHAT RIVER HEALTH — 2016-2025'
);

print(
  healthStats
);

print(
  '================================================'
);


// ============================================================
// 19. HEALTH SCORE CHART
// ============================================================

var healthChart =
  ui.Chart.feature.byFeature({

    features:
      healthStats,

    xProperty:
      'year',

    yProperties: [
      'River_Health_Score'
    ]

  })
  .setChartType(
    'LineChart'
  )
  .setOptions({

    title:
      '🌊 Maheshwar Ghat River Health Score — 2016-2025',

    subtitle:
      'Relative remote-sensing health index (0-100)',

    chartArea: {
      left: 80,
      right: 30,
      top: 70,
      bottom: 70
    },

    hAxis: {
      title:
        'Year',

      ticks: [
        2016,
        2017,
        2018,
        2019,
        2020,
        2021,
        2022,
        2023,
        2024,
        2025
      ]
    },

    vAxis: {
      title:
        'River Health Score',

      viewWindow: {
        min: 0,
        max: 100
      },

      gridlines: {
        count: 10
      }
    },

    colors: [
      '#00695C'
    ],

    lineWidth:
      4,

    pointSize:
      7,

    legend: {
      position:
        'none'
    }
  });


print(
  healthChart
);


// ============================================================
// 20. INDEX TREND FUNCTION
// ============================================================

function indexTrendChart(
  property,
  title,
  yTitle,
  color
) {

  var chart =
    ui.Chart.feature.byFeature({

      features:
        healthStats,

      xProperty:
        'year',

      yProperties: [
        property
      ]

    })
    .setChartType(
      'LineChart'
    )
    .setOptions({

      title:
        title,

      chartArea: {
        left: 80,
        right: 30,
        top: 70,
        bottom: 70
      },

      hAxis: {
        title:
          'Year'
      },

      vAxis: {
        title:
          yTitle,

        gridlines: {
          count: 8
        }
      },

      colors: [
        color
      ],

      lineWidth:
        4,

      pointSize:
        6,

      legend: {
        position:
          'none'
      }
    });


  print(
    chart
  );
}


// ============================================================
// 21. INDEX TREND CHARTS
// ============================================================

indexTrendChart(
  'NDVI',
  '🌿 NDVI — 2016-2025',
  'Mean NDVI',
  '#00A86B'
);


indexTrendChart(
  'MNDWI',
  '🔵 MNDWI — 2016-2025',
  'Mean MNDWI',
  '#1565C0'
);


indexTrendChart(
  'BSI',
  '🟤 BSI — 2016-2025',
  'Mean BSI',
  '#795548'
);


indexTrendChart(
  'NDTI',
  '🟠 NDTI — 2016-2025',
  'Mean NDTI',
  '#EF6C00'
);


indexTrendChart(
  'TSM',
  '🔴 TSM Proxy — 2016-2025',
  'TSM Proxy',
  '#D32F2F'
);


// ============================================================
// 22. HEALTH COMPONENT SCORE CHART
// ============================================================

var componentChart =
  ui.Chart.feature.byFeature({

    features:
      healthStats,

    xProperty:
      'year',

    yProperties: [
      'NDVI_score',
      'MNDWI_score',
      'BSI_score',
      'NDTI_score',
      'TSM_score'
    ]

  })
  .setChartType(
    'LineChart'
  )
  .setOptions({

    title:
      'Maheshwar River Health Components — 2016-2025',

    chartArea: {
      left: 80,
      right: 30,
      top: 70,
      bottom: 70
    },

    hAxis: {
      title:
        'Year'
    },

    vAxis: {
      title:
        'Component Score (0-100)',

      viewWindow: {
        min: 0,
        max: 100
      }
    },

    colors: [
      '#00A86B',
      '#1565C0',
      '#795548',
      '#EF6C00',
      '#D32F2F'
    ],

    lineWidth:
      3,

    pointSize:
      5,

    legend: {
      position:
        'bottom'
    }
  });


print(
  componentChart
);


// ============================================================
// 23. 2016 VS 2025 COMPARISON
// ============================================================

var data2016 =
  ee.Feature(
    healthStats
      .filter(
        ee.Filter.eq(
          'year',
          2016
        )
      )
      .first()
  );


var data2025 =
  ee.Feature(
    healthStats
      .filter(
        ee.Filter.eq(
          'year',
          2025
        )
      )
      .first()
  );


// ============================================================
// 24. SAFE PERCENT CHANGE
// ============================================================

function percentChange(
  oldValue,
  newValue
) {

  return ee.Algorithms.If(

    ee.Number(oldValue)
      .abs()
      .gt(
        0.000001
      ),

    ee.Number(newValue)
      .subtract(
        ee.Number(oldValue)
      )
      .divide(
        ee.Number(oldValue).abs()
      )
      .multiply(100),

    null
  );
}


// ============================================================
// 25. 2016-2025 COMPARISON TABLE
// ============================================================

var comparison2025 =
  ee.FeatureCollection([

    ee.Feature(
      null,
      {

        index:
          'NDVI',

        value_2016:
          data2016.get(
            'NDVI'
          ),

        value_2025:
          data2025.get(
            'NDVI'
          ),

        change_percent:
          percentChange(
            data2016.get(
              'NDVI'
            ),
            data2025.get(
              'NDVI'
            )
          )
      }
    ),


    ee.Feature(
      null,
      {

        index:
          'BSI',

        value_2016:
          data2016.get(
            'BSI'
          ),

        value_2025:
          data2025.get(
            'BSI'
          ),

        change_percent:
          percentChange(
            data2016.get(
              'BSI'
            ),
            data2025.get(
              'BSI'
            )
          )
      }
    ),


    ee.Feature(
      null,
      {

        index:
          'MNDWI',

        value_2016:
          data2016.get(
            'MNDWI'
          ),

        value_2025:
          data2025.get(
            'MNDWI'
          ),

        change_percent:
          percentChange(
            data2016.get(
              'MNDWI'
            ),
            data2025.get(
              'MNDWI'
            )
          )
      }
    ),


    ee.Feature(
      null,
      {

        index:
          'NDTI',

        value_2016:
          data2016.get(
            'NDTI'
          ),

        value_2025:
          data2025.get(
            'NDTI'
          ),

        change_percent:
          percentChange(
            data2016.get(
              'NDTI'
            ),
            data2025.get(
              'NDTI'
            )
          )
      }
    ),


    ee.Feature(
      null,
      {

        index:
          'TSM',

        value_2016:
          data2016.get(
            'TSM'
          ),

        value_2025:
          data2025.get(
            'TSM'
          ),

        change_percent:
          percentChange(
            data2016.get(
              'TSM'
            ),
            data2025.get(
              'TSM'
            )
          )
      }
    ),


    ee.Feature(
      null,
      {

        index:
          'River Health Score',

        value_2016:
          data2016.get(
            'River_Health_Score'
          ),

        value_2025:
          data2025.get(
            'River_Health_Score'
          ),

        change_percent:
          percentChange(
            data2016.get(
              'River_Health_Score'
            ),
            data2025.get(
              'River_Health_Score'
            )
          )
      }
    )

  ]);


print(
  '================================================'
);

print(
  '2016 VS 2025 RIVER HEALTH COMPARISON'
);

print(
  comparison2025
);

print(
  '================================================'
);


// ============================================================
// 26. HEALTH CLASS TABLE
// ============================================================

print(
  'YEAR + HEALTH CLASS'
);

print(
  healthStats.select([
    'year',
    'sensor',
    'River_Health_Score',
    'Health_Class'
  ])
);


// ============================================================
// 27. CORRELATION FUNCTION
// ============================================================

function getCorrelation(
  collection,
  x,
  y
) {

  var valid =
    collection.filter(
      ee.Filter.notNull([
        x,
        y
      ])
    );


  return valid
    .reduceColumns({

      reducer:
        ee.Reducer
          .pearsonsCorrelation(),

      selectors: [
        x,
        y
      ]

    })
    .get(
      'correlation'
    );
}


// ============================================================
// 28. ECOLOGICAL CORRELATIONS
// ============================================================

var relationships = [

  [
    'NDVI',
    'BSI',
    'NDVI vs BSI'
  ],

  [
    'BSI',
    'NDTI',
    'BSI vs NDTI'
  ],

  [
    'NDTI',
    'TSM',
    'NDTI vs TSM'
  ],

  [
    'MNDWI',
    'NDTI',
    'MNDWI vs NDTI'
  ],

  [
    'NDVI',
    'MNDWI',
    'NDVI vs MNDWI'
  ],

  [
    'MNDWI',
    'TSM',
    'MNDWI vs TSM'
  ]
];


var correlationTable =
  ee.FeatureCollection(

    relationships.map(
      function(pair) {

        var r =
          getCorrelation(
            healthStats,
            pair[0],
            pair[1]
          );


        return ee.Feature(
          null,
          {

            relationship:
              pair[2],

            variable_x:
              pair[0],

            variable_y:
              pair[1],

            correlation:
              r
          }
        );
      }
    )
  );


print(
  '================================================'
);

print(
  '2016-2025 ECOLOGICAL CORRELATION TABLE'
);

print(
  correlationTable
);

print(
  '================================================'
);


// ============================================================
// 29. CORRELATION CHART
// ============================================================

var correlationChart =
  ui.Chart.feature.byFeature({

    features:
      correlationTable,

    xProperty:
      'relationship',

    yProperties: [
      'correlation'
    ]

  })
  .setChartType(
    'ColumnChart'
  )
  .setOptions({

    title:
      'Maheshwar Ghat — Ecological Correlations 2016-2025',

    subtitle:
      'Pearson correlation coefficient',

    chartArea: {
      left: 75,
      right: 30,
      top: 70,
      bottom: 120
    },

    hAxis: {

      title:
        'Relationship',

      slantedText:
        true,

      slantedTextAngle:
        35
    },

    vAxis: {

      title:
        'Correlation (r)',

      viewWindow: {
        min: -1,
        max: 1
      },

      baseline:
        0
    },

    colors: [
      '#1565C0'
    ],

    legend: {
      position:
        'none'
    },

    bar: {
      groupWidth:
        '65%'
    }
  });


print(
  correlationChart
);


// ============================================================
// 30. SCATTER PLOT FUNCTION
// ============================================================

function scatterChart(
  x,
  y,
  title,
  xTitle,
  yTitle,
  color
) {

  var data =
    healthStats
      .filter(
        ee.Filter.notNull([
          x,
          y
        ])
      );


  var chart =
    ui.Chart.feature.byFeature({

      features:
        data,

      xProperty:
        x,

      yProperties: [
        y
      ]

    })
    .setChartType(
      'ScatterChart'
    )
    .setOptions({

      title:
        title,

      chartArea: {
        left: 80,
        right: 35,
        top: 70,
        bottom: 75
      },

      hAxis: {
        title:
          xTitle
      },

      vAxis: {
        title:
          yTitle
      },

      colors: [
        color
      ],

      pointSize:
        7,

      legend: {
        position:
          'none'
      },

      trendlines: {

        0: {

          type:
            'linear',

          color:
            color,

          lineWidth:
            3,

          showR2:
            true,

          visibleInLegend:
            true
        }
      }
    });


  print(
    chart
  );
}


// ============================================================
// 31. ECOLOGICAL SCATTERS
// ============================================================

scatterChart(
  'NDVI',
  'BSI',
  '🌿 NDVI vs BSI — Maheshwar 2016-2025',
  'NDVI',
  'BSI',
  '#00A86B'
);


scatterChart(
  'BSI',
  'NDTI',
  '🟤 BSI vs NDTI — Maheshwar 2016-2025',
  'BSI',
  'NDTI',
  '#795548'
);


scatterChart(
  'NDTI',
  'TSM',
  '🟠 NDTI vs TSM — Maheshwar 2016-2025',
  'NDTI',
  'TSM Proxy',
  '#EF6C00'
);


scatterChart(
  'MNDWI',
  'NDTI',
  '🔵 MNDWI vs NDTI — Maheshwar 2016-2025',
  'MNDWI',
  'NDTI',
  '#1565C0'
);


// ============================================================
// 32. 2016 COMPOSITE
// ============================================================

var composite2016 =
  ee.Image(
    annualImages
      .filter(
        ee.Filter.eq(
          'year',
          2016
        )
      )
      .first()
  );


// ============================================================
// 33. 2025 COMPOSITE
// ============================================================

var composite2025 =
  ee.Image(
    annualImages
      .filter(
        ee.Filter.eq(
          'year',
          2025
        )
      )
      .first()
  );


// ============================================================
// 34. RGB 2016
// ============================================================

Map.addLayer(

  composite2016,

  {
    bands: [
      'SR_B4',
      'SR_B3',
      'SR_B2'
    ],

    min: 0,
    max: 0.3
  },

  'RGB 2016 Landsat'
);


// ============================================================
// 35. RGB 2025
// ============================================================

Map.addLayer(

  composite2025,

  {
    bands: [
      'B4',
      'B3',
      'B2'
    ],

    min: 0,
    max: 0.3
  },

  'RGB 2025 Sentinel-2'
);


// ============================================================
// 36. NDVI 2016
// ============================================================

Map.addLayer(

  composite2016.select(
    'NDVI'
  ),

  {

    min: -0.2,
    max: 0.8,

    palette: [
      '#8B0000',
      '#FF4500',
      '#FFD700',
      '#90EE90',
      '#228B22',
      '#006400'
    ]

  },

  '🌿 NDVI 2016'
);


// ============================================================
// 37. NDVI 2025
// ============================================================

Map.addLayer(

  composite2025.select(
    'NDVI'
  ),

  {

    min: -0.2,
    max: 0.8,

    palette: [
      '#8B0000',
      '#FF4500',
      '#FFD700',
      '#90EE90',
      '#228B22',
      '#006400'
    ]

  },

  '🌿 NDVI 2025'
);


// ============================================================
// 38. MNDWI 2025
// ============================================================

Map.addLayer(

  composite2025.select(
    'MNDWI'
  ),

  {

    min: -0.5,
    max: 0.7,

    palette: [
      '#8B4513',
      '#F4A460',
      '#FFFFCC',
      '#87CEEB',
      '#00BFFF',
      '#00008B'
    ]

  },

  '🔵 MNDWI 2025'
);


// ============================================================
// 39. BSI 2025
// ============================================================

Map.addLayer(

  composite2025.select(
    'BSI'
  ),

  {

    min: -0.5,
    max: 0.5,

    palette: [
      '#006400',
      '#90EE90',
      '#FFFF00',
      '#FFA500',
      '#A0522D',
      '#8B0000'
    ]

  },

  '🟤 BSI 2025'
);


// ============================================================
// 40. NDTI 2025
// ============================================================

Map.addLayer(

  composite2025.select(
    'NDTI'
  ),

  {

    min: -0.4,
    max: 0.4,

    palette: [
      '#00008B',
      '#00BFFF',
      '#00FFFF',
      '#FFFF00',
      '#FFA500',
      '#FF0000',
      '#8B0000'
    ]

  },

  '🟠 NDTI 2025'
);


// ============================================================
// 41. TSM 2025
// ============================================================

Map.addLayer(

  composite2025.select(
    'TSM'
  ),

  {

    min: 0.5,
    max: 2.0,

    palette: [
      '#00008B',
      '#00BFFF',
      '#00FFFF',
      '#FFFF00',
      '#FFA500',
      '#FF0000'
    ]

  },

  '🔴 TSM Proxy 2025'
);


// ============================================================
// 42. CREATE HEALTH MAP FOR 2025
// ============================================================

// Normalize 2025 image using annual temporal ranges.

var ndviMapScore =
  normalize(
    composite2025.select(
      'NDVI'
    ),
    NDVImin,
    NDVImax
  );


var mndwiMapScore =
  normalize(
    composite2025.select(
      'MNDWI'
    ),
    MNDWImin,
    MNDWImax
  );


var bsiMapScore =
  ee.Image(100)
    .subtract(
      normalize(
        composite2025.select(
          'BSI'
        ),
        BSImin,
        BSImax
      )
    );


var ndtiMapScore =
  ee.Image(100)
    .subtract(
      normalize(
        composite2025.select(
          'NDTI'
        ),
        NDTImin,
        NDTImax
      )
    );


var tsmMapScore =
  ee.Image(100)
    .subtract(
      normalize(
        composite2025.select(
          'TSM'
        ),
        TSMmin,
        TSMmax
      )
    );


var healthMap2025 =
  ndviMapScore
    .add(
      mndwiMapScore
    )
    .add(
      bsiMapScore
    )
    .add(
      ndtiMapScore
    )
    .add(
      tsmMapScore
    )
    .divide(5)
    .rename(
      'River_Health'
    )
    .clip(
      ROI
    );


// ============================================================
// 43. HEALTH MAP 2025
// ============================================================

Map.addLayer(

  healthMap2025,

  {

    min: 0,
    max: 100,

    palette: [
      '#8B0000',
      '#FF0000',
      '#FFA500',
      '#FFFF00',
      '#90EE90',
      '#00A000',
      '#006400'
    ]

  },

  '🌊 RIVER HEALTH SCORE 2025'
);


// ============================================================
// 44. HEALTH LEGEND
// ============================================================

var legend =
  ui.Panel({

    style: {
      position:
        'bottom-left',

      padding:
        '8px 15px'
    }
  });


var legendTitle =
  ui.Label({

    value:
      '🌊 River Health 2025',

    style: {
      fontWeight:
        'bold',

      fontSize:
        '16px',

      margin:
        '0 0 6px 0'
    }
  });


legend.add(
  legendTitle
);


var legendNames = [
  '0-20 Critical',
  '20-40 Poor',
  '40-60 Moderate',
  '60-80 Good',
  '80-100 Excellent'
];


var legendColors = [
  '#8B0000',
  '#FF0000',
  '#FFA500',
  '#FFFF00',
  '#006400'
];


for (
  var i = 0;
  i < legendNames.length;
  i++
) {

  var colorBox =
    ui.Label({

      style: {

        backgroundColor:
          legendColors[i],

        padding:
          '8px',

        margin:
          '0 6px 4px 0'
      }
    });


  var description =
    ui.Label({

      value:
        legendNames[i],

      style: {
        margin:
          '0 0 4px 0'
      }
    });


  legend.add(

    ui.Panel({

      widgets: [
        colorBox,
        description
      ],

      layout:
        ui.Panel.Layout.Flow(
          'horizontal'
        )
    })
  );
}


Map.add(
  legend
);


// ============================================================
// 45. EXPORT ANNUAL HEALTH DATA
// ============================================================

Export.table.toDrive({

  collection:
    healthStats,

  description:
    'Maheshwar_Narmada_River_Health_2016_2025',

  folder:
    'Maheshwar_Narmada_Research',

  fileNamePrefix:
    'Maheshwar_Narmada_River_Health_2016_2025',

  fileFormat:
    'CSV'
});


// ============================================================
// 46. EXPORT INDEX DATA
// ============================================================

Export.table.toDrive({

  collection:
    annualStats,

  description:
    'Maheshwar_Annual_River_Indices_2016_2025',

  folder:
    'Maheshwar_Narmada_Research',

  fileNamePrefix:
    'Maheshwar_Annual_River_Indices_2016_2025',

  fileFormat:
    'CSV'
});


// ============================================================
// 47. EXPORT 2016 VS 2025
// ============================================================

Export.table.toDrive({

  collection:
    comparison2025,

  description:
    'Maheshwar_2016_2025_Comparison',

  folder:
    'Maheshwar_Narmada_Research',

  fileNamePrefix:
    'Maheshwar_2016_2025_Comparison',

  fileFormat:
    'CSV'
});


// ============================================================
// 48. EXPORT CORRELATION
// ============================================================

Export.table.toDrive({

  collection:
    correlationTable,

  description:
    'Maheshwar_Ecological_Correlation_2016_2025',

  folder:
    'Maheshwar_Narmada_Research',

  fileNamePrefix:
    'Maheshwar_Ecological_Correlation_2016_2025',

  fileFormat:
    'CSV'
});


// ============================================================
// 49. EXPORT 2025 HEALTH MAP
// ============================================================

Export.image.toDrive({

  image:
    healthMap2025,

  description:
    'Maheshwar_River_Health_Map_2025',

  folder:
    'Maheshwar_Narmada_Research',

  fileNamePrefix:
    'Maheshwar_River_Health_Map_2025',

  region:
    ROI,

  scale:
    30,

  maxPixels:
    1e9
});


// ============================================================
// 50. EXPORT 2025 NDVI
// ============================================================

Export.image.toDrive({

  image:
    composite2025.select(
      'NDVI'
    ),

  description:
    'Maheshwar_NDVI_2025',

  folder:
    'Maheshwar_Narmada_Research',

  fileNamePrefix:
    'Maheshwar_NDVI_2025',

  region:
    ROI,

  scale:
    30,

  maxPixels:
    1e9
});


// ============================================================
// 51. EXPORT 2025 MNDWI
// ============================================================

Export.image.toDrive({

  image:
    composite2025.select(
      'MNDWI'
    ),

  description:
    'Maheshwar_MNDWI_2025',

  folder:
    'Maheshwar_Narmada_Research',

  fileNamePrefix:
    'Maheshwar_MNDWI_2025',

  region:
    ROI,

  scale:
    30,

  maxPixels:
    1e9
});


// ============================================================
// 52. FINAL SUMMARY
// ============================================================

print(
  '============================================================'
);

print(
  '🌊 MAHESHWAR GHAT — NARMADA RIVER HEALTH MONITORING'
);

print(
  '============================================================'
);

print(
  '📍 Latitude: 22.1773'
);

print(
  '📍 Longitude: 75.5830'
);

print(
  '📏 Study area: 2 km'
);

print(
  '📅 Analysis period: 2016-2025'
);

print(
  '🛰 2016 sensor: Landsat 8'
);

print(
  '🛰 2017-2025 sensor: Sentinel-2'
);

print(
  '------------------------------------------------------------'
);

print(
  '🌿 NDVI = vegetation condition'
);

print(
  '🔵 MNDWI = water signal'
);

print(
  '🟤 BSI = exposed/bare surface'
);

print(
  '🟠 NDTI = turbidity proxy'
);

print(
  '🔴 TSM = suspended-material proxy'
);

print(
  '------------------------------------------------------------'
);

print(
  '🌊 River Health Score = 0-100'
);

print(
  '80-100 = Excellent'
);

print(
  '60-80  = Good'
);

print(
  '40-60  = Moderate'
);

print(
  '20-40  = Poor'
);

print(
  '0-20   = Critical'
);

print(
  '------------------------------------------------------------'
);

print(
  '✓ Annual index statistics'
);

print(
  '✓ River health score'
);

print(
  '✓ Health classification'
);

print(
  '✓ 2016-2025 health trend'
);

print(
  '✓ 2016 vs 2025 comparison'
);

print(
  '✓ Percentage change'
);

print(
  '✓ Ecological correlations'
);

print(
  '✓ Scatter plots'
);

print(
  '✓ NDVI maps'
);

print(
  '✓ MNDWI maps'
);

print(
  '✓ BSI maps'
);

print(
  '✓ NDTI maps'
);

print(
  '✓ TSM maps'
);

print(
  '✓ 2025 river-health map'
);

print(
  '✓ CSV exports'
);

print(
  '============================================================'
);

print(
  'IMPORTANT: River Health Score is a relative satellite-derived'
);

print(
  'indicator and should NOT be interpreted as laboratory water'
);

print(
  'quality or an official regulatory water-quality classification.'
);

print(
  '============================================================'
);








=====================**************************======================================



  /***************************************************************
================================================================
 MAHESHWAR GHAT — NARMADA RIVER
 RIVER HEALTH MONITORING & ECOLOGICAL RELATIONSHIP ANALYSIS
 PERIOD: 2016–2025
================================================================

 LOCATION
 Latitude  : 22.1773
 Longitude : 75.5830

 STUDY AREA
 2 km buffer around Maheshwar Ghat

 DATASET
 COPERNICUS/S2_SR_HARMONIZED

 INDICES
 NDVI  = Vegetation condition
 BSI   = Bare / exposed surface
 MNDWI = Water signal
 NDTI  = Turbidity proxy
 TSM   = Suspended-material spectral proxy

 ECOLOGICAL RELATIONSHIPS

 1. NDVI  vs BSI
 2. BSI   vs NDTI
 3. NDTI  vs TSM
 4. MNDWI vs NDTI
 5. NDVI  vs MNDWI
 6. NDVI  vs NDTI
 7. BSI   vs MNDWI
 8. MNDWI vs TSM

 OUTPUTS

 ✓ Monthly statistics 2016–2025
 ✓ Annual statistics 2016–2025
 ✓ 2016 → 2025 comparison
 ✓ Absolute change
 ✓ Relative % change
 ✓ Annual River Health Score
 ✓ River Health classification
 ✓ Correlation table
 ✓ Correlation matrix
 ✓ Correlation chart
 ✓ Annual trend charts
 ✓ Monthly trend charts
 ✓ Monthly % change
 ✓ Ecological scatter plots
 ✓ 2016 maps
 ✓ 2025 maps
 ✓ River Health map
 ✓ CSV exports

 IMPORTANT
 TSM is a spectral proxy, NOT laboratory TSM mg/L.
 NDTI is a turbidity proxy, NOT direct NTU measurement.

================================================================
***************************************************************/


// ============================================================
// 1. MAHESHWAR GHAT LOCATION
// ============================================================

var maheshwarPoint = ee.Geometry.Point([
  75.5830,
  22.1773
]);


// 2 km study area
var ROI = maheshwarPoint
  .buffer(2000)
  .bounds();


// Map
Map.centerObject(
  ROI,
  13
);


// Study area
Map.addLayer(
  ROI,
  {
    color: 'red'
  },
  'Maheshwar Study Area'
);


// Ghat point
Map.addLayer(
  maheshwarPoint,
  {
    color: 'yellow'
  },
  'Maheshwar Ghat'
);


// ============================================================
// 2. ANALYSIS YEARS
// ============================================================

var START_YEAR = 2016;
var END_YEAR   = 2025;


// ============================================================
// 3. SENTINEL-2 DATA
// ============================================================

var s2 = ee.ImageCollection(
  'COPERNICUS/S2_SR_HARMONIZED'
)
.filterBounds(
  ROI
)
.filterDate(
  '2016-01-01',
  '2026-01-01'
)
.filter(
  ee.Filter.lte(
    'CLOUDY_PIXEL_PERCENTAGE',
    70
  )
);


print(
  '================================================'
);

print(
  'SENTINEL-2 DATA'
);

print(
  'Total Sentinel-2 images:',
  s2.size()
);

print(
  '================================================'
);


// ============================================================
// 4. CLOUD / SHADOW MASK
// ============================================================

function maskS2(image) {

  var scl = image.select(
    'SCL'
  );

  /*
  SCL classes used:

  4 = Vegetation
  5 = Bare soil
  6 = Water
  7 = Unclassified

  Excluded:

  0 = No data
  1 = Saturated
  2 = Dark pixels
  3 = Cloud shadow
  8 = Cloud medium probability
  9 = Cloud high probability
  10 = Cirrus
  11 = Snow/Ice
  */

  var mask = scl.eq(4)
    .or(scl.eq(5))
    .or(scl.eq(6))
    .or(scl.eq(7));

  return image
    .updateMask(mask)
    .divide(10000)
    .copyProperties(
      image,
      [
        'system:time_start'
      ]
    );
}


// ============================================================
// 5. ADD ECOLOGICAL INDICES
// ============================================================

function addIndices(image) {

  var blue = image.select(
    'B2'
  );

  var green = image.select(
    'B3'
  );

  var red = image.select(
    'B4'
  );

  var nir = image.select(
    'B8'
  );

  var swir1 = image.select(
    'B11'
  );


  // ----------------------------------------------------------
  // NDVI
  // ----------------------------------------------------------

  var NDVI = nir
    .subtract(red)
    .divide(
      nir.add(red).max(0.0001)
    )
    .rename(
      'NDVI'
    );


  // ----------------------------------------------------------
  // BSI
  // ----------------------------------------------------------

  var BSI = swir1
    .add(red)
    .subtract(
      nir.add(blue)
    )
    .divide(
      swir1
        .add(red)
        .add(nir)
        .add(blue)
        .max(0.0001)
    )
    .rename(
      'BSI'
    );


  // ----------------------------------------------------------
  // MNDWI
  // ----------------------------------------------------------

  var MNDWI = green
    .subtract(swir1)
    .divide(
      green.add(swir1).max(0.0001)
    )
    .rename(
      'MNDWI'
    );


  // ----------------------------------------------------------
  // NDTI
  // ----------------------------------------------------------

  var NDTI = red
    .subtract(green)
    .divide(
      red.add(green).max(0.0001)
    )
    .rename(
      'NDTI'
    );


  // ----------------------------------------------------------
  // TSM SPECTRAL PROXY
  // ----------------------------------------------------------

  var TSM = red
    .divide(
      green.max(0.0001)
    )
    .rename(
      'TSM'
    );


  return image
    .addBands(NDVI)
    .addBands(BSI)
    .addBands(MNDWI)
    .addBands(NDTI)
    .addBands(TSM);
}


// ============================================================
// 6. PROCESS DATA
// ============================================================

var indexed = s2
  .map(maskS2)
  .map(addIndices);


print(
  'Indexed Sentinel-2 collection:',
  indexed
);


// ============================================================
// 7. MONTH LIST
// ============================================================

var months = ee.List.sequence(
  1,
  12
);


// ============================================================
// 8. MAKE MONTHLY COMPOSITE
// ============================================================

function makeMonthlyImage(
  year,
  month
) {

  year = ee.Number(year);

  month = ee.Number(month);


  var start = ee.Date.fromYMD(
    year,
    month,
    1
  );

  var end = start.advance(
    1,
    'month'
  );


  var collection =
    indexed.filterDate(
      start,
      end
    );


  var count =
    collection.size();


  // Empty image with required bands
  var empty = ee.Image.constant([
    0,
    0,
    0,
    0,
    0
  ])
  .rename([
    'NDVI',
    'BSI',
    'MNDWI',
    'NDTI',
    'TSM'
  ])
  .updateMask(
    ee.Image(0)
  );


  var composite = ee.Image(
    ee.Algorithms.If(
      count.gt(0),
      collection.median(),
      empty
    )
  );


  return composite
    .clip(ROI)
    .set(
      'year',
      year
    )
    .set(
      'month',
      month
    )
    .set(
      'image_count',
      count
    )
    .set(
      'date',
      start.millis()
    );
}


// ============================================================
// 9. CREATE 2016–2025 MONTHLY COLLECTION
// ============================================================

var years = ee.List.sequence(
  START_YEAR,
  END_YEAR
);


var monthlyImages =
  ee.ImageCollection.fromImages(

    years.map(
      function(year) {

        return months.map(
          function(month) {

            return makeMonthlyImage(
              year,
              month
            );

          }
        );

      }
    ).flatten()

  );


print(
  'Monthly composite collection:',
  monthlyImages
);


// ============================================================
// 10. IMAGE → FEATURE
// ============================================================

function imageToFeature(
  image
) {

  var stats = image
    .select([
      'NDVI',
      'BSI',
      'MNDWI',
      'NDTI',
      'TSM'
    ])
    .reduceRegion({

      reducer:
        ee.Reducer.mean(),

      geometry:
        ROI,

      scale:
        10,

      bestEffort:
        true,

      maxPixels:
        1e9

    });


  return ee.Feature(
    null,
    {

      year:
        image.get(
          'year'
        ),

      month:
        image.get(
          'month'
        ),

      date:
        image.get(
          'date'
        ),

      image_count:
        image.get(
          'image_count'
        ),

      NDVI:
        stats.get(
          'NDVI'
        ),

      BSI:
        stats.get(
          'BSI'
        ),

      MNDWI:
        stats.get(
          'MNDWI'
        ),

      NDTI:
        stats.get(
          'NDTI'
        ),

      TSM:
        stats.get(
          'TSM'
        )

    }
  );
}


// ============================================================
// 11. MONTHLY STATISTICS
// ============================================================

var monthlyStats =
  ee.FeatureCollection(
    monthlyImages.map(
      imageToFeature
    )
  );


print(
  '================================================'
);

print(
  'MONTHLY STATISTICS 2016–2025'
);

print(
  monthlyStats
);

print(
  '================================================'
);


// ============================================================
// 12. ANNUAL STATISTICS
// ============================================================

function makeAnnualFeature(
  year
) {

  year = ee.Number(year);


  var annualCollection =
    indexed.filterDate(

      ee.Date.fromYMD(
        year,
        1,
        1
      ),

      ee.Date.fromYMD(
        year.add(1),
        1,
        1
      )

    );


  var composite =
    annualCollection.median();


  var stats =
    composite
      .select([
        'NDVI',
        'BSI',
        'MNDWI',
        'NDTI',
        'TSM'
      ])
      .reduceRegion({

        reducer:
          ee.Reducer.mean(),

        geometry:
          ROI,

        scale:
          10,

        bestEffort:
          true,

        maxPixels:
          1e9

      });


  return ee.Feature(
    null,
    {

      year:
        year,

      image_count:
        annualCollection.size(),

      NDVI:
        stats.get(
          'NDVI'
        ),

      BSI:
        stats.get(
          'BSI'
        ),

      MNDWI:
        stats.get(
          'MNDWI'
        ),

      NDTI:
        stats.get(
          'NDTI'
        ),

      TSM:
        stats.get(
          'TSM'
        )

    }
  );
}


var annualStats =
  ee.FeatureCollection(
    years.map(
      makeAnnualFeature
    )
  );


print(
  '================================================'
);

print(
  'ANNUAL STATISTICS 2016–2025'
);

print(
  annualStats
);

print(
  '================================================'
);


// ============================================================
// 13. 2016 vs 2025 COMPARISON
// ============================================================

var f2016 =
  ee.Feature(
    annualStats
      .filter(
        ee.Filter.eq(
          'year',
          2016
        )
      )
      .first()
  );


var f2025 =
  ee.Feature(
    annualStats
      .filter(
        ee.Filter.eq(
          'year',
          2025
        )
      )
      .first()
  );


// ============================================================
// 14. RELATIVE CHANGE FUNCTION
// ============================================================

function percentageChange(
  oldValue,
  newValue
) {

  oldValue =
    ee.Number(oldValue);

  newValue =
    ee.Number(newValue);


  return ee.Algorithms.If(

    oldValue
      .abs()
      .gt(0.000001),

    newValue
      .subtract(oldValue)
      .divide(
        oldValue.abs()
      )
      .multiply(100),

    null

  );
}


// ============================================================
// 15. 2016 → 2025 COMPARISON TABLE
// ============================================================

var comparison2025 =
  ee.FeatureCollection([

    ee.Feature(
      null,
      {

        index:
          'NDVI',

        value_2016:
          f2016.get('NDVI'),

        value_2025:
          f2025.get('NDVI'),

        absolute_change:
          ee.Number(
            f2025.get('NDVI')
          )
          .subtract(
            ee.Number(
              f2016.get('NDVI')
            )
          ),

        relative_change_pct:
          percentageChange(
            f2016.get('NDVI'),
            f2025.get('NDVI')
          )

      }
    ),

    ee.Feature(
      null,
      {

        index:
          'BSI',

        value_2016:
          f2016.get('BSI'),

        value_2025:
          f2025.get('BSI'),

        absolute_change:
          ee.Number(
            f2025.get('BSI')
          )
          .subtract(
            ee.Number(
              f2016.get('BSI')
            )
          ),

        relative_change_pct:
          percentageChange(
            f2016.get('BSI'),
            f2025.get('BSI')
          )

      }
    ),

    ee.Feature(
      null,
      {

        index:
          'MNDWI',

        value_2016:
          f2016.get('MNDWI'),

        value_2025:
          f2025.get('MNDWI'),

        absolute_change:
          ee.Number(
            f2025.get('MNDWI')
          )
          .subtract(
            ee.Number(
              f2016.get('MNDWI')
            )
          ),

        relative_change_pct:
          percentageChange(
            f2016.get('MNDWI'),
            f2025.get('MNDWI')
          )

      }
    ),

    ee.Feature(
      null,
      {

        index:
          'NDTI',

        value_2016:
          f2016.get('NDTI'),

        value_2025:
          f2025.get('NDTI'),

        absolute_change:
          ee.Number(
            f2025.get('NDTI')
          )
          .subtract(
            ee.Number(
              f2016.get('NDTI')
            )
          ),

        relative_change_pct:
          percentageChange(
            f2016.get('NDTI'),
            f2025.get('NDTI')
          )

      }
    ),

    ee.Feature(
      null,
      {

        index:
          'TSM',

        value_2016:
          f2016.get('TSM'),

        value_2025:
          f2025.get('TSM'),

        absolute_change:
          ee.Number(
            f2025.get('TSM')
          )
          .subtract(
            ee.Number(
              f2016.get('TSM')
            )
          ),

        relative_change_pct:
          percentageChange(
            f2016.get('TSM'),
            f2025.get('TSM')
          )

      }
    )

  ]);


print(
  '================================================'
);

print(
  '2016 → 2025 RIVER CONDITION CHANGE'
);

print(
  comparison2025
);

print(
  '================================================'
);


// ============================================================
// 16. RIVER HEALTH SCORE
// ============================================================

/*
 HEALTH LOGIC

 Positive indicators:
 NDVI
 MNDWI

 Higher = generally better

 Negative indicators:
 BSI
 NDTI
 TSM

 Higher = generally worse

 NOTE:
 This is a relative remote-sensing health indicator.
 It is NOT an official water-quality index.
*/


var annualValid =
  annualStats.filter(
    ee.Filter.notNull([
      'NDVI',
      'BSI',
      'MNDWI',
      'NDTI',
      'TSM'
    ])
  );


var ndviMin =
  ee.Number(
    annualValid.aggregate_min(
      'NDVI'
    )
  );

var ndviMax =
  ee.Number(
    annualValid.aggregate_max(
      'NDVI'
    )
  );


var bsiMin =
  ee.Number(
    annualValid.aggregate_min(
      'BSI'
    )
  );

var bsiMax =
  ee.Number(
    annualValid.aggregate_max(
      'BSI'
    )
  );


var mndwiMin =
  ee.Number(
    annualValid.aggregate_min(
      'MNDWI'
    )
  );

var mndwiMax =
  ee.Number(
    annualValid.aggregate_max(
      'MNDWI'
    )
  );


var ndtiMin =
  ee.Number(
    annualValid.aggregate_min(
      'NDTI'
    )
  );

var ndtiMax =
  ee.Number(
    annualValid.aggregate_max(
      'NDTI'
    )
  );


var tsmMin =
  ee.Number(
    annualValid.aggregate_min(
      'TSM'
    )
  );

var tsmMax =
  ee.Number(
    annualValid.aggregate_max(
      'TSM'
    )
  );


// Safe normalization
function normalize(
  value,
  minimum,
  maximum
) {

  return ee.Number(
    value
  )
  .subtract(minimum)
  .divide(
    maximum
      .subtract(minimum)
      .max(0.000001)
  )
  .clamp(
    0,
    1
  );
}


var healthScores =
  annualValid.map(

    function(f) {

      var ndviN =
        normalize(
          f.get('NDVI'),
          ndviMin,
          ndviMax
        );


      var bsiN =
        normalize(
          f.get('BSI'),
          bsiMin,
          bsiMax
        );


      var mndwiN =
        normalize(
          f.get('MNDWI'),
          mndwiMin,
          mndwiMax
        );


      var ndtiN =
        normalize(
          f.get('NDTI'),
          ndtiMin,
          ndtiMax
        );


      var tsmN =
        normalize(
          f.get('TSM'),
          tsmMin,
          tsmMax
        );


      // Higher NDVI and MNDWI = better
      // Lower BSI, NDTI and TSM = better

      var health =
        ndviN
          .add(mndwiN)
          .add(
            ee.Number(1)
              .subtract(bsiN)
          )
          .add(
            ee.Number(1)
              .subtract(ndtiN)
          )
          .add(
            ee.Number(1)
              .subtract(tsmN)
          )
          .divide(5)
          .multiply(100);


      var classification =
        ee.Algorithms.If(
          health.gte(75),
          'Healthy',
          ee.Algorithms.If(
            health.gte(50),
            'Moderate',
            ee.Algorithms.If(
              health.gte(25),
              'Poor',
              'Very Poor'
            )
          )
        );


      return f
        .set(
          'NDVI_normalized',
          ndviN
        )
        .set(
          'BSI_normalized',
          bsiN
        )
        .set(
          'MNDWI_normalized',
          mndwiN
        )
        .set(
          'NDTI_normalized',
          ndtiN
        )
        .set(
          'TSM_normalized',
          tsmN
        )
        .set(
          'River_Health_Score',
          health
        )
        .set(
          'Health_Class',
          classification
        );

    }

  );


print(
  '================================================'
);

print(
  'ANNUAL RIVER HEALTH SCORE'
);

print(
  healthScores
);

print(
  '================================================'
);


// ============================================================
// 17. 2016 vs 2025 HEALTH COMPARISON
// ============================================================

var health2016 =
  ee.Feature(
    healthScores
      .filter(
        ee.Filter.eq(
          'year',
          2016
        )
      )
      .first()
  );


var health2025 =
  ee.Feature(
    healthScores
      .filter(
        ee.Filter.eq(
          'year',
          2025
        )
      )
      .first()
  );


var healthChange =
  ee.FeatureCollection([

    ee.Feature(
      null,
      {

        metric:
          'River Health Score',

        score_2016:
          health2016.get(
            'River_Health_Score'
          ),

        score_2025:
          health2025.get(
            'River_Health_Score'
          ),

        change:
          ee.Number(
            health2025.get(
              'River_Health_Score'
            )
          )
          .subtract(
            ee.Number(
              health2016.get(
                'River_Health_Score'
              )
            )
          ),

        change_pct:
          percentageChange(
            health2016.get(
              'River_Health_Score'
            ),
            health2025.get(
              'River_Health_Score'
            )
          ),

        class_2016:
          health2016.get(
            'Health_Class'
          ),

        class_2025:
          health2025.get(
            'Health_Class'
          )

      }
    )

  ]);


print(
  '================================================'
);

print(
  'RIVER HEALTH 2016 → 2025'
);

print(
  healthChange
);

print(
  '================================================'
);


// ============================================================
// 18. CORRELATION FUNCTION
// ============================================================

function getCorrelation(
  collection,
  x,
  y
) {

  var valid =
    collection.filter(
      ee.Filter.notNull([
        x,
        y
      ])
    );


  var result =
    valid.reduceColumns({

      reducer:
        ee.Reducer
          .pearsonsCorrelation(),

      selectors: [
        x,
        y
      ]

    });


  return result.get(
    'correlation'
  );
}


// ============================================================
// 19. ECOLOGICAL RELATIONSHIPS
// ============================================================

var relationships = [

  [
    'NDVI',
    'BSI',
    'NDVI vs BSI'
  ],

  [
    'BSI',
    'NDTI',
    'BSI vs NDTI'
  ],

  [
    'NDTI',
    'TSM',
    'NDTI vs TSM'
  ],

  [
    'MNDWI',
    'NDTI',
    'MNDWI vs NDTI'
  ],

  [
    'NDVI',
    'MNDWI',
    'NDVI vs MNDWI'
  ],

  [
    'NDVI',
    'NDTI',
    'NDVI vs NDTI'
  ],

  [
    'BSI',
    'MNDWI',
    'BSI vs MNDWI'
  ],

  [
    'MNDWI',
    'TSM',
    'MNDWI vs TSM'
  ]

];


// ============================================================
// 20. CORRELATION TABLE 2016–2025
// ============================================================

var correlationTable =
  ee.FeatureCollection(

    relationships.map(

      function(pair) {

        var r =
          getCorrelation(
            monthlyStats,
            pair[0],
            pair[1]
          );


        var r2016 =
          getCorrelation(
            monthlyStats.filter(
              ee.Filter.eq(
                'year',
                2016
              )
            ),
            pair[0],
            pair[1]
          );


        var r2025 =
          getCorrelation(
            monthlyStats.filter(
              ee.Filter.eq(
                'year',
                2025
              )
            ),
            pair[0],
            pair[1]
          );


        return ee.Feature(
          null,
          {

            relationship:
              pair[2],

            variable_x:
              pair[0],

            variable_y:
              pair[1],

            correlation_2016_2025:
              r,

            correlation_2016:
              r2016,

            correlation_2025:
              r2025,

            correlation_change:
              ee.Number(r2025)
                .subtract(
                  ee.Number(r2016)
                )

          }
        );

      }

    )

  );


print(
  '================================================'
);

print(
  'ECOLOGICAL CORRELATION TABLE'
);

print(
  correlationTable
);

print(
  '================================================'
);


// ============================================================
// 21. CORRELATION CHART
// ============================================================

var correlationChart =
  ui.Chart.feature.byFeature({

    features:
      correlationTable,

    xProperty:
      'relationship',

    yProperties: [

      'correlation_2016_2025',

      'correlation_2016',

      'correlation_2025'

    ]

  })
  .setChartType(
    'ColumnChart'
  )
  .setOptions({

    title:
      'Maheshwar Ghat — Ecological Relationships 2016–2025',

    subtitle:
      'Pearson correlation coefficient',

    chartArea: {

      left: 75,
      right: 30,
      top: 70,
      bottom: 130

    },

    hAxis: {

      title:
        'Ecological Relationship',

      slantedText:
        true,

      slantedTextAngle:
        40

    },

    vAxis: {

      title:
        'Correlation (r)',

      viewWindow: {

        min: -1,
        max: 1

      },

      baseline:
        0

    },

    colors: [

      '#1565C0',
      '#43A047',
      '#E53935'

    ],

    legend: {

      position:
        'bottom'

    },

    bar: {

      groupWidth:
        '70%'

    }

  });


print(
  correlationChart
);


// ============================================================
// 22. ANNUAL RIVER HEALTH TREND
// ============================================================

var healthChart =
  ui.Chart.feature.byFeature({

    features:
      healthScores,

    xProperty:
      'year',

    yProperties: [
      'River_Health_Score'
    ]

  })
  .setChartType(
    'LineChart'
  )
  .setOptions({

    title:
      '🌊 Maheshwar Ghat River Health — 2016–2025',

    hAxis: {

      title:
        'Year',

      format:
        '####'

    },

    vAxis: {

      title:
        'River Health Score (0–100)',

      viewWindow: {

        min: 0,
        max: 100

      }

    },

    colors: [
      '#00897B'
    ],

    lineWidth:
      4,

    pointSize:
      7,

    legend: {
      position:
        'none'
    }

  });


print(
  healthChart
);


// ============================================================
// 23. ANNUAL INDEX TREND FUNCTION
// ============================================================

function annualTrendChart(
  property,
  title,
  yTitle
) {

  var chart =
    ui.Chart.feature.byFeature({

      features:
        annualStats,

      xProperty:
        'year',

      yProperties:
        [property]

    })
    .setChartType(
      'LineChart'
    )
    .setOptions({

      title:
        title,

      hAxis: {

        title:
          'Year',

        format:
          '####'

      },

      vAxis: {

        title:
          yTitle

      },

      lineWidth:
        4,

      pointSize:
        6,

      legend: {
        position:
          'none'
      }

    });


  print(
    chart
  );
}


// ============================================================
// 24. ANNUAL INDEX CHARTS
// ============================================================

annualTrendChart(
  'NDVI',
  '🌿 Annual NDVI — Maheshwar 2016–2025',
  'Mean NDVI'
);


annualTrendChart(
  'BSI',
  '🟤 Annual BSI — Maheshwar 2016–2025',
  'Mean BSI'
);


annualTrendChart(
  'MNDWI',
  '🔵 Annual MNDWI — Maheshwar 2016–2025',
  'Mean MNDWI'
);


annualTrendChart(
  'NDTI',
  '🟠 Annual NDTI — Maheshwar 2016–2025',
  'NDTI Turbidity Proxy'
);


annualTrendChart(
  'TSM',
  '🔴 Annual TSM Proxy — Maheshwar 2016–2025',
  'TSM Spectral Proxy'
);


// ============================================================
// 25. TWO-YEAR / DECADE MONTHLY TREND
// ============================================================

function monthlyTrendChart(
  property,
  title,
  yTitle
) {

  var chart =
    ui.Chart.feature.groups({

      features:
        monthlyStats.filter(
          ee.Filter.notNull([
            property
          ])
        ),

      xProperty:
        'month',

      yProperty:
        property,

      seriesProperty:
        'year'

    })
    .setChartType(
      'LineChart'
    )
    .setOptions({

      title:
        title,

      hAxis: {

        title:
          'Month',

        ticks: [
          1,2,3,4,5,6,
          7,8,9,10,11,12
        ]

      },

      vAxis: {

        title:
          yTitle

      },

      lineWidth:
        2,

      pointSize:
        3,

      legend: {

        position:
          'right'

      }

    });


  print(
    chart
  );
}


// ============================================================
// 26. MONTHLY TREND CHARTS
// ============================================================

monthlyTrendChart(
  'NDVI',
  '🌿 Monthly NDVI — 2016–2025',
  'NDVI'
);


monthlyTrendChart(
  'BSI',
  '🟤 Monthly BSI — 2016–2025',
  'BSI'
);


monthlyTrendChart(
  'MNDWI',
  '🔵 Monthly MNDWI — 2016–2025',
  'MNDWI'
);


monthlyTrendChart(
  'NDTI',
  '🟠 Monthly NDTI — 2016–2025',
  'NDTI'
);


monthlyTrendChart(
  'TSM',
  '🔴 Monthly TSM Proxy — 2016–2025',
  'TSM Proxy'
);


// ============================================================
// 27. SCATTER PLOT FUNCTION
// ============================================================

function scatterChart(
  x,
  y,
  title,
  xTitle,
  yTitle
) {

  var data =
    monthlyStats.filter(
      ee.Filter.notNull([
        x,
        y
      ])
    );


  var chart =
    ui.Chart.feature.byFeature({

      features:
        data,

      xProperty:
        x,

      yProperties:
        [y]

    })
    .setChartType(
      'ScatterChart'
    )
    .setOptions({

      title:
        title,

      chartArea: {

        left: 80,
        right: 35,
        top: 70,
        bottom: 75

      },

      hAxis: {

        title:
          xTitle

      },

      vAxis: {

        title:
          yTitle

      },

      pointSize:
        6,

      legend: {

        position:
          'none'

      },

      trendlines: {

        0: {

          type:
            'linear',

          lineWidth:
            3,

          showR2:
            true,

          visibleInLegend:
            true

        }

      }

    });


  print(
    chart
  );
}


// ============================================================
// 28. ECOLOGICAL DEPENDENCY SCATTER PLOTS
// ============================================================

scatterChart(

  'NDVI',
  'BSI',

  '🌿 NDVI vs BSI — Vegetation / Exposed Surface',

  'NDVI',
  'BSI'

);


scatterChart(

  'BSI',
  'NDTI',

  '🟤 BSI vs NDTI — Exposed Surface / Turbidity',

  'BSI',
  'NDTI'

);


scatterChart(

  'NDTI',
  'TSM',

  '🟠 NDTI vs TSM — Turbidity / Suspended Material',

  'NDTI',
  'TSM Proxy'

);


scatterChart(

  'MNDWI',
  'NDTI',

  '🔵 MNDWI vs NDTI — Water Signal / Turbidity',

  'MNDWI',
  'NDTI'

);


scatterChart(

  'NDVI',
  'MNDWI',

  '🌿 NDVI vs MNDWI — Vegetation / Water',

  'NDVI',
  'MNDWI'

);


scatterChart(

  'NDVI',
  'NDTI',

  '🌿 NDVI vs NDTI — Vegetation / Turbidity',

  'NDVI',
  'NDTI'

);


scatterChart(

  'BSI',
  'MNDWI',

  '🟤 BSI vs MNDWI — Bare Surface / Water',

  'BSI',
  'MNDWI'

);


scatterChart(

  'MNDWI',
  'TSM',

  '🔵 MNDWI vs TSM — Water / Suspended Material',

  'MNDWI',
  'TSM Proxy'

);


// ============================================================
// 29. ANNUAL HEALTH MAP FUNCTION
// ============================================================

function annualComposite(
  year
) {

  var collection =
    indexed.filterDate(

      ee.Date.fromYMD(
        year,
        1,
        1
      ),

      ee.Date.fromYMD(
        year + 1,
        1,
        1
      )

    );


  return collection
    .median()
    .clip(ROI);
}


// ============================================================
// 30. 2016 COMPOSITE
// ============================================================

var composite2016 =
  annualComposite(
    2016
  );


// ============================================================
// 31. 2025 COMPOSITE
// ============================================================

var composite2025 =
  annualComposite(
    2025
  );


// ============================================================
// 32. RGB 2016
// ============================================================

Map.addLayer(

  composite2016,

  {

    bands: [
      'B4',
      'B3',
      'B2'
    ],

    min:
      0,

    max:
      0.3

  },

  'RGB — 2016',

  false

);


// ============================================================
// 33. RGB 2025
// ============================================================

Map.addLayer(

  composite2025,

  {

    bands: [
      'B4',
      'B3',
      'B2'
    ],

    min:
      0,

    max:
      0.3

  },

  'RGB — 2025',

  true

);


// ============================================================
// 34. NDVI 2016
// ============================================================

Map.addLayer(

  composite2016.select(
    'NDVI'
  ),

  {

    min:
      -0.2,

    max:
      0.8,

    palette: [

      '#8B0000',
      '#FF4500',
      '#FFD700',
      '#90EE90',
      '#228B22',
      '#006400'

    ]

  },

  '🌿 NDVI — 2016',

  false

);


// ============================================================
// 35. NDVI 2025
// ============================================================

Map.addLayer(

  composite2025.select(
    'NDVI'
  ),

  {

    min:
      -0.2,

    max:
      0.8,

    palette: [

      '#8B0000',
      '#FF4500',
      '#FFD700',
      '#90EE90',
      '#228B22',
      '#006400'

    ]

  },

  '🌿 NDVI — 2025',

  false

);


// ============================================================
// 36. BSI 2025
// ============================================================

Map.addLayer(

  composite2025.select(
    'BSI'
  ),

  {

    min:
      -0.5,

    max:
      0.5,

    palette: [

      '#006400',
      '#90EE90',
      '#FFFF00',
      '#FFA500',
      '#A0522D',
      '#8B0000'

    ]

  },

  '🟤 BSI — 2025',

  false

);


// ============================================================
// 37. MNDWI 2025
// ============================================================

Map.addLayer(

  composite2025.select(
    'MNDWI'
  ),

  {

    min:
      -0.5,

    max:
      0.7,

    palette: [

      '#8B4513',
      '#F4A460',
      '#FFFFCC',
      '#87CEEB',
      '#00BFFF',
      '#00008B'

    ]

  },

  '🔵 MNDWI — 2025',

  false

);


// ============================================================
// 38. NDTI 2025
// ============================================================

Map.addLayer(

  composite2025.select(
    'NDTI'
  ),

  {

    min:
      -0.4,

    max:
      0.4,

    palette: [

      '#00008B',
      '#00BFFF',
      '#00FFFF',
      '#FFFF00',
      '#FFA500',
      '#FF0000',
      '#8B0000'

    ]

  },

  '🟠 NDTI — 2025',

  false

);


// ============================================================
// 39. TSM 2025
// ============================================================

Map.addLayer(

  composite2025.select(
    'TSM'
  ),

  {

    min:
      0.5,

    max:
      1.5,

    palette: [

      '#00008B',
      '#00BFFF',
      '#00FFFF',
      '#FFFF00',
      '#FFA500',
      '#FF0000'

    ]

  },

  '🔴 TSM Proxy — 2025',

  false

);


// ============================================================
// 40. EXPORT MONTHLY DATA
// ============================================================

Export.table.toDrive({

  collection:
    monthlyStats,

  description:
    'Maheshwar_Narmada_2016_2025_MONTHLY_INDICES',

  folder:
    'Maheshwar_Narmada_Research',

  fileNamePrefix:
    'Maheshwar_Narmada_2016_2025_MONTHLY_INDICES',

  fileFormat:
    'CSV'

});


// ============================================================
// 41. EXPORT ANNUAL DATA
// ============================================================

Export.table.toDrive({

  collection:
    healthScores,

  description:
    'Maheshwar_Narmada_2016_2025_ANNUAL_HEALTH',

  folder:
    'Maheshwar_Narmada_Research',

  fileNamePrefix:
    'Maheshwar_Narmada_2016_2025_ANNUAL_HEALTH',

  fileFormat:
    'CSV'

});


// ============================================================
// 42. EXPORT 2016–2025 COMPARISON
// ============================================================

Export.table.toDrive({

  collection:
    comparison2025,

  description:
    'Maheshwar_Narmada_2016_2025_COMPARISON',

  folder:
    'Maheshwar_Narmada_Research',

  fileNamePrefix:
    'Maheshwar_Narmada_2016_2025_COMPARISON',

  fileFormat:
    'CSV'

});


// ============================================================
// 43. EXPORT CORRELATION TABLE
// ============================================================

Export.table.toDrive({

  collection:
    correlationTable,

  description:
    'Maheshwar_Narmada_2016_2025_CORRELATIONS',

  folder:
    'Maheshwar_Narmada_Research',

  fileNamePrefix:
    'Maheshwar_Narmada_2016_2025_CORRELATIONS',

  fileFormat:
    'CSV'

});


// ============================================================
// 44. EXPORT HEALTH CHANGE
// ============================================================

Export.table.toDrive({

  collection:
    healthChange,

  description:
    'Maheshwar_Narmada_2016_2025_HEALTH_CHANGE',

  folder:
    'Maheshwar_Narmada_Research',

  fileNamePrefix:
    'Maheshwar_Narmada_2016_2025_HEALTH_CHANGE',

  fileFormat:
    'CSV'

});


// ============================================================
// 45. FINAL CONSOLE SUMMARY
// ============================================================

print(
  '============================================================'
);

print(
  '🌊 MAHESHWAR GHAT — NARMADA RIVER HEALTH MONITORING'
);

print(
  '============================================================'
);

print(
  '📍 Latitude: 22.1773'
);

print(
  '📍 Longitude: 75.5830'
);

print(
  '📅 Analysis Period: 2016–2025'
);

print(
  '📡 Dataset: Sentinel-2 SR Harmonized'
);

print(
  '📐 Study Area: 2 km around Maheshwar Ghat'
);

print(
  '------------------------------------------------------------'
);

print(
  '🌿 NDVI = Vegetation condition'
);

print(
  '🟤 BSI = Bare/exposed surface'
);

print(
  '🔵 MNDWI = Water signal'
);

print(
  '🟠 NDTI = Turbidity proxy'
);

print(
  '🔴 TSM = Suspended-material spectral proxy'
);

print(
  '------------------------------------------------------------'
);

print(
  'DEPENDENCY / ECOLOGICAL RELATIONSHIPS'
);

print(
  '1. NDVI vs BSI'
);

print(
  '2. BSI vs NDTI'
);

print(
  '3. NDTI vs TSM'
);

print(
  '4. MNDWI vs NDTI'
);

print(
  '5. NDVI vs MNDWI'
);

print(
  '6. NDVI vs NDTI'
);

print(
  '7. BSI vs MNDWI'
);

print(
  '8. MNDWI vs TSM'
);

print(
  '------------------------------------------------------------'
);

print(
  'RIVER HEALTH COMPONENTS'
);

print(
  '✓ Vegetation condition'
);

print(
  '✓ Water signal'
);

print(
  '✓ Bare/exposed surface'
);

print(
  '✓ Turbidity proxy'
);

print(
  '✓ Suspended-material proxy'
);

print(
  '✓ Integrated River Health Score'
);

print(
  '✓ Health classification'
);

print(
  '------------------------------------------------------------'
);

print(
  'COMPARISON'
);

print(
  '✓ 2016 baseline'
);

print(
  '✓ 2025 condition'
);

print(
  '✓ Absolute change'
);

print(
  '✓ Relative percentage change'
);

print(
  '✓ Health score change'
);

print(
  '✓ Correlation change'
);

print(
  '------------------------------------------------------------'
);

print(
  'OUTPUTS'
);

print(
  '✓ Monthly CSV'
);

print(
  '✓ Annual Health CSV'
);

print(
  '✓ 2016–2025 Comparison CSV'
);

print(
  '✓ Correlation CSV'
);

print(
  '✓ Health Change CSV'
);

print(
  '✓ Annual charts'
);

print(
  '✓ Monthly charts'
);

print(
  '✓ Scatter plots'
);

print(
  '✓ RGB maps'
);

print(
  '✓ NDVI maps'
);

print(
  '✓ BSI map'
);

print(
  '✓ MNDWI map'
);

print(
  '✓ NDTI map'
);

print(
  '✓ TSM map'
);

print(
  '============================================================'
);

print(
  'IMPORTANT: TSM and NDTI are remote-sensing proxies.'
);

print(
  'They should not be interpreted as laboratory TSM or NTU'
);

print(
  'without field calibration / validation.'
);

print(
  '============================================================'
);

print(
  '✅ MAHESHWAR 2016–2025 RIVER HEALTH ANALYSIS COMPLETE'
);

print(
  '============================================================'
);
