/***************************************************************
===============================================================
 MAHESHWAR GHAT — NARMADA RIVER
 2020 vs 2021 MULTI-INDEX ECOLOGICAL ANALYSIS
===============================================================

 LOCATION
 Latitude  : 22.1773
 Longitude : 75.5830

 YEARS
 2020
 2021

 INDICES
 NDVI  = Vegetation
 BSI   = Bare Soil / Exposed Surface
 MNDWI = Water Signal
 NDTI  = Turbidity Proxy
 TSM   = Suspended Material Proxy

 REQUIRED COMPARISONS

 1. NDVI vs BSI
 2. BSI vs NDTI
 3. NDTI vs TSM
 4. MNDWI vs NDTI

 OUTPUTS

 ✓ Monthly statistics
 ✓ Annual statistics
 ✓ 2020 vs 2021 comparison
 ✓ Relative % change
 ✓ Correlation table
 ✓ Correlation chart
 ✓ Monthly line charts
 ✓ Monthly % change charts
 ✓ Scatter plots
 ✓ Colourful maps
 ✓ Monthly CSV
 ✓ Annual CSV
 ✓ Correlation CSV
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
// 2. YEARS
// ============================================================

var YEAR1 = 2020;
var YEAR2 = 2021;


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
  '2020-01-01',
  '2022-01-01'
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

  var scl = image.select(
    'SCL'
  );


  /*
  SCL

  4 = Vegetation
  5 = Bare soil
  6 = Water
  7 = Unclassified
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
// 5. ADD SPECTRAL INDICES
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
      nir.add(red)
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
      green.add(swir1)
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
      red.add(green)
    )
    .rename(
      'NDTI'
    );


  // ----------------------------------------------------------
  // TSM PROXY
  //
  // This is a spectral proxy.
  // It is NOT laboratory TSM in mg/L.
  // ----------------------------------------------------------

  var TSM = red
    .divide(
      green.max(
        0.0001
      )
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
// 6. PROCESS SENTINEL-2
// ============================================================

var indexed = s2
  .map(maskS2)
  .map(addIndices);


print(
  'Indexed collection:',
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
// 8. MONTHLY IMAGE CREATION
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


  // ----------------------------------------------------------
  // EMPTY IMAGE
  //
  // This prevents the "no bands" error.
  // ----------------------------------------------------------

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
// 9. CREATE 2020 + 2021 MONTHLY COLLECTION
// ============================================================

var years = ee.List([
  YEAR1,
  YEAR2
]);


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
  'Monthly composites:',
  monthlyImages
);


// ============================================================
// 10. IMAGE TO FEATURE
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
  'Monthly statistics:',
  monthlyStats
);


// ============================================================
// 12. 2020 DATA
// ============================================================

var data2020 =
  monthlyStats
    .filter(
      ee.Filter.eq(
        'year',
        2020
      )
    )
    .sort(
      'month'
    );


// ============================================================
// 13. 2021 DATA
// ============================================================

var data2021 =
  monthlyStats
    .filter(
      ee.Filter.eq(
        'year',
        2021
      )
    )
    .sort(
      'month'
    );


print(
  '2020 statistics:',
  data2020
);


print(
  '2021 statistics:',
  data2021
);


// ============================================================
// 14. MONTHLY 2020 → 2021 COMPARISON
// ============================================================

var list2020 =
  data2020.toList(12);


var list2021 =
  data2021.toList(12);


var monthlyComparison =
  ee.FeatureCollection(

    months.map(
      function(month) {

        month =
          ee.Number(month);


        var f20 =
          ee.Feature(
            list2020.get(
              month.subtract(1)
            )
          );


        var f21 =
          ee.Feature(
            list2021.get(
              month.subtract(1)
            )
          );


        // ----------------------------------------------------
        // Relative percentage change
        //
        // (2021 - 2020)
        // / ABS(2020)
        // × 100
        // ----------------------------------------------------

        function pct(
          property
        ) {

          var oldValue =
            ee.Number(
              f20.get(
                property
              )
            );


          var newValue =
            ee.Number(
              f21.get(
                property
              )
            );


          return ee.Algorithms.If(

            oldValue.abs()
              .gt(
                0.000001
              ),

            newValue
              .subtract(
                oldValue
              )
              .divide(
                oldValue.abs()
              )
              .multiply(
                100
              ),

            null

          );

        }


        return ee.Feature(
          null,
          {

            month:
              month,


            NDVI_2020:
              f20.get(
                'NDVI'
              ),

            NDVI_2021:
              f21.get(
                'NDVI'
              ),

            NDVI_change_pct:
              pct(
                'NDVI'
              ),


            BSI_2020:
              f20.get(
                'BSI'
              ),

            BSI_2021:
              f21.get(
                'BSI'
              ),

            BSI_change_pct:
              pct(
                'BSI'
              ),


            MNDWI_2020:
              f20.get(
                'MNDWI'
              ),

            MNDWI_2021:
              f21.get(
                'MNDWI'
              ),

            MNDWI_change_pct:
              pct(
                'MNDWI'
              ),


            NDTI_2020:
              f20.get(
                'NDTI'
              ),

            NDTI_2021:
              f21.get(
                'NDTI'
              ),

            NDTI_change_pct:
              pct(
                'NDTI'
              ),


            TSM_2020:
              f20.get(
                'TSM'
              ),

            TSM_2021:
              f21.get(
                'TSM'
              ),

            TSM_change_pct:
              pct(
                'TSM'
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
  'MONTHLY 2020 → 2021 COMPARISON'
);

print(
  monthlyComparison
);

print(
  '================================================'
);


// ============================================================
// 15. ANNUAL MEAN FUNCTION
// ============================================================

function annualMean(
  year,
  property
) {

  return ee.Number(
    monthlyStats
      .filter(
        ee.Filter.eq(
          'year',
          year
        )
      )
      .aggregate_mean(
        property
      )
  );
}


// ============================================================
// 16. ANNUAL BASE TABLE
// ============================================================

var annualBase =
  ee.FeatureCollection([

    ee.Feature(
      null,
      {

        NDVI_2020:
          annualMean(
            2020,
            'NDVI'
          ),

        NDVI_2021:
          annualMean(
            2021,
            'NDVI'
          ),


        BSI_2020:
          annualMean(
            2020,
            'BSI'
          ),

        BSI_2021:
          annualMean(
            2021,
            'BSI'
          ),


        MNDWI_2020:
          annualMean(
            2020,
            'MNDWI'
          ),

        MNDWI_2021:
          annualMean(
            2021,
            'MNDWI'
          ),


        NDTI_2020:
          annualMean(
            2020,
            'NDTI'
          ),

        NDTI_2021:
          annualMean(
            2021,
            'NDTI'
          ),


        TSM_2020:
          annualMean(
            2020,
            'TSM'
          ),

        TSM_2021:
          annualMean(
            2021,
            'TSM'
          )

      }
    )

  ]);


// ============================================================
// 17. ANNUAL RELATIVE CHANGE
// ============================================================

var annualComparison =
  annualBase.map(

    function(f) {


      function pct(
        property
      ) {

        var a =
          ee.Number(
            f.get(
              property +
              '_2020'
            )
          );


        var b =
          ee.Number(
            f.get(
              property +
              '_2021'
            )
          );


        return ee.Algorithms.If(

          a.abs()
            .gt(
              0.000001
            ),

          b.subtract(a)
            .divide(
              a.abs()
            )
            .multiply(
              100
            ),

          null

        );

      }


      return f

        .set(
          'NDVI_change_pct',
          pct('NDVI')
        )

        .set(
          'BSI_change_pct',
          pct('BSI')
        )

        .set(
          'MNDWI_change_pct',
          pct('MNDWI')
        )

        .set(
          'NDTI_change_pct',
          pct('NDTI')
        )

        .set(
          'TSM_change_pct',
          pct('TSM')
        );

    }
  );


print(
  '================================================'
);

print(
  'ANNUAL 2020 → 2021 COMPARISON'
);

print(
  annualComparison
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
// 19. CORRELATION TABLE
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
  ]

];


var correlationTable =
  ee.FeatureCollection(

    relationships.map(
      function(pair) {

        var r2020 =
          getCorrelation(
            data2020,
            pair[0],
            pair[1]
          );


        var r2021 =
          getCorrelation(
            data2021,
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

            correlation_2020:
              r2020,

            correlation_2021:
              r2021,

            correlation_change:
              ee.Number(
                r2021
              ).subtract(
                ee.Number(
                  r2020
                )
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
  'CORRELATION TABLE — 2020 vs 2021'
);

print(
  correlationTable
);

print(
  '================================================'
);


// ============================================================
// 20. CORRELATION CHART
// ============================================================

var correlationChart =
  ui.Chart.feature.byFeature({

    features:
      correlationTable,

    xProperty:
      'relationship',

    yProperties: [

      'correlation_2020',

      'correlation_2021'

    ]

  })
  .setChartType(
    'ColumnChart'
  )
  .setOptions({

    title:
      'Maheshwar Ghat — Correlation 2020 vs 2021',

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

        min:
          -1,

        max:
          1

      },

      baseline:
        0,

      baselineColor:
        'black',

      gridlines: {

        count:
          9

      }

    },

    colors: [

      '#1565C0',
      '#E53935'

    ],

    legend: {

      position:
        'bottom'

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
// 21. ANNUAL % CHANGE DATASET
// ============================================================

var annualPct =
  ee.FeatureCollection([

    ee.Feature(
      null,
      {

        index:
          'NDVI',

        change:
          annualComparison
            .first()
            .get(
              'NDVI_change_pct'
            )

      }
    ),


    ee.Feature(
      null,
      {

        index:
          'BSI',

        change:
          annualComparison
            .first()
            .get(
              'BSI_change_pct'
            )

      }
    ),


    ee.Feature(
      null,
      {

        index:
          'MNDWI',

        change:
          annualComparison
            .first()
            .get(
              'MNDWI_change_pct'
            )

      }
    ),


    ee.Feature(
      null,
      {

        index:
          'NDTI',

        change:
          annualComparison
            .first()
            .get(
              'NDTI_change_pct'
            )

      }
    ),


    ee.Feature(
      null,
      {

        index:
          'TSM',

        change:
          annualComparison
            .first()
            .get(
              'TSM_change_pct'
            )

      }
    )

  ]);


// ============================================================
// 22. ANNUAL RELATIVE CHANGE CHART
// ============================================================

var annualPctChart =
  ui.Chart.feature.byFeature({

    features:
      annualPct,

    xProperty:
      'index',

    yProperties:
      [
        'change'
      ]

  })
  .setChartType(
    'ColumnChart'
  )
  .setOptions({

    title:
      '🌊 Maheshwar Ghat — 2020 → 2021 Relative Change',

    subtitle:
      'Percentage change from 2020 to 2021',

    chartArea: {

      left: 80,

      right: 30,

      top: 70,

      bottom: 70

    },

    hAxis: {

      title:
        'Index'

    },

    vAxis: {

      title:
        'Relative Change (%)',

      baseline:
        0,

      baselineColor:
        'black',

      gridlines: {

        count:
          8

      }

    },

    colors: [
      '#7B1FA2'
    ],

    legend: {

      position:
        'none'

    },

    bar: {

      groupWidth:
        '60%'

    }

  });


print(
  annualPctChart
);


// ============================================================
// 23. MONTHLY % CHANGE CHART FUNCTION
// ============================================================

function relativeChangeChart(
  property,
  title,
  color
) {

  var chart =
    ui.Chart.feature.byFeature({

      features:
        monthlyComparison,

      xProperty:
        'month',

      yProperties:
        [
          property +
          '_change_pct'
        ]

    })
    .setChartType(
      'ColumnChart'
    )
    .setOptions({

      title:
        title,

      chartArea: {

        left: 80,

        right: 30,

        top: 65,

        bottom: 70

      },

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
          '2020 → 2021 Change (%)',

        baseline:
          0,

        baselineColor:
          'black',

        gridlines: {

          count:
            8

        }

      },

      colors: [
        color
      ],

      legend: {

        position:
          'none'

      },

      bar: {

        groupWidth:
          '70%'

      }

    });


  print(
    chart
  );
}


// ============================================================
// 24. MONTHLY RELATIVE CHANGE CHARTS
// ============================================================

relativeChangeChart(

  'NDVI',

  '🌿 NDVI — Monthly Relative Change 2020 → 2021',

  '#00A86B'

);


relativeChangeChart(

  'BSI',

  '🟤 BSI — Monthly Relative Change 2020 → 2021',

  '#795548'

);


relativeChangeChart(

  'MNDWI',

  '🔵 MNDWI — Monthly Relative Change 2020 → 2021',

  '#1565C0'

);


relativeChangeChart(

  'NDTI',

  '🟠 NDTI — Monthly Relative Change 2020 → 2021',

  '#EF6C00'

);


relativeChangeChart(

  'TSM',

  '🔴 TSM — Monthly Relative Change 2020 → 2021',

  '#D32F2F'

);


// ============================================================
// 25. TWO-YEAR MONTHLY LINE CHART
// ============================================================

function twoYearChart(
  property,
  title,
  yTitle
) {

  var chart =
    ui.Chart.feature.groups({

      features:
        monthlyStats.filter(
          ee.Filter.or(

            ee.Filter.eq(
              'year',
              2020
            ),

            ee.Filter.eq(
              'year',
              2021
            )

          )
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

      chartArea: {

        left: 75,

        right: 30,

        top: 65,

        bottom: 70

      },

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
          yTitle,

        gridlines: {

          count:
            6

        }

      },

      colors: [

        '#1565C0',
        '#E53935'

      ],

      lineWidth:
        4,

      pointSize:
        6,

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
// 26. MONTHLY LINE GRAPHS
// ============================================================

twoYearChart(

  'NDVI',

  '🌿 Monthly NDVI — 2020 vs 2021',

  'Mean NDVI'

);


twoYearChart(

  'BSI',

  '🟤 Monthly BSI — 2020 vs 2021',

  'Mean BSI'

);


twoYearChart(

  'MNDWI',

  '🔵 Monthly MNDWI — 2020 vs 2021',

  'Mean MNDWI'

);


twoYearChart(

  'NDTI',

  '🟠 Monthly NDTI — 2020 vs 2021',

  'Mean NDTI'

);


twoYearChart(

  'TSM',

  '🔴 Monthly TSM — 2020 vs 2021',

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
  yTitle,
  color
) {

  var data =
    monthlyStats
      .filter(
        ee.Filter.or(

          ee.Filter.eq(
            'year',
            2020
          ),

          ee.Filter.eq(
            'year',
            2021
          )

        )
      )
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
          xTitle,

        gridlines: {

          count:
            6

        }

      },

      vAxis: {

        title:
          yTitle,

        gridlines: {

          count:
            6

        }

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
// 28. REQUIRED ECOLOGICAL SCATTER PLOTS
// ============================================================

scatterChart(

  'NDVI',

  'BSI',

  '🌿 NDVI vs BSI — Maheshwar',

  'NDVI',

  'BSI',

  '#00A86B'

);


scatterChart(

  'BSI',

  'NDTI',

  '🟤 BSI vs NDTI — Maheshwar',

  'BSI',

  'NDTI',

  '#795548'

);


scatterChart(

  'NDTI',

  'TSM',

  '🟠 NDTI vs TSM — Maheshwar',

  'NDTI',

  'TSM Proxy',

  '#EF6C00'

);


scatterChart(

  'MNDWI',

  'NDTI',

  '🔵 MNDWI vs NDTI — Maheshwar',

  'MNDWI',

  'NDTI',

  '#1565C0'

);


// ============================================================
// 29. 2020 ANNUAL COMPOSITE
// ============================================================

var composite2020 =
  indexed
    .filterDate(
      '2020-01-01',
      '2021-01-01'
    )
    .median()
    .clip(ROI);


// ============================================================
// 30. 2021 ANNUAL COMPOSITE
// ============================================================

var composite2021 =
  indexed
    .filterDate(
      '2021-01-01',
      '2022-01-01'
    )
    .median()
    .clip(ROI);


// ============================================================
// 31. RGB 2020
// ============================================================

Map.addLayer(

  composite2020,

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

  'RGB 2020'

);


// ============================================================
// 32. RGB 2021
// ============================================================

Map.addLayer(

  composite2021,

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

  'RGB 2021'

);


// ============================================================
// 33. NDVI 2020 MAP
// ============================================================

Map.addLayer(

  composite2020.select(
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

  '🌿 NDVI 2020'

);


// ============================================================
// 34. NDVI 2021 MAP
// ============================================================

Map.addLayer(

  composite2021.select(
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

  '🌿 NDVI 2021'

);


// ============================================================
// 35. BSI 2021 MAP
// ============================================================

Map.addLayer(

  composite2021.select(
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

  '🟤 BSI 2021'

);


// ============================================================
// 36. MNDWI 2021 MAP
// ============================================================

Map.addLayer(

  composite2021.select(
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

  '🔵 MNDWI 2021'

);


// ============================================================
// 37. NDTI 2021 MAP
// ============================================================

Map.addLayer(

  composite2021.select(
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

  '🟠 NDTI 2021'

);


// ============================================================
// 38. EXPORT — MONTHLY COMPARISON CSV
// ============================================================

Export.table.toDrive({

  collection:
    monthlyComparison,

  description:
    'Maheshwar_2020_2021_MONTHLY_COMPARISON',

  folder:
    'Maheshwar_Narmada_Research',

  fileNamePrefix:
    'Maheshwar_2020_2021_MONTHLY_COMPARISON',

  fileFormat:
    'CSV'

});


// ============================================================
// 39. EXPORT — ANNUAL CSV
// ============================================================

Export.table.toDrive({

  collection:
    annualComparison,

  description:
    'Maheshwar_2020_2021_ANNUAL_COMPARISON',

  folder:
    'Maheshwar_Narmada_Research',

  fileNamePrefix:
    'Maheshwar_2020_2021_ANNUAL_COMPARISON',

  fileFormat:
    'CSV'

});


// ============================================================
// 40. EXPORT — CORRELATION CSV
// ============================================================

Export.table.toDrive({

  collection:
    correlationTable,

  description:
    'Maheshwar_2020_2021_CORRELATION_TABLE',

  folder:
    'Maheshwar_Narmada_Research',

  fileNamePrefix:
    'Maheshwar_2020_2021_CORRELATION_TABLE',

  fileFormat:
    'CSV'

});


// ============================================================
// 41. EXPORT — RAW MONTHLY DATA
// ============================================================

Export.table.toDrive({

  collection:
    monthlyStats,

  description:
    'Maheshwar_2020_2021_MONTHLY_RAW_INDICES',

  folder:
    'Maheshwar_Narmada_Research',

  fileNamePrefix:
    'Maheshwar_2020_2021_MONTHLY_RAW_INDICES',

  fileFormat:
    'CSV'

});


// ============================================================
// 42. FINAL SUMMARY
// ============================================================

print(
  '===================================================='
);

print(
  '🌊 MAHESHWAR GHAT — NARMADA RIVER'
);

print(
  '2020 → 2021 MULTI-INDEX ANALYSIS'
);

print(
  '===================================================='
);

print(
  '📍 Latitude: 22.1773'
);

print(
  '📍 Longitude: 75.5830'
);

print(
  '📅 Period: 2020–2021'
);

print(
  '----------------------------------------------'
);

print(
  '🌿 NDVI = vegetation condition'
);

print(
  '🟤 BSI = exposed/bare surface'
);

print(
  '🔵 MNDWI = water signal'
);

print(
  '🟠 NDTI = turbidity proxy'
);

print(
  '🔴 TSM = suspended-material proxy'
);

print(
  '----------------------------------------------'
);

print(
  '✓ 2020 monthly statistics'
);

print(
  '✓ 2021 monthly statistics'
);

print(
  '✓ 2020 vs 2021 relative change'
);

print(
  '✓ Annual comparison'
);

print(
  '✓ Correlation analysis'
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
  '✓ Monthly line charts'
);

print(
  '✓ Relative % charts'
);

print(
  '✓ Scatter plots'
);

print(
  '✓ Colourful maps'
);

print(
  '✓ Monthly CSV'
);

print(
  '✓ Annual CSV'
);

print(
  '✓ Correlation CSV'
);

print(
  '===================================================='
);
