/***************************************************************
===============================================================
 OMKARESHWAR GHAT — NARMADA RIVER
 RIVER HEALTH MONITORING
 2016–2025
===============================================================

 STUDY:
 Omkareshwar, Madhya Pradesh, India

 INDICES:
 NDVI  = Riparian vegetation
 BSI   = Bare / exposed surface
 MNDWI = Water signal
 NDTI  = Turbidity proxy
 TSM   = Suspended material proxy

 ADDITIONAL:
 CHIRPS rainfall

 ECOLOGICAL RELATIONSHIPS:

 1. NDVI  vs BSI
 2. BSI   vs NDTI
 3. NDTI  vs TSM
 4. MNDWI vs NDTI
 5. NDVI  vs NDTI
 6. MNDWI vs TSM

 YEARS:
 2016–2025

 OUTPUTS:

 ✓ Monthly statistics
 ✓ Annual statistics
 ✓ 2016–2025 comparison
 ✓ Annual percentage change
 ✓ Year-to-year change
 ✓ Correlation analysis
 ✓ Relationship strength
 ✓ Scatter plots
 ✓ Monthly line charts
 ✓ Annual trend charts
 ✓ River health score
 ✓ Colourful maps
 ✓ Monthly CSV
 ✓ Annual CSV
 ✓ Correlation CSV
 ✓ Health score CSV

===============================================================
***************************************************************/


// ============================================================
// 1. OMKARESHWAR GHAT LOCATION
// ============================================================

var omkareshwarPoint = ee.Geometry.Point([
  76.1500,
  22.2400
]);


// ------------------------------------------------------------
// 2 KM STUDY AREA
// ------------------------------------------------------------

var ROI = omkareshwarPoint
  .buffer(2000)
  .bounds();


// ------------------------------------------------------------
// MAP
// ------------------------------------------------------------

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
  'Omkareshwar Study Area'
);


// Ghat point
Map.addLayer(
  omkareshwarPoint,
  {
    color: 'yellow'
  },
  'Omkareshwar Ghat'
);


// ============================================================
// 2. YEARS
// ============================================================

var START_YEAR = 2016;
var END_YEAR   = 2025;


// ============================================================
// 3. SENTINEL-2 COLLECTION
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
  'Sentinel-2 image count:',
  s2.size()
);


// ============================================================
// 4. CLOUD / SHADOW MASK
// ============================================================

function maskS2(image) {

  var scl = image.select('SCL');

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
// 5. ADD SPECTRAL INDICES
// ============================================================

function addIndices(image) {

  var blue = image.select('B2');

  var green = image.select('B3');

  var red = image.select('B4');

  var nir = image.select('B8');

  var swir1 = image.select('B11');


  // ----------------------------------------------------------
  // NDVI
  // ----------------------------------------------------------

  var NDVI = nir
    .subtract(red)
    .divide(
      nir.add(red)
    )
    .rename('NDVI');


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
    )
    .rename('BSI');


  // ----------------------------------------------------------
  // MNDWI
  // ----------------------------------------------------------

  var MNDWI = green
    .subtract(swir1)
    .divide(
      green.add(swir1)
    )
    .rename('MNDWI');


  // ----------------------------------------------------------
  // NDTI
  // ----------------------------------------------------------

  var NDTI = red
    .subtract(green)
    .divide(
      red.add(green)
    )
    .rename('NDTI');


  // ----------------------------------------------------------
  // TSM PROXY
  // ----------------------------------------------------------

  var TSM = red
    .divide(
      green.max(0.0001)
    )
    .rename('TSM');


  return image
    .addBands(NDVI)
    .addBands(BSI)
    .addBands(MNDWI)
    .addBands(NDTI)
    .addBands(TSM);
}


// ============================================================
// 6. PROCESS SENTINEL-2
// ============================================================

var indexed = s2
  .map(maskS2)
  .map(addIndices);


