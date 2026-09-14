/***************************************************************
 MAHESHWAR GHAT — NARMADA RIVER
 ===============================================================
 2022 vs 2023 COMPARATIVE MULTI-INDEX ANALYSIS

 Location:
 Latitude  = 22.1773
 Longitude = 75.5830

 Indices:
 NDVI  = Vegetation
 BSI   = Bare Soil / Exposed Surface
 MNDWI = Water
 NDTI  = Turbidity Proxy
 TSM   = Suspended Material Proxy

 Main relationships:
 1. NDVI vs BSI
 2. BSI vs NDTI
 3. NDTI vs TSM
 4. MNDWI vs NDTI

 Outputs:
 ✓ Monthly statistics
 ✓ Annual statistics
 ✓ Relative % change
 ✓ Correlations
 ✓ Scatter plots
 ✓ Monthly line graphs
 ✓ Monthly % change graphs
 ✓ Annual % change graph
 ✓ CSV exports
 ✓ Maps
***************************************************************/


// ============================================================
// 1. MAHESHWAR LOCATION
// ============================================================

var maheshwarPoint = ee.Geometry.Point([
  75.5830,
  22.1773
]);


// 2 km radius study area
var ROI =
  maheshwarPoint
    .buffer(2000)
    .bounds();


Map.centerObject(
  ROI,
  13
);


Map.addLayer(
  ROI,
  {
    color: 'red'
  },
  'Maheshwar Study Area'
);


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

var YEAR1 = 2022;
var YEAR2 = 2023;


// ============================================================
// 3. SENTINEL-2 SR HARMONIZED
// ============================================================

