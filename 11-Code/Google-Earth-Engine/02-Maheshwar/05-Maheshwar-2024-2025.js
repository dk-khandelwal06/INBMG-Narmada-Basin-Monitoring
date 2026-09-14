/***************************************************************
 MAHESHWAR GHAT - NARMADA RIVER
 MADHYA PRADESH, INDIA

 2024 vs 2025 RELATIVE CHANGE ANALYSIS
 ===============================================================

 LOCATION
 Latitude  : 22.1773
 Longitude : 75.5830

 DATASET
 Sentinel-2 Surface Reflectance Harmonized

 INDICES
 ---------------------------------------------------------------
 NDVI       : Riparian vegetation
 BSI        : Bare / exposed soil
 MNDWI      : Water signal
 NDTI       : Turbidity proxy
 TSM_PROXY  : Suspended material proxy

 MAIN RELATIONSHIPS
 ---------------------------------------------------------------
 1. NDVI vs BSI
 2. BSI vs NDTI
 3. NDTI vs TSM
 4. MNDWI vs NDTI

 OUTPUTS
 ---------------------------------------------------------------
 ✓ 2024 annual values
 ✓ 2025 annual values
 ✓ Annual relative % change
 ✓ Monthly 2024 values
 ✓ Monthly 2025 values
 ✓ Monthly relative % change
 ✓ Correlation table
 ✓ 4 scatter plots
 ✓ Annual comparison charts
 ✓ Monthly comparison charts
 ✓ Relative-change charts
 ✓ CSV exports

***************************************************************/


// ============================================================
// 1. MAHESHWAR GHAT LOCATION
// ============================================================

var maheshwarPoint = ee.Geometry.Point([
  75.5830,
  22.1773
]);


// ------------------------------------------------------------
// Study ROI
// Approximately 4 km x 4 km around Maheshwar Ghat
// ------------------------------------------------------------

var ROI =
  maheshwarPoint.buffer(
    2000
  ).bounds();


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
// 2. DATE RANGE
// ============================================================

var START =
  '2024-01-01';

var END =
  '2026-01-01';


// ============================================================
// 3. SENTINEL-2 COLLECTION
// ============================================================

var s2 =
  ee.ImageCollection(
    'COPERNICUS/S2_SR_HARMONIZED'
  )
  .filterBounds(
    ROI
  )
  .filterDate(
    START,
    END
  )
  .filter(
    ee.Filter.lte(
      'CLOUDY_PIXEL_PERCENTAGE',
      70
    )
  );


print(
  'Sentinel-2 images:',
  s2.size()
);


// ============================================================
// 4. CLOUD / SHADOW MASK
// ============================================================

function maskS2(
  image
) {

  var scl =
    image.select(
      'SCL'
    );


  var mask =
    scl.eq(4)      // vegetation
    .or(scl.eq(5))  // bare soil
    .or(scl.eq(6))  // water
    .or(scl.eq(7)); // unclassified


  return image
    .updateMask(
      mask
    )
    .divide(
      10000
    )
    .copyProperties(
      image,
      [
        'system:time_start'
      ]
    );
}


// ============================================================
// 5. ADD INDICES
// ============================================================

function addIndices(
  image
) {

  var blue =
    image.select(
      'B2'
    );

  var green =
    image.select(
      'B3'
    );

  var red =
    image.select(
      'B4'
    );

  var nir =
    image.select(
      'B8'
    );

  var swir1 =
    image.select(
      'B11'
    );


  // ----------------------------------------------------------
  // NDVI
  // ----------------------------------------------------------

  var NDVI =
    nir
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
      .rename(
        'BSI'
      );


  // ----------------------------------------------------------
  // MNDWI
  // ----------------------------------------------------------

  var MNDWI =
    green
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

  var NDTI =
    red
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
  // Spectral red / green ratio
  // This is a proxy, NOT laboratory TSM concentration.
  // ----------------------------------------------------------

  var TSM =
    red
      .divide(
        green.max(
          0.0001
        )
      )
      .rename(
        'TSM'
      );


  return image
    .addBands(
      NDVI
    )
    .addBands(
      BSI
    )
    .addBands(
      MNDWI
    )
    .addBands(
      NDTI
    )
    .addBands(
      TSM
    );
}


// ============================================================
// 6. PROCESS COLLECTION
// ============================================================