print(
  'Indexed Sentinel-2 collection:',
  indexed
);


// ============================================================
// 7. CHIRPS RAINFALL
// ============================================================

var chirps = ee.ImageCollection(
  'UCSB-CHG/CHIRPS/DAILY'
)
.filterBounds(
  ROI
)
.filterDate(
  '2016-01-01',
  '2026-01-01'
);


print(
  'CHIRPS rainfall image count:',
  chirps.size()
);


// ============================================================
// 8. MONTH LIST
// ============================================================

var months = ee.List.sequence(
  1,
  12
);


// ============================================================
// 9. YEAR LIST
// ============================================================

var years = ee.List.sequence(
  START_YEAR,
  END_YEAR
);


// ============================================================
// 10. EMPTY SENTINEL IMAGE
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
// 11. MONTHLY SENTINEL IMAGE
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


  var collection = indexed
    .filterDate(
      start,
      end
    );


  var count = collection.size();


  var composite = ee.Image(
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
// 12. MONTHLY RAINFALL
// ============================================================

function getMonthlyRainfall(
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


  var rainfall = chirps
    .filterDate(
      start,
      end
    )
    .sum();


  var rainfallValue =
    rainfall.reduceRegion({

      reducer:
        ee.Reducer.mean(),

      geometry:
        ROI,

      scale:
        5566,

      bestEffort:
        true,

      maxPixels:
        1e9

    }).get('precipitation');


  return rainfallValue;
}


// ============================================================
// 13. CREATE ALL MONTHLY IMAGES
// ============================================================

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
  '2016–2025 Monthly composites:',
  monthlyImages
);


// ============================================================
// 14. IMAGE → FEATURE
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


  var year =
    ee.Number(
      image.get('year')
    );

  var month =
    ee.Number(
      image.get('month')
    );


  var rainfall =
    getMonthlyRainfall(
      year,
      month
    );


  return ee.Feature(
    null,
    {

      year:
        year,

      month:
        month,

      date:
        image.get('date'),

      image_count:
        image.get(
          'image_count'
        ),

      NDVI:
        stats.get('NDVI'),

      BSI:
        stats.get('BSI'),

      MNDWI:
        stats.get('MNDWI'),

      NDTI:
        stats.get('NDTI'),

      TSM:
        stats.get('TSM'),

      rainfall_mm:
        rainfall

    }
  );
}


// ============================================================
// 15. MONTHLY STATISTICS
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
  'MONTHLY RIVER HEALTH STATISTICS'
);

print(
  monthlyStats
);

print(
  '================================================'
);


// ============================================================
// 16. VALID MONTHLY DATA
// ============================================================

var validStats =
  monthlyStats.filter(
    ee.Filter.notNull([
      'NDVI',
      'BSI',
      'MNDWI',
      'NDTI',
      'TSM'
    ])
  );


print(
  'Valid monthly records:',
  validStats.size()
);


// ============================================================
// 17. ANNUAL STATISTICS
// ============================================================

var annualStats =
  ee.FeatureCollection(

    years.map(
      function(year) {

        year = ee.Number(year);


        var data =
          monthlyStats.filter(
            ee.Filter.eq(
              'year',
              year
            )
          );


        return ee.Feature(
          null,
          {

            year:
              year,

            NDVI:
              data.aggregate_mean(
                'NDVI'
              ),

            BSI:
              data.aggregate_mean(
                'BSI'
              ),

            MNDWI:
              data.aggregate_mean(
                'MNDWI'
              ),

            NDTI:
              data.aggregate_mean(
                'NDTI'
              ),

            TSM:
              data.aggregate_mean(
                'TSM'
              ),

            rainfall_mm:
              data.aggregate_sum(
                'rainfall_mm'
              ),

            valid_months:
              data.size()

          }
        );

      }
    )

  );


print(
  '================================================'
);

