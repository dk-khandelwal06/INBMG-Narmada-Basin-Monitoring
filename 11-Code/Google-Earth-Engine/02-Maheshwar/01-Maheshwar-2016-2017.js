/***************************************************************
===============================================================
 MAHESHWAR GHAT — NARMADA RIVER
 2016 vs 2017 MULTI-INDEX ECOLOGICAL ANALYSIS
===============================================================
 LOCATION
 Latitude  : 22.1773
 Longitude : 75.5830

 INDICES
 NDVI  = Vegetation
 BSI   = Bare Soil / Exposed Surface
 MNDWI = Water Signal
 NDTI  = Turbidity Proxy
 TSM   = Suspended Material Proxy
===============================================================
***************************************************************/


// ============================================================
// 1. MAHESHWAR GHAT LOCATION
// ============================================================

var maheshwarPoint = ee.Geometry.Point([
  75.5830,
  22.1773
]);

var ROI = maheshwarPoint
  .buffer(2000)
  .bounds();

Map.centerObject(ROI, 13);

Map.addLayer(
  ROI,
  {color: 'red'},
  'Maheshwar Study Area'
);

Map.addLayer(
  maheshwarPoint,
  {color: 'yellow'},
  'Maheshwar Ghat'
);


// ============================================================
// 2. YEARS
// ============================================================

var YEAR1 = 2016;
var YEAR2 = 2017;


// ============================================================
// 3. SENTINEL-2 COLLECTION
// ============================================================

var s2 = ee.ImageCollection(
  'COPERNICUS/S2_SR_HARMONIZED'
)
.filterBounds(ROI)
.filterDate(
  '2016-01-01',
  '2018-01-01'
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
      ['system:time_start']
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

function makeMonthlyImage(year, month) {

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


  // Empty image
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
    ee.Image.constant(0)
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
    .set('year', year)
    .set('month', month)
    .set('image_count', count)
    .set('date', start.millis());
}


// ============================================================
// 9. CREATE 2016 + 2017 MONTHLY COLLECTION
// ============================================================

var years = ee.List([
  YEAR1,
  YEAR2
]);

var monthlyImages =
  ee.ImageCollection.fromImages(

    years.map(function(year) {

      return months.map(function(month) {

        return makeMonthlyImage(
          year,
          month
        );

      });

    }).flatten()

  );


print(
  'Monthly composites:',
  monthlyImages
);


// ============================================================
// 10. IMAGE TO FEATURE
// ============================================================

function imageToFeature(image) {

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
// 12. 2016 DATA
// ============================================================

var data2016 =
  monthlyStats
    .filter(
      ee.Filter.eq(
        'year',
        2016
      )
    )
    .sort('month');


// ============================================================
// 13. 2017 DATA
// ============================================================

var data2017 =
  monthlyStats
    .filter(
      ee.Filter.eq(
        'year',
        2017
      )
    )
    .sort('month');


print(
  '2016 statistics:',
  data2016
);

print(
  '2017 statistics:',
  data2017
);


// ============================================================
// 14. MONTHLY 2016 → 2017 COMPARISON
// ============================================================

var list2016 =
  data2016.toList(12);

var list2017 =
  data2017.toList(12);


// ============================================================
// PERCENTAGE CHANGE FUNCTION
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

    oldValue.abs()
      .gt(0.000001),

    newValue
      .subtract(oldValue)
      .divide(oldValue.abs())
      .multiply(100),

    null

  );
}


// ============================================================
// MONTHLY COMPARISON
// ============================================================