var s2 =
  ee.ImageCollection(
    'COPERNICUS/S2_SR_HARMONIZED'
  )
  .filterBounds(
    ROI
  )
  .filterDate(
    '2022-01-01',
    '2024-01-01'
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

  var scl =
    image.select('SCL');


  /*
   SCL classes retained:

   4 = Vegetation
   5 = Bare soil
   6 = Water
   7 = Unclassified
  */

  var mask =
    scl.eq(4)
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

  var blue =
    image.select('B2');

  var green =
    image.select('B3');

  var red =
    image.select('B4');

  var nir =
    image.select('B8');

  var swir1 =
    image.select('B11');


  // ----------------------------------------------------------
  // NDVI
  // ----------------------------------------------------------

  var NDVI =
    nir
      .subtract(red)
      .divide(
        nir.add(red)
      )
      .rename('NDVI');


  // ----------------------------------------------------------
  // BSI
  // ----------------------------------------------------------

  var BSI =
    swir1
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

  var MNDWI =
    green
      .subtract(swir1)
      .divide(
        green.add(swir1)
      )
      .rename('MNDWI');


  // ----------------------------------------------------------
  // NDTI
  // ----------------------------------------------------------

  var NDTI =
    red
      .subtract(green)
      .divide(
        red.add(green)
      )
      .rename('NDTI');


  // ----------------------------------------------------------
  // TSM PROXY
  //
  // IMPORTANT:
  // This is a spectral proxy, NOT laboratory TSM.
  // ----------------------------------------------------------

  var TSM =
    red
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
// 6. PROCESS COLLECTION
// ============================================================

var indexed =
  s2
    .map(maskS2)
    .map(addIndices);


print(
  'Indexed collection:',
  indexed
);


// ============================================================
// 7. MONTHLY COMPOSITES
// ============================================================

var months =
  ee.List.sequence(
    1,
    12
  );


function makeMonthlyImage(
  year,
  month
) {

  year =
    ee.Number(year);

  month =
    ee.Number(month);


  var start =
    ee.Date.fromYMD(
      year,
      month,
      1
    );


  var end =
    start.advance(
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
  // Empty image WITH bands
  //
  // Prevents:
  // Image.select: Band pattern NDVI applied to image
  // with no bands.
  // ----------------------------------------------------------

  var empty =
    ee.Image.constant([
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


  var composite =
    ee.Image(
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
// 8. CREATE 2022 + 2023 MONTHLY COLLECTION
// ============================================================

var years =
  ee.List([
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
// 9. IMAGE → FEATURE
// ============================================================

function imageToFeature(image) {

  var stats =
    image
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
        image.get('year'),

      month:
        image.get('month'),

      date:
        image.get('date'),

      image_count:
        image.get('image_count'),

      NDVI:
        stats.get('NDVI'),

      BSI:
        stats.get('BSI'),

      MNDWI:
        stats.get('MNDWI'),

      NDTI:
        stats.get('NDTI'),

      TSM:
        stats.get('TSM')
    }
  );
}


// ============================================================
// 10. MONTHLY STATISTICS
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
// 11. SPLIT 2022 / 2023
// ============================================================

var data2022 =
  monthlyStats
    .filter(
      ee.Filter.eq(
        'year',
        2022
      )
    )
    .sort('month');


var data2023 =
  monthlyStats
    .filter(
      ee.Filter.eq(
        'year',
        2023
      )
    )
    .sort('month');


print(
  '2022 statistics:',
  data2022
);


print(
  '2023 statistics:',
  data2023
);


// ============================================================
// 12. MONTHLY 2022 → 2023 COMPARISON
// ============================================================

var list2022 =
  data2022.toList(12);


var list2023 =
  data2023.toList(12);


var monthlyComparison =
  ee.FeatureCollection(

    months.map(
      function(month) {

        month =
          ee.Number(month);


        var f22 =
          ee.Feature(
            list2022.get(
              month.subtract(1)
            )
          );


        var f23 =
          ee.Feature(
            list2023.get(
              month.subtract(1)
            )
          );


        // ----------------------------------------------------
        // Relative change
        //
        // (2023 - 2022) / ABS(2022) × 100
        // ----------------------------------------------------

        function pct(property) {

          var oldValue =
            ee.Number(
              f22.get(property)
            );

          var newValue =
            ee.Number(
              f23.get(property)
            );


          return ee.Algorithms.If(

            oldValue.abs()
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


        return ee.Feature(
          null,
          {

            month:
              month,


            NDVI_2022:
              f22.get('NDVI'),

            NDVI_2023:
              f23.get('NDVI'),

            NDVI_change_pct:
              pct('NDVI'),


            BSI_2022:
              f22.get('BSI'),

            BSI_2023:
              f23.get('BSI'),

            BSI_change_pct:
              pct('BSI'),


            MNDWI_2022:
              f22.get('MNDWI'),

            MNDWI_2023:
              f23.get('MNDWI'),

            MNDWI_change_pct:
              pct('MNDWI'),


            NDTI_2022:
              f22.get('NDTI'),

            NDTI_2023:
              f23.get('NDTI'),

            NDTI_change_pct:
              pct('NDTI'),


            TSM_2022:
              f22.get('TSM'),

            TSM_2023:
              f23.get('TSM'),

            TSM_change_pct:
              pct('TSM')

          }
        );

      }
    )
  );


print(
  '================================================'
);

print(
  'MONTHLY 2022 → 2023 COMPARISON'
);

print(
  monthlyComparison
);

print(
  '================================================'
);


// ============================================================
// 13. ANNUAL MEANS
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
// 14. ANNUAL TABLE
// ============================================================

var annualBase =
  ee.FeatureCollection([

    ee.Feature(
      null,
      {

        NDVI_2022:
          annualMean(
            2022,
            'NDVI'
          ),

        NDVI_2023:
          annualMean(
            2023,
            'NDVI'
          ),


        BSI_2022:
          annualMean(
            2022,
            'BSI'
          ),

        BSI_2023:
          annualMean(
            2023,
            'BSI'
          ),


        MNDWI_2022:
          annualMean(
            2022,
            'MNDWI'
          ),

        MNDWI_2023:
          annualMean(
            2023,
            'MNDWI'
          ),


        NDTI_2022:
          annualMean(
            2022,
            'NDTI'
          ),

        NDTI_2023:
          annualMean(
            2023,
            'NDTI'
          ),


        TSM_2022:
          annualMean(
            2022,
            'TSM'
          ),

        TSM_2023:
          annualMean(
            2023,
            'TSM'
          )

      }
    )

  ]);


// ============================================================
// 15. ANNUAL RELATIVE CHANGE
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
              '_2022'
            )
          );


        var b =
          ee.Number(
            f.get(
              property +
              '_2023'
            )
          );


        return ee.Algorithms.If(

          a.abs()
            .gt(0.000001),

          b.subtract(a)
            .divide(
              a.abs()
            )
            .multiply(100),

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
  'ANNUAL 2022 → 2023 COMPARISON'
);

print(
  annualComparison
);

print(
  '================================================'
);


// ============================================================
// 16. CORRELATION FUNCTION
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
// 17. CORRELATION TABLE
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

        var r2022 =
          getCorrelation(
            data2022,
            pair[0],
            pair[1]
          );


        var r2023 =
          getCorrelation(
            data2023,
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

            correlation_2022:
              r2022,

            correlation_2023:
              r2023,

            correlation_change:
              ee.Number(
                r2023
              ).subtract(
                ee.Number(
                  r2022
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
  'CORRELATION TABLE — 2022 vs 2023'
);

print(
  correlationTable
);

print(
  '================================================'
);


// ============================================================
// 18. CORRELATION GRAPH
// ============================================================

var correlationChart =
  ui.Chart.feature.byFeature({

    features:
      correlationTable,

    xProperty:
      'relationship',

    yProperties: [

      'correlation_2022',

      'correlation_2023'

    ]

  })
  .setChartType(
    'ColumnChart'
  )
  .setOptions({

    title:
      'Maheshwar Ghat — Correlation 2022 vs 2023',

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
// 19. ANNUAL RELATIVE CHANGE CHART
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
      '🌊 Maheshwar Ghat — 2022 → 2023 Relative Change',

    subtitle:
      'Percentage change from 2022 to 2023',

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
      '#00897B'
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
// 20. MONTHLY % CHANGE FUNCTION
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
          '2022 → 2023 Change (%)',

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
// 21. FIVE MONTHLY CHANGE CHARTS
// ============================================================

relativeChangeChart(
  'NDVI',

  '🌿 NDVI — Monthly Relative Change 2022 → 2023',

  '#00A86B'
);


relativeChangeChart(
  'BSI',

  '🟤 BSI — Monthly Relative Change 2022 → 2023',

  '#795548'
);


relativeChangeChart(
  'MNDWI',

  '🔵 MNDWI — Monthly Relative Change 2022 → 2023',

  '#1565C0'
);


relativeChangeChart(
  'NDTI',

  '🟠 NDTI — Monthly Relative Change 2022 → 2023',

  '#EF6C00'
);


relativeChangeChart(
  'TSM',

  '🔴 TSM — Monthly Relative Change 2022 → 2023',

  '#D32F2F'
);


// ============================================================
// 22. 2022 vs 2023 MONTHLY LINE CHART
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
              2022
            ),

            ee.Filter.eq(
              'year',
              2023
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
// 23. FIVE 2022 VS 2023 LINE GRAPHS
// ============================================================

twoYearChart(
  'NDVI',

  '🌿 Monthly NDVI — 2022 vs 2023',

  'Mean NDVI'
);


twoYearChart(
  'BSI',

  '🟤 Monthly BSI — 2022 vs 2023',

  'Mean BSI'
);


twoYearChart(
  'MNDWI',

  '🔵 Monthly MNDWI — 2022 vs 2023',

  'Mean MNDWI'
);


twoYearChart(
  'NDTI',

  '🟠 Monthly NDTI — 2022 vs 2023',

  'Mean NDTI'
);


twoYearChart(
  'TSM',

  '🔴 Monthly TSM — 2022 vs 2023',

  'TSM Proxy'
);


// ============================================================
// 24. SCATTER PLOT FUNCTION
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
// 25. REQUIRED SCATTER PLOTS
// ============================================================

scatterChart(

  'NDVI',

  'BSI',

  '🌿 NDVI vs BSI — Maheshwar Ghat',

  'NDVI',

  'BSI',

  '#00A86B'
);


scatterChart(

  'BSI',

  'NDTI',

  '🟤 BSI vs NDTI — Maheshwar Ghat',

  'BSI',

  'NDTI',

  '#795548'
);


scatterChart(

  'NDTI',

  'TSM',

  '🟠 NDTI vs TSM — Maheshwar Ghat',

  'NDTI',

  'TSM Proxy',

  '#EF6C00'
);


scatterChart(

  'MNDWI',

  'NDTI',

  '🔵 MNDWI vs NDTI — Maheshwar Ghat',

  'MNDWI',

  'NDTI',

  '#1565C0'
);


// ============================================================
// 26. ANNUAL 2022 COMPOSITE
// ============================================================

var composite2022 =
  indexed
    .filterDate(
      '2022-01-01',
      '2023-01-01'
    )
    .median()
    .clip(ROI);


// ============================================================
// 27. ANNUAL 2023 COMPOSITE
// ============================================================

var composite2023 =
  indexed
    .filterDate(
      '2023-01-01',
      '2024-01-01'
    )
    .median()
    .clip(ROI);


// ============================================================
// 28. RGB 2022
// ============================================================

Map.addLayer(

  composite2022,

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

  'RGB 2022'
);


// ============================================================
// 29. RGB 2023
// ============================================================

Map.addLayer(

  composite2023,

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

  'RGB 2023'
);


// ============================================================
// 30. NDVI MAP 2022
// ============================================================

Map.addLayer(

  composite2022.select(
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

  '🌿 NDVI 2022'
);


// ============================================================
// 31. NDVI MAP 2023
// ============================================================

Map.addLayer(

  composite2023.select(
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

  '🌿 NDVI 2023'
);


// ============================================================
// 32. BSI MAP 2023
// ============================================================

Map.addLayer(

  composite2023.select(
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

  '🟤 BSI 2023'
);


// ============================================================
// 33. MNDWI MAP 2023
// ============================================================

Map.addLayer(

  composite2023.select(
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

  '🔵 MNDWI 2023'
);


// ============================================================
// 34. NDTI MAP 2023
// ============================================================

Map.addLayer(

  composite2023.select(
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

  '🟠 NDTI 2023'
);


// ============================================================
// 35. EXPORT MONTHLY CSV
// ============================================================

Export.table.toDrive({

  collection:
    monthlyComparison,

  description:
    'Maheshwar_2022_2023_MONTHLY_COMPARISON',

  folder:
    'Maheshwar_Narmada_Research',

  fileNamePrefix:
    'Maheshwar_2022_2023_MONTHLY_COMPARISON',

  fileFormat:
    'CSV'

});


// ============================================================
// 36. EXPORT ANNUAL CSV
// ============================================================

Export.table.toDrive({

  collection:
    annualComparison,

  description:
    'Maheshwar_2022_2023_ANNUAL_COMPARISON',

  folder:
    'Maheshwar_Narmada_Research',

  fileNamePrefix:
    'Maheshwar_2022_2023_ANNUAL_COMPARISON',

  fileFormat:
    'CSV'

});


// ============================================================
// 37. EXPORT CORRELATION CSV
// ============================================================

Export.table.toDrive({

  collection:
    correlationTable,

  description:
    'Maheshwar_2022_2023_CORRELATION_TABLE',

  folder:
    'Maheshwar_Narmada_Research',

  fileNamePrefix:
    'Maheshwar_2022_2023_CORRELATION_TABLE',

  fileFormat:
    'CSV'

});


// ============================================================
// 38. EXPORT RAW MONTHLY DATA
// ============================================================

Export.table.toDrive({

  collection:
    monthlyStats,

  description:
    'Maheshwar_2022_2023_MONTHLY_RAW_INDICES',

  folder:
    'Maheshwar_Narmada_Research',

  fileNamePrefix:
    'Maheshwar_2022_2023_MONTHLY_RAW_INDICES',

  fileFormat:
    'CSV'

});


// ============================================================
// 39. FINAL CONSOLE SUMMARY
// ============================================================

print(
  '===================================================='
);

print(
  '🌊 MAHESHWAR GHAT — NARMADA RIVER'
);

print(
  '2022 → 2023 MULTI-INDEX ANALYSIS'
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
  '🌿 NDVI = vegetation'
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
  '✓ Monthly statistics'
);

print(
  '✓ Annual comparison'
);

print(
  '✓ Relative percentage change'
);

print(
  '✓ Correlation table'
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
  '✓ Monthly charts'
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