print(
  'ANNUAL RIVER HEALTH STATISTICS'
);

print(
  annualStats
);

print(
  '================================================'
);


// ============================================================
// 18. ANNUAL PERCENTAGE CHANGE
// ============================================================

var annualList =
  annualStats.sort(
    'year'
  ).toList(
    annualStats.size()
  );


var annualChange =
  ee.FeatureCollection(

    ee.List.sequence(
      1,
      annualStats.size().subtract(1)
    ).map(

      function(i) {

        i = ee.Number(i);


        var current =
          ee.Feature(
            annualList.get(i)
          );


        var previous =
          ee.Feature(
            annualList.get(
              i.subtract(1)
            )
          );


        function pct(
          property
        ) {

          var oldValue =
            ee.Number(
              previous.get(
                property
              )
            );

          var newValue =
            ee.Number(
              current.get(
                property
              )
            );


          return ee.Algorithms.If(

            oldValue.abs().gt(
              0.000001
            ),

            newValue
              .subtract(oldValue)
              .divide(
                oldValue.abs()
              )
              .multiply(100),

            null

          );

        }


        return ee.Feature(
          null,
          {

            year:
              current.get('year'),

            NDVI_change_pct:
              pct('NDVI'),

            BSI_change_pct:
              pct('BSI'),

            MNDWI_change_pct:
              pct('MNDWI'),

            NDTI_change_pct:
              pct('NDTI'),

            TSM_change_pct:
              pct('TSM'),

            rainfall_change_pct:
              pct('rainfall_mm')

          }
        );

      }

    )

  );


print(
  'YEAR-TO-YEAR PERCENTAGE CHANGE'
);

print(
  annualChange
);


// ============================================================
// 19. CORRELATION FUNCTION
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
        ee.Reducer.pearsonsCorrelation(),

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
// 20. RELATIONSHIPS
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
    'NDTI',
    'NDVI vs NDTI'
  ],

  [
    'MNDWI',
    'TSM',
    'MNDWI vs TSM'
  ]

];


// ============================================================
// 21. OVERALL CORRELATION TABLE
// ============================================================

var correlationTable =
  ee.FeatureCollection(

    relationships.map(

      function(pair) {

        var r =
          getCorrelation(
            validStats,
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
              r,

            absolute_correlation:
              ee.Number(r).abs()

          }
        );

      }

    )

  );


print(
  '================================================'
);

print(
  '2016–2025 ECOLOGICAL CORRELATION TABLE'
);

print(
  correlationTable
);

print(
  '================================================'
);


// ============================================================
// 22. CORRELATION BY YEAR
// ============================================================

var yearlyCorrelation =
  ee.FeatureCollection(

    years.map(

      function(year) {

        year = ee.Number(year);


        var data =
          monthlyStats.filter(
            ee.Filter.eq(
              'year',
              year
            )
          );


        var result =
          ee.Feature(
            null,
            {
              year:
                year,

              NDVI_BSI:
                getCorrelation(
                  data,
                  'NDVI',
                  'BSI'
                ),

              BSI_NDTI:
                getCorrelation(
                  data,
                  'BSI',
                  'NDTI'
                ),

              NDTI_TSM:
                getCorrelation(
                  data,
                  'NDTI',
                  'TSM'
                ),

              MNDWI_NDTI:
                getCorrelation(
                  data,
                  'MNDWI',
                  'NDTI'
                ),

              NDVI_NDTI:
                getCorrelation(
                  data,
                  'NDVI',
                  'NDTI'
                ),

              MNDWI_TSM:
                getCorrelation(
                  data,
                  'MNDWI',
                  'TSM'
                )

            }
          );


        return result;

      }

    )

  );


print(
  'YEARLY CORRELATION ANALYSIS'
);

print(
  yearlyCorrelation
);


// ============================================================
// 23. CORRELATION INTERPRETATION
// ============================================================