var monthlyComparison =
  ee.FeatureCollection(

    months.map(
      function(month) {

        month =
          ee.Number(month);


        var f2016 =
          ee.Feature(
            list2016.get(
              month.subtract(1)
            )
          );


        var f2017 =
          ee.Feature(
            list2017.get(
              month.subtract(1)
            )
          );


        return ee.Feature(
          null,
          {

            month:
              month,


            NDVI_2016:
              f2016.get('NDVI'),

            NDVI_2017:
              f2017.get('NDVI'),

            NDVI_change_pct:
              percentageChange(
                f2016.get('NDVI'),
                f2017.get('NDVI')
              ),


            BSI_2016:
              f2016.get('BSI'),

            BSI_2017:
              f2017.get('BSI'),

            BSI_change_pct:
              percentageChange(
                f2016.get('BSI'),
                f2017.get('BSI')
              ),


            MNDWI_2016:
              f2016.get('MNDWI'),

            MNDWI_2017:
              f2017.get('MNDWI'),

            MNDWI_change_pct:
              percentageChange(
                f2016.get('MNDWI'),
                f2017.get('MNDWI')
              ),


            NDTI_2016:
              f2016.get('NDTI'),

            NDTI_2017:
              f2017.get('NDTI'),

            NDTI_change_pct:
              percentageChange(
                f2016.get('NDTI'),
                f2017.get('NDTI')
              ),


            TSM_2016:
              f2016.get('TSM'),

            TSM_2017:
              f2017.get('TSM'),

            TSM_change_pct:
              percentageChange(
                f2016.get('TSM'),
                f2017.get('TSM')
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
  'MONTHLY 2016 → 2017 COMPARISON'
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

        NDVI_2016:
          annualMean(
            2016,
            'NDVI'
          ),

        NDVI_2017:
          annualMean(
            2017,
            'NDVI'
          ),


        BSI_2016:
          annualMean(
            2016,
            'BSI'
          ),

        BSI_2017:
          annualMean(
            2017,
            'BSI'
          ),


        MNDWI_2016:
          annualMean(
            2016,
            'MNDWI'
          ),

        MNDWI_2017:
          annualMean(
            2017,
            'MNDWI'
          ),


        NDTI_2016:
          annualMean(
            2016,
            'NDTI'
          ),

        NDTI_2017:
          annualMean(
            2017,
            'NDTI'
          ),


        TSM_2016:
          annualMean(
            2016,
            'TSM'
          ),

        TSM_2017:
          annualMean(
            2017,
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

    function(feature) {

      return feature

        .set(
          'NDVI_change_pct',
          percentageChange(
            feature.get(
              'NDVI_2016'
            ),
            feature.get(
              'NDVI_2017'
            )
          )
        )

        .set(
          'BSI_change_pct',
          percentageChange(
            feature.get(
              'BSI_2016'
            ),
            feature.get(
              'BSI_2017'
            )
          )
        )

        .set(
          'MNDWI_change_pct',
          percentageChange(
            feature.get(
              'MNDWI_2016'
            ),
            feature.get(
              'MNDWI_2017'
            )
          )
        )

        .set(
          'NDTI_change_pct',
          percentageChange(
            feature.get(
              'NDTI_2016'
            ),
            feature.get(
              'NDTI_2017'
            )
          )
        )

        .set(
          'TSM_change_pct',
          percentageChange(
            feature.get(
              'TSM_2016'
            ),
            feature.get(
              'TSM_2017'
            )
          )
        );

    }

  );


print(
  '================================================'
);

print(
  'ANNUAL 2016 → 2017 COMPARISON'
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

        var r2016 =
          getCorrelation(
            data2016,
            pair[0],
            pair[1]
          );


        var r2017 =
          getCorrelation(
            data2017,
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

            correlation_2016:
              r2016,

            correlation_2017:
              r2017,

            correlation_change:
              ee.Number(r2017)
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
  'CORRELATION TABLE — 2016 vs 2017'
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

      'correlation_2016',

      'correlation_2017'

    ]

  })
  .setChartType(
    'ColumnChart'
  )
  .setOptions({

    title:
      'Maheshwar Ghat — Correlation 2016 vs 2017',

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

var annualFeature =
  ee.Feature(
    annualComparison.first()
  );


var annualPct =
  ee.FeatureCollection([

    ee.Feature(
      null,
      {

        index:
          'NDVI',

        change:
          annualFeature.get(
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
          annualFeature.get(
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
          annualFeature.get(
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
          annualFeature.get(
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
          annualFeature.get(
            'TSM_change_pct'
          )

      }
    )

  ]);


// ============================================================
// 22. ANNUAL CHANGE CHART
// ============================================================

var annualPctChart =
  ui.Chart.feature.byFeature({

    features:
      annualPct,

    xProperty:
      'index',

    yProperties:
      ['change']

  })
  .setChartType(
    'ColumnChart'
  )
  .setOptions({

    title:
      'Maheshwar Ghat — 2016 → 2017 Relative Change',

    subtitle:
      'Percentage change from 2016 to 2017',

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
        0

    },

    colors: [

      '#7B1FA2'

    ],

    legend: {

      position:
        'none'

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
          1, 2, 3, 4, 5, 6,
          7, 8, 9, 10, 11, 12
        ]

      },

      vAxis: {

        title:
          '2016 → 2017 Change (%)',

        baseline:
          0

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


  print(chart);

}


// ============================================================
// 24. MONTHLY RELATIVE CHANGE CHARTS
// ============================================================

relativeChangeChart(
  'NDVI',
  'NDVI — Monthly Relative Change 2016 → 2017',
  '#00A86B'
);

relativeChangeChart(
  'BSI',
  'BSI — Monthly Relative Change 2016 → 2017',
  '#795548'
);

relativeChangeChart(
  'MNDWI',
  'MNDWI — Monthly Relative Change 2016 → 2017',
  '#1565C0'
);

relativeChangeChart(
  'NDTI',
  'NDTI — Monthly Relative Change 2016 → 2017',
  '#EF6C00'
);

relativeChangeChart(
  'TSM',
  'TSM — Monthly Relative Change 2016 → 2017',
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

  var data =
    monthlyStats.filter(

      ee.Filter.or(

        ee.Filter.eq(
          'year',
          2016
        ),

        ee.Filter.eq(
          'year',
          2017
        )

      )

    );


  var chart =
    ui.Chart.feature.groups({

      features:
        data,

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
          1, 2, 3, 4, 5, 6,
          7, 8, 9, 10, 11, 12
        ]

      },

      vAxis: {

        title:
          yTitle

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


  print(chart);

}


// ============================================================
// 26. MONTHLY LINE GRAPHS
// ============================================================

twoYearChart(
  'NDVI',
  'Monthly NDVI — 2016 vs 2017',
  'Mean NDVI'
);

twoYearChart(
  'BSI',
  'Monthly BSI — 2016 vs 2017',
  'Mean BSI'
);

twoYearChart(
  'MNDWI',
  'Monthly MNDWI — 2016 vs 2017',
  'Mean MNDWI'
);

twoYearChart(
  'NDTI',
  'Monthly NDTI — 2016 vs 2017',
  'Mean NDTI'
);

twoYearChart(
  'TSM',
  'Monthly TSM — 2016 vs 2017',
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
            2016
          ),

          ee.Filter.eq(
            'year',
            2017
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

          lineWidth:
            3,

          showR2:
            true,

          visibleInLegend:
            true

        }

      }

    });


  print(chart);

}


// ============================================================
// 28. REQUIRED ECOLOGICAL SCATTER PLOTS
// ============================================================

scatterChart(
  'NDVI',
  'BSI',
  'NDVI vs BSI — Maheshwar 2016–2017',
  'NDVI',
  'BSI',
  '#00A86B'
);

scatterChart(
  'BSI',
  'NDTI',
  'BSI vs NDTI — Maheshwar 2016–2017',
  'BSI',
  'NDTI',
  '#795548'
);

scatterChart(
  'NDTI',
  'TSM',
  'NDTI vs TSM — Maheshwar 2016–2017',
  'NDTI',
  'TSM Proxy',
  '#EF6C00'
);

scatterChart(
  'MNDWI',
  'NDTI',
  'MNDWI vs NDTI — Maheshwar 2016–2017',
  'MNDWI',
  'NDTI',
  '#1565C0'
);


// ============================================================
// 29. 2016 ANNUAL COMPOSITE
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
// 30. 2017 ANNUAL COMPOSITE
// ============================================================

var composite2017 =
  indexed
    .filterDate(
      '2017-01-01',
      '2018-01-01'
    )
    .median()
    .clip(ROI);


// ============================================================
// 31. RGB 2016
// ============================================================

Map.addLayer(

  composite2016,

  {

    bands: [
      'B4',
      'B3',
      'B2'
    ],

    min: 0,

    max: 0.3

  },

  'RGB 2016'

);


// ============================================================
// 32. RGB 2017
// ============================================================

Map.addLayer(

  composite2017,

  {

    bands: [
      'B4',
      'B3',
      'B2'
    ],

    min: 0,

    max: 0.3

  },

  'RGB 2017'

);


// ============================================================
// 33. NDVI 2016
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

  'NDVI 2016'

);


// ============================================================
// 34. NDVI 2017
// ============================================================

Map.addLayer(

  composite2017.select(
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

  'NDVI 2017'

);


// ============================================================
// 35. BSI 2017
// ============================================================

Map.addLayer(

  composite2017.select(
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

  'BSI 2017'

);


// ============================================================
// 36. MNDWI 2017
// ============================================================

Map.addLayer(

  composite2017.select(
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

  'MNDWI 2017'

);


// ============================================================
// 37. NDTI 2017
// ============================================================

Map.addLayer(

  composite2017.select(
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

  'NDTI 2017'

);


// ============================================================
// 38. TSM 2017
// ============================================================

Map.addLayer(

  composite2017.select(
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

      '#FF0000',

      '#8B0000'

    ]

  },

  'TSM 2017'

);


// ============================================================
// 39. EXPORT MONTHLY COMPARISON
// ============================================================

Export.table.toDrive({

  collection:
    monthlyComparison,

  description:
    'Maheshwar_2016_2017_MONTHLY_COMPARISON',

  folder:
    'Maheshwar_Narmada_Research',

  fileNamePrefix:
    'Maheshwar_2016_2017_MONTHLY_COMPARISON',

  fileFormat:
    'CSV'

});


// ============================================================
// 40. EXPORT ANNUAL CSV
// ============================================================

Export.table.toDrive({

  collection:
    annualComparison,

  description:
    'Maheshwar_2016_2017_ANNUAL_COMPARISON',

  folder:
    'Maheshwar_Narmada_Research',

  fileNamePrefix:
    'Maheshwar_2016_2017_ANNUAL_COMPARISON',

  fileFormat:
    'CSV'

});


// ============================================================
// 41. EXPORT CORRELATION CSV
// ============================================================

Export.table.toDrive({

  collection:
    correlationTable,

  description:
    'Maheshwar_2016_2017_CORRELATION_TABLE',

  folder:
    'Maheshwar_Narmada_Research',

  fileNamePrefix:
    'Maheshwar_2016_2017_CORRELATION_TABLE',

  fileFormat:
    'CSV'

});


// ============================================================
// 42. EXPORT RAW MONTHLY DATA
// ============================================================

Export.table.toDrive({

  collection:
    monthlyStats,

  description:
    'Maheshwar_2016_2017_MONTHLY_RAW_INDICES',

  folder:
    'Maheshwar_Narmada_Research',

  fileNamePrefix:
    'Maheshwar_2016_2017_MONTHLY_RAW_INDICES',

  fileFormat:
    'CSV'

});


// ============================================================
// 43. FINAL SUMMARY
// ============================================================

print(
  '===================================================='
);

print(
  'MAHESHWAR GHAT — NARMADA RIVER'
);

print(
  '2016 → 2017 MULTI-INDEX ANALYSIS'
);

print(
  '===================================================='
);

print(
  'Latitude: 22.1773'
);

print(
  'Longitude: 75.5830'
);

print(
  'Period: 2016–2017'
);

print(
  'NDVI = vegetation condition'
);

print(
  'BSI = exposed/bare surface'
);

print(
  'MNDWI = water signal'
);

print(
  'NDTI = turbidity proxy'
);

print(
  'TSM = suspended-material spectral proxy'
);

print(
  '2016 monthly statistics completed'
);

print(
  '2017 monthly statistics completed'
);

print(
  '2016 vs 2017 comparison completed'
);

print(
  'Annual comparison completed'
);

print(
  'Correlation analysis completed'
);

print(
  'NDVI vs BSI completed'
);

print(
  'BSI vs NDTI completed'
);

print(
  'NDTI vs TSM completed'
);

print(
  'MNDWI vs NDTI completed'
);

print(
  'Monthly line charts completed'
);

print(
  'Relative percentage charts completed'
);

print(
  'Scatter plots completed'
);

print(
  'Colourful maps completed'
);

print(
  'CSV exports completed'
);

print(
  '===================================================='
);