var indexed =
  s2
    .map(
      maskS2
    )
    .map(
      addIndices
    );


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
  // Empty image with correct bands
  // Prevents "Image has no bands" errors.
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
    )
    .clip(
      ROI
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


var monthlyImages =
  ee.ImageCollection.fromImages(

    ee.List(
      ee.List(
        [2024, 2025]
      ).map(
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
      )
    ).flatten()

  );


print(
  'Monthly composites:',
  monthlyImages
);


// ============================================================
// 8. MONTHLY STATISTICS
// ============================================================

function imageToFeature(
  image
) {

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
// 9. CREATE PAIRED 2024 / 2025 MONTHLY TABLE
// ============================================================

var monthly2024 =
  monthlyStats.filter(
    ee.Filter.eq(
      'year',
      2024
    )
  );


var monthly2025 =
  monthlyStats.filter(
    ee.Filter.eq(
      'year',
      2025
    )
  );


var monthly2024List =
  monthly2024.sort(
    'month'
  ).toList(
    12
  );


var monthly2025List =
  monthly2025.sort(
    'month'
  ).toList(
    12
  );


var monthlyComparison =
  ee.FeatureCollection(

    months.map(
      function(month) {

        month =
          ee.Number(month);


        var f24 =
          ee.Feature(
            monthly2024List.get(
              month.subtract(1)
            )
          );


        var f25 =
          ee.Feature(
            monthly2025List.get(
              month.subtract(1)
            )
          );


        function relativeChange(
          property
        ) {

          var a =
            ee.Number(
              f24.get(
                property
              )
            );

          var b =
            ee.Number(
              f25.get(
                property
              )
            );


          return ee.Algorithms.If(

            a.abs().gt(
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


        return ee.Feature(
          null,
          {

            month:
              month,

            NDVI_2024:
              f24.get('NDVI'),

            NDVI_2025:
              f25.get('NDVI'),

            NDVI_change_pct:
              relativeChange(
                'NDVI'
              ),


            BSI_2024:
              f24.get('BSI'),

            BSI_2025:
              f25.get('BSI'),

            BSI_change_pct:
              relativeChange(
                'BSI'
              ),


            MNDWI_2024:
              f24.get('MNDWI'),

            MNDWI_2025:
              f25.get('MNDWI'),

            MNDWI_change_pct:
              relativeChange(
                'MNDWI'
              ),


            NDTI_2024:
              f24.get('NDTI'),

            NDTI_2025:
              f25.get('NDTI'),

            NDTI_change_pct:
              relativeChange(
                'NDTI'
              ),


            TSM_2024:
              f24.get('TSM'),

            TSM_2025:
              f25.get('TSM'),

            TSM_change_pct:
              relativeChange(
                'TSM'
              )
          }
        );
      }
    )
  );


print(
  '========================================'
);

print(
  'MONTHLY 2024 → 2025 RELATIVE CHANGE:',
  monthlyComparison
);

print(
  '========================================'
);


// ============================================================
// 10. ANNUAL VALUES
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


var annualComparison =
  ee.FeatureCollection([

    ee.Feature(
      null,
      {

        year_2024:
          2024,

        year_2025:
          2025,


        NDVI_2024:
          annualMean(
            2024,
            'NDVI'
          ),

        NDVI_2025:
          annualMean(
            2025,
            'NDVI'
          ),


        BSI_2024:
          annualMean(
            2024,
            'BSI'
          ),

        BSI_2025:
          annualMean(
            2025,
            'BSI'
          ),


        MNDWI_2024:
          annualMean(
            2024,
            'MNDWI'
          ),

        MNDWI_2025:
          annualMean(
            2025,
            'MNDWI'
          ),


        NDTI_2024:
          annualMean(
            2024,
            'NDTI'
          ),

        NDTI_2025:
          annualMean(
            2025,
            'NDTI'
          ),


        TSM_2024:
          annualMean(
            2024,
            'TSM'
          ),

        TSM_2025:
          annualMean(
            2025,
            'TSM'
          )
      }
    )

  ]);


// ============================================================
// 11. ADD ANNUAL % CHANGE
// ============================================================

var annualRelative =
  annualComparison.map(
    function(f) {

      function pct(
        property
      ) {

        var a =
          ee.Number(
            f.get(
              property +
              '_2024'
            )
          );

        var b =
          ee.Number(
            f.get(
              property +
              '_2025'
            )
          );


        return ee.Algorithms.If(

          a.abs().gt(
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
  '========================================'
);

print(
  'ANNUAL 2024 → 2025 COMPARISON:',
  annualRelative
);

print(
  '========================================'
);


// ============================================================
// 12. CORRELATION FUNCTION
// ============================================================

function correlation(
  data,
  x,
  y
) {

  var valid =
    data.filter(
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
// 13. FOUR REQUIRED RELATIONSHIPS
// ============================================================

var pairs = [

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


// ============================================================
// 14. CORRELATION TABLE
// ============================================================

var correlationTable =
  ee.FeatureCollection(

    pairs.map(
      function(pair) {

        var r2024 =
          correlation(
            monthly2024,
            pair[0],
            pair[1]
          );


        var r2025 =
          correlation(
            monthly2025,
            pair[0],
            pair[1]
          );


        var delta =
          ee.Number(
            r2025
          ).subtract(
            ee.Number(
              r2024
            )
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

            correlation_2024:
              r2024,

            correlation_2025:
              r2025,

            correlation_change:
              delta
          }
        );
      }
    )
  );


print(
  '========================================'
);

print(
  'CORRELATION TABLE:',
  correlationTable
);

print(
  '========================================'
);


// ============================================================
// 15. CORRELATION TABLE CHART
// ============================================================

var correlationChart =
  ui.Chart.feature.byFeature({

    features:
      correlationTable,

    xProperty:
      'relationship',

    yProperties: [

      'correlation_2024',

      'correlation_2025'

    ]

  })
  .setChartType(
    'ColumnChart'
  )
  .setOptions({

    title:
      'Correlation Comparison — 2024 vs 2025',

    chartArea: {

      left: 80,

      right: 35,

      top: 70,

      bottom: 130
    },

    hAxis: {

      title:
        'Ecological Relationship',

      slantedText:
        true,

      slantedTextAngle:
        35
    },

    vAxis: {

      title:
        'Pearson correlation (r)',

      viewWindow: {

        min:
          -1,

        max:
          1
      },

      gridlines: {

        count:
          9
      },

      baseline:
        0,

      baselineColor:
        'black'
    },

    colors: [
      '#4285F4',
      '#EA4335'
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
// 16. BEAUTIFUL ANNUAL RELATIVE CHANGE CHART
// ============================================================

var annualPctFeatures =
  ee.FeatureCollection([

    ee.Feature(
      null,
      {

        index:
          'NDVI',

        change:
          annualRelative.first()
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
          annualRelative.first()
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
          annualRelative.first()
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
          annualRelative.first()
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
          annualRelative.first()
            .get(
              'TSM_change_pct'
            )
      }
    )

  ]);


var annualPctChart =
  ui.Chart.feature.byFeature({

    features:
      annualPctFeatures,

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
      'Maheshwar Ghat — Relative Change (%) 2024 → 2025',

    subtitle:
      'Positive = increase | Negative = decrease',

    chartArea: {

      left: 85,

      right: 35,

      top: 75,

      bottom: 85
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
      '#00A86B'
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
// 17. MONTHLY RELATIVE CHANGE CHART
// ============================================================

function monthlyPctChart(
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

        left: 85,

        right: 35,

        top: 65,

        bottom: 75
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


monthlyPctChart(
  'NDVI',
  '🌿 NDVI Relative Change — 2024 → 2025',
  '#00A86B'
);


monthlyPctChart(
  'BSI',
  '🟤 BSI Relative Change — 2024 → 2025',
  '#A0522D'
);


monthlyPctChart(
  'MNDWI',
  '🔵 MNDWI Relative Change — 2024 → 2025',
  '#1565C0'
);


monthlyPctChart(
  'NDTI',
  '🟠 NDTI Relative Change — 2024 → 2025',
  '#F57C00'
);


monthlyPctChart(
  'TSM',
  '🔴 TSM Relative Change — 2024 → 2025',
  '#D32F2F'
);


// ============================================================
// 18. MONTHLY 2024 vs 2025 LINE CHARTS
// ============================================================

function monthlyTwoYearChart(
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
              2024
            ),

            ee.Filter.eq(
              'year',
              2025
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

        right: 35,

        top: 65,

        bottom: 75
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
        '#4285F4',
        '#EA4335'
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


monthlyTwoYearChart(
  'NDVI',
  '🌿 Monthly NDVI — 2024 vs 2025',
  'Mean NDVI'
);


monthlyTwoYearChart(
  'BSI',
  '🟤 Monthly BSI — 2024 vs 2025',
  'Mean BSI'
);


monthlyTwoYearChart(
  'MNDWI',
  '🔵 Monthly MNDWI — 2024 vs 2025',
  'Mean MNDWI'
);


monthlyTwoYearChart(
  'NDTI',
  '🟠 Monthly NDTI — 2024 vs 2025',
  'Mean NDTI'
);


monthlyTwoYearChart(
  'TSM',
  '🔴 Monthly TSM — 2024 vs 2025',
  'Mean TSM Proxy'
);


// ============================================================
// 19. SCATTER PLOTS
// ============================================================

function scatter(
  x,
  y,
  title,
  xTitle,
  yTitle,
  color
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

        left: 85,

        right: 40,

        top: 70,

        bottom: 80
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
// REQUIRED 4 RELATIONSHIPS
// ============================================================

scatter(
  'NDVI',
  'BSI',

  '🌿 NDVI vs BSI — Riparian Vegetation / Exposed Soil',

  'NDVI',

  'BSI',

  '#00A86B'
);


scatter(
  'BSI',
  'NDTI',

  '🟤 BSI vs NDTI — Exposed Soil / Turbidity',

  'BSI',

  'NDTI',

  '#8D6E63'
);


scatter(
  'NDTI',
  'TSM',

  '🟠 NDTI vs TSM — Turbidity / Suspended Material',

  'NDTI',

  'TSM Proxy',

  '#EF6C00'
);


scatter(
  'MNDWI',
  'NDTI',

  '🔵 MNDWI vs NDTI — Water / Turbidity',

  'MNDWI',

  'NDTI',

  '#1565C0'
);


// ============================================================
// 20. ANNUAL RELATIVE CHANGE TABLE PRINT
// ============================================================

print(
  '============================================'
);

print(
  'FINAL ANNUAL RELATIVE CHANGE (%)'
);

print(
  annualPctFeatures
);

print(
  '============================================'
);


// ============================================================
// 21. EXPORT MONTHLY CSV
// ============================================================

Export.table.toDrive({

  collection:
    monthlyComparison,

  description:
    'Maheshwar_Ghat_2024_2025_MONTHLY_RELATIVE_CHANGE',

  folder:
    'Maheshwar_Narmada_Research',

  fileNamePrefix:
    'Maheshwar_Ghat_2024_2025_MONTHLY_RELATIVE_CHANGE',

  fileFormat:
    'CSV'
});


// ============================================================
// 22. EXPORT ANNUAL CSV
// ============================================================

Export.table.toDrive({

  collection:
    annualRelative,

  description:
    'Maheshwar_Ghat_2024_2025_ANNUAL_COMPARISON',

  folder:
    'Maheshwar_Narmada_Research',

  fileNamePrefix:
    'Maheshwar_Ghat_2024_2025_ANNUAL_COMPARISON',

  fileFormat:
    'CSV'
});


// ============================================================
// 23. EXPORT CORRELATION CSV
// ============================================================

Export.table.toDrive({

  collection:
    correlationTable,

  description:
    'Maheshwar_Ghat_2024_2025_CORRELATION_TABLE',

  folder:
    'Maheshwar_Narmada_Research',

  fileNamePrefix:
    'Maheshwar_Ghat_2024_2025_CORRELATION_TABLE',

  fileFormat:
    'CSV'
});


// ============================================================
// 24. EXPORT RAW MONTHLY STATISTICS
// ============================================================

Export.table.toDrive({

  collection:
    monthlyStats,

  description:
    'Maheshwar_Ghat_2024_2025_MONTHLY_RAW_INDICES',

  folder:
    'Maheshwar_Narmada_Research',

  fileNamePrefix:
    'Maheshwar_Ghat_2024_2025_MONTHLY_RAW_INDICES',

  fileFormat:
    'CSV'
});


// ============================================================
// 25. MAPS
// ============================================================

var annual2024 =
  indexed
    .filterDate(
      '2024-01-01',
      '2025-01-01'
    )
    .median()
    .clip(
      ROI
    );


var annual2025 =
  indexed
    .filterDate(
      '2025-01-01',
      '2026-01-01'
    )
    .median()
    .clip(
      ROI
    );


// ------------------------------------------------------------
// NDVI
// ------------------------------------------------------------

Map.addLayer(
  annual2024.select(
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

  'NDVI 2024'
);


Map.addLayer(
  annual2025.select(
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

  'NDVI 2025'
);


// ------------------------------------------------------------
// BSI
// ------------------------------------------------------------

Map.addLayer(
  annual2025.select(
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

  'BSI 2025'
);


// ------------------------------------------------------------
// MNDWI
// ------------------------------------------------------------

Map.addLayer(
  annual2025.select(
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

  'MNDWI 2025'
);


// ------------------------------------------------------------
// NDTI
// ------------------------------------------------------------

Map.addLayer(
  annual2025.select(
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

  'NDTI 2025'
);


// ============================================================
// 26. FINAL CONSOLE SUMMARY
// ============================================================

print(
  '================================================='
);

print(
  '🌊 MAHESHWAR GHAT — NARMADA RIVER'
);

print(
  '2024 → 2025 RELATIVE CHANGE STUDY'
);

print(
  '================================================='
);

print(
  '📍 Latitude: 22.1773'
);

print(
  '📍 Longitude: 75.5830'
);

print(
  '✓ NDVI'
);

print(
  '✓ BSI'
);

print(
  '✓ MNDWI'
);

print(
  '✓ NDTI'
);

print(
  '✓ TSM proxy'
);

print(
  '✓ Monthly comparison'
);

print(
  '✓ Annual comparison'
);

print(
  '✓ Relative % change'
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
  '✓ Correlation table'
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
  '================================================='
);