function relationshipStrength(
  r
) {

  r = ee.Number(r).abs();


  return ee.Algorithms.If(
    r.gte(0.8),
    'Very Strong',

    ee.Algorithms.If(
      r.gte(0.6),
      'Strong',

      ee.Algorithms.If(
        r.gte(0.4),
        'Moderate',

        ee.Algorithms.If(
          r.gte(0.2),
          'Weak',
          'Very Weak'
        )

      )
    )
  );
}


var interpretedCorrelation =
  correlationTable.map(

    function(f) {

      return f.set(
        'relationship_strength',
        relationshipStrength(
          f.get('correlation')
        )
      );

    }

  );


print(
  'CORRELATION WITH RELATIONSHIP STRENGTH'
);

print(
  interpretedCorrelation
);


// ============================================================
// 24. RIVER HEALTH SCORE
// ============================================================

/*
 Health score is a relative composite indicator.

 Positive components:
 NDVI
 MNDWI

 Negative components:
 BSI
 NDTI
 TSM

 This is NOT a regulatory water-quality index.
 It is a remote-sensing comparative indicator.
*/


function normalize(
  value,
  min,
  max
) {

  return ee.Number(value)
    .subtract(min)
    .divide(
      ee.Number(max)
        .subtract(min)
    )
    .clamp(0, 1);
}


var healthStats =
  annualStats.map(

    function(f) {

      var ndvi =
        ee.Number(
          f.get('NDVI')
        );

      var bsi =
        ee.Number(
          f.get('BSI')
        );

      var mndwi =
        ee.Number(
          f.get('MNDWI')
        );

      var ndti =
        ee.Number(
          f.get('NDTI')
        );

      var tsm =
        ee.Number(
          f.get('TSM')
        );


      /*
       Approximate normalization
      */

      var ndviScore =
        normalize(
          ndvi,
          -0.2,
          0.8
        );


      var bsiScore =
        ee.Number(1).subtract(
          normalize(
            bsi,
            -0.5,
            0.5
          )
        );


      var waterScore =
        normalize(
          mndwi,
          -0.5,
          0.7
        );


      var turbidityScore =
        ee.Number(1).subtract(
          normalize(
            ndti,
            -0.4,
            0.4
          )
        );


      var tsmScore =
        ee.Number(1).subtract(
          normalize(
            tsm,
            0.5,
            2.0
          )
        );


      var health =
        ndviScore
          .multiply(20)

          .add(
            bsiScore.multiply(20)
          )

          .add(
            waterScore.multiply(20)
          )

          .add(
            turbidityScore.multiply(20)
          )

          .add(
            tsmScore.multiply(20)
          );


      return f.set({

        NDVI_score:
          ndviScore,

        BSI_score:
          bsiScore,

        MNDWI_score:
          waterScore,

        NDTI_score:
          turbidityScore,

        TSM_score:
          tsmScore,

        river_health_score:
          health

      });

    }

  );


print(
  '================================================'
);

print(
  'ANNUAL RIVER HEALTH SCORE'
);

print(
  healthStats
);

print(
  '================================================'
);


// ============================================================
// 25. HEALTH TREND CHART
// ============================================================

var healthChart =
  ui.Chart.feature.byFeature({

    features:
      healthStats,

    xProperty:
      'year',

    yProperties:
      [
        'river_health_score'
      ]

  })
  .setChartType(
    'LineChart'
  )
  .setOptions({

    title:
      'Omkareshwar Narmada — River Health Score 2016–2025',

    hAxis: {
      title:
        'Year'
    },

    vAxis: {
      title:
        'Relative River Health Score',

      viewWindow: {
        min: 0,
        max: 100
      }
    },

    lineWidth:
      4,

    pointSize:
      7,

    colors: [
      '#00897B'
    ],

    legend: {
      position:
        'none'
    }

  });


print(
  healthChart
);


// ============================================================
// 26. ANNUAL MULTI-INDEX TREND
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
        [
          property
        ]

    })
    .setChartType(
      'LineChart'
    )
    .setOptions({

      title:
        title,

      hAxis: {
        title:
          'Year'
      },

      vAxis: {
        title:
          yTitle
      },

      lineWidth:
        3,

      pointSize:
        5,

      legend: {
        position:
          'none'
      }

    });


  print(
    chart
  );
}


annualTrendChart(
  'NDVI',
  '🌿 Annual NDVI — Omkareshwar 2016–2025',
  'Mean NDVI'
);


annualTrendChart(
  'BSI',
  '🟤 Annual BSI — Omkareshwar 2016–2025',
  'Mean BSI'
);


annualTrendChart(
  'MNDWI',
  '🔵 Annual MNDWI — Omkareshwar 2016–2025',
  'Mean MNDWI'
);


annualTrendChart(
  'NDTI',
  '🟠 Annual NDTI — Omkareshwar 2016–2025',
  'Mean NDTI'
);


annualTrendChart(
  'TSM',
  '🔴 Annual TSM Proxy — Omkareshwar 2016–2025',
  'TSM Proxy'
);


annualTrendChart(
  'rainfall_mm',
  '🌧️ Annual Rainfall — Omkareshwar',
  'Rainfall (mm)'
);


// ============================================================
// 27. MONTHLY TWO-YEAR STYLE CHART
// ============================================================

function monthlyIndexChart(
  property,
  title,
  yTitle
) {

  var chart =
    ui.Chart.feature.groups({

      features:
        monthlyStats
          .filter(
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


monthlyIndexChart(
  'NDVI',
  '🌿 Monthly NDVI — 2016–2025',
  'NDVI'
);


monthlyIndexChart(
  'BSI',
  '🟤 Monthly BSI — 2016–2025',
  'BSI'
);


monthlyIndexChart(
  'MNDWI',
  '🔵 Monthly MNDWI — 2016–2025',
  'MNDWI'
);


monthlyIndexChart(
  'NDTI',
  '🟠 Monthly NDTI — 2016–2025',
  'NDTI'
);


monthlyIndexChart(
  'TSM',
  '🔴 Monthly TSM — 2016–2025',
  'TSM Proxy'
);


// ============================================================
// 28. SCATTER PLOT FUNCTION
// ============================================================

function scatterChart(
  x,
  y,
  title,
  xTitle,
  yTitle
) {

  var data =
    validStats
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

      yProperties:
        [
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

      pointSize:
        6,

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

      },

      legend: {
        position:
          'bottom'
      }

    });


  print(
    chart
  );
}


// ============================================================
// 29. ECOLOGICAL RELATIONSHIP SCATTERS
// ============================================================

scatterChart(
  'NDVI',
  'BSI',
  '🌿 NDVI vs BSI — Omkareshwar 2016–2025',
  'NDVI',
  'BSI'
);


scatterChart(
  'BSI',
  'NDTI',
  '🟤 BSI vs NDTI — Omkareshwar 2016–2025',
  'BSI',
  'NDTI'
);


scatterChart(
  'NDTI',
  'TSM',
  '🟠 NDTI vs TSM — Omkareshwar 2016–2025',
  'NDTI',
  'TSM Proxy'
);


scatterChart(
  'MNDWI',
  'NDTI',
  '🔵 MNDWI vs NDTI — Omkareshwar 2016–2025',
  'MNDWI',
  'NDTI'
);


scatterChart(
  'NDVI',
  'NDTI',
  '🌿 NDVI vs NDTI — Omkareshwar 2016–2025',
  'NDVI',
  'NDTI'
);


scatterChart(
  'MNDWI',
  'TSM',
  '💧 MNDWI vs TSM — Omkareshwar 2016–2025',
  'MNDWI',
  'TSM Proxy'
);


// ============================================================
// 30. 2016 ANNUAL COMPOSITE
// ============================================================

var composite2016 =
  indexed
    .filterDate(
      '2016-01-01',
      '2017-01-01'
    )
    .median()
    .clip(ROI);


// ============================================================
// 31. 2025 ANNUAL COMPOSITE
// ============================================================

var composite2025 =
  indexed
    .filterDate(
      '2025-01-01',
      '2026-01-01'
    )
    .median()
    .clip(ROI);


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

  'RGB 2016',

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

  'RGB 2025',

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

  '🌿 NDVI 2016',

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

  '🌿 NDVI 2025'

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

  '🟤 BSI 2025',

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

  '🔵 MNDWI 2025',

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

  '🟠 NDTI 2025',

  false

);


// ============================================================
// 39. WATER MASK 2025
// ============================================================

var water2025 =
  composite2025
    .select('MNDWI')
    .gt(0);


Map.addLayer(

  water2025.selfMask(),

  {
    palette: [
      '#00BFFF'
    ]

  },

  '💧 Water Mask 2025',

  false

);


// ============================================================
// 40. HEALTH SCORE MAP 2025
// ============================================================

var ndviScoreMap =
  composite2025
    .select('NDVI')
    .subtract(-0.2)
    .divide(1.0)
    .clamp(0, 1);


var bsiScoreMap =
  ee.Image(1)
    .subtract(
      composite2025
        .select('BSI')
        .add(0.5)
        .divide(1.0)
        .clamp(0, 1)
    );


var waterScoreMap =
  composite2025
    .select('MNDWI')
    .add(0.5)
    .divide(1.2)
    .clamp(0, 1);


var turbidityScoreMap =
  ee.Image(1)
    .subtract(
      composite2025
        .select('NDTI')
        .add(0.4)
        .divide(0.8)
        .clamp(0, 1)
    );


var tsmScoreMap =
  ee.Image(1)
    .subtract(
      composite2025
        .select('TSM')
        .subtract(0.5)
        .divide(1.5)
        .clamp(0, 1)
    );


var healthMap =
  ndviScoreMap
    .multiply(20)

    .add(
      bsiScoreMap.multiply(20)
    )

    .add(
      waterScoreMap.multiply(20)
    )

    .add(
      turbidityScoreMap.multiply(20)
    )

    .add(
      tsmScoreMap.multiply(20)
    );


Map.addLayer(

  healthMap,

  {

    min:
      0,

    max:
      100,

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

  '🌊 River Health Score 2025'

);


// ============================================================
// 41. EXPORT MONTHLY DATA
// ============================================================

Export.table.toDrive({

  collection:
    monthlyStats,

  description:
    'Omkareshwar_2016_2025_MONTHLY_RIVER_HEALTH',

  folder:
    'Omkareshwar_Narmada_Research',

  fileNamePrefix:
    'Omkareshwar_2016_2025_MONTHLY_RIVER_HEALTH',

  fileFormat:
    'CSV'

});


// ============================================================
// 42. EXPORT ANNUAL DATA
// ============================================================

Export.table.toDrive({

  collection:
    annualStats,

  description:
    'Omkareshwar_2016_2025_ANNUAL_RIVER_HEALTH',

  folder:
    'Omkareshwar_Narmada_Research',

  fileNamePrefix:
    'Omkareshwar_2016_2025_ANNUAL_RIVER_HEALTH',

  fileFormat:
    'CSV'

});


// ============================================================
// 43. EXPORT ANNUAL CHANGE
// ============================================================

Export.table.toDrive({

  collection:
    annualChange,

  description:
    'Omkareshwar_2016_2025_YEARLY_CHANGE',

  folder:
    'Omkareshwar_Narmada_Research',

  fileNamePrefix:
    'Omkareshwar_2016_2025_YEARLY_CHANGE',

  fileFormat:
    'CSV'

});


// ============================================================
// 44. EXPORT CORRELATION
// ============================================================

Export.table.toDrive({

  collection:
    interpretedCorrelation,

  description:
    'Omkareshwar_2016_2025_CORRELATION',

  folder:
    'Omkareshwar_Narmada_Research',

  fileNamePrefix:
    'Omkareshwar_2016_2025_CORRELATION',

  fileFormat:
    'CSV'

});


// ============================================================
// 45. EXPORT YEARLY CORRELATION
// ============================================================

Export.table.toDrive({

  collection:
    yearlyCorrelation,

  description:
    'Omkareshwar_2016_2025_YEARLY_CORRELATION',

  folder:
    'Omkareshwar_Narmada_Research',

  fileNamePrefix:
    'Omkareshwar_2016_2025_YEARLY_CORRELATION',

  fileFormat:
    'CSV'

});


// ============================================================
// 46. EXPORT HEALTH SCORE
// ============================================================

Export.table.toDrive({

  collection:
    healthStats,

  description:
    'Omkareshwar_2016_2025_RIVER_HEALTH_SCORE',

  folder:
    'Omkareshwar_Narmada_Research',

  fileNamePrefix:
    'Omkareshwar_2016_2025_RIVER_HEALTH_SCORE',

  fileFormat:
    'CSV'

});


// ============================================================
// 47. EXPORT HEALTH SCORE MAP
// ============================================================

Export.image.toDrive({

  image:
    healthMap,

  description:
    'Omkareshwar_River_Health_Map_2025',

  folder:
    'Omkareshwar_Narmada_Research',

  fileNamePrefix:
    'Omkareshwar_River_Health_Map_2025',

  region:
    ROI,

  scale:
    10,

  maxPixels:
    1e9

});


// ============================================================
// 48. FINAL SUMMARY
// ============================================================

print(
  '===================================================='
);

print(
  '🌊 OMKARESHWAR GHAT — NARMADA RIVER'
);

print(
  'RIVER HEALTH MONITORING — 2016 TO 2025'
);

print(
  '===================================================='
);

print(
  '📍 Study Area: Omkareshwar, Madhya Pradesh'
);

print(
  '📅 Period: 2016–2025'
);

print(
  '🛰️ Dataset: Sentinel-2 SR Harmonized'
);

print(
  '🌧️ Rainfall: CHIRPS'
);

print(
  '----------------------------------------------'
);

print(
  '🌿 NDVI = Riparian vegetation'
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
  '🔴 TSM = Suspended-material proxy'
);

print(
  '🌧️ Rainfall = precipitation'
);

print(
  '----------------------------------------------'
);

print(
  'ECOLOGICAL RELATIONSHIPS'
);

print(
  '✓ NDVI vs BSI'
);

print(
  '✓ BSI vs NDTI'
);

print(
  '✓ NDTI vs TSM'
);

print(
  '✓ MNDWI vs NDTI'
);

print(
  '✓ NDVI vs NDTI'
);

print(
  '✓ MNDWI vs TSM'
);

print(
  '----------------------------------------------'
);

print(
  'RIVER HEALTH'
);

print(
  '✓ Annual River Health Score'
);

print(
  '✓ Health Score Trend'
);

print(
  '✓ 2025 Health Score Map'
);

print(
  '✓ Multi-index trends'
);

print(
  '✓ Year-to-year percentage change'
);

print(
  '----------------------------------------------'
);

print(
  'EXPORTS'
);

print(
  '✓ Monthly CSV'
);

print(
  '✓ Annual CSV'
);

print(
  '✓ Yearly Change CSV'
);

print(
  '✓ Correlation CSV'
);

print(
  '✓ Yearly Correlation CSV'
);

print(
  '✓ River Health Score CSV'
);

print(
  '✓ 2025 Health Map'
);

print(
  '===================================================='
);

print(
  'ANALYSIS COMPLETE'
);

print(
  '===================================================='
);
