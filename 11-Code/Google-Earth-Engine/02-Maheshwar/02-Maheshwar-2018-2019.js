/***************************************************************
 MAHESHWAR GHAT — NARMADA RIVER
 2018 vs 2019 MULTI-INDEX ECOLOGICAL ANALYSIS
***************************************************************/

// ============================================================
// 1. LOCATION
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

var YEAR1 = 2018;
var YEAR2 = 2019;


// ============================================================
// 3. SENTINEL-2
// ============================================================

var s2 = ee.ImageCollection(
  'COPERNICUS/S2_SR_HARMONIZED'
)
.filterBounds(ROI)
.filterDate(
  '2018-01-01',
  '2020-01-01'
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
// 5. ADD INDICES
// ============================================================

function addIndices(image) {

  var blue = image.select('B2');
  var green = image.select('B3');
  var red = image.select('B4');
  var nir = image.select('B8');
  var swir1 = image.select('B11');


  // NDVI
  var NDVI = nir
    .subtract(red)
    .divide(nir.add(red))
    .rename('NDVI');


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
    .rename('BSI');


  // MNDWI
  var MNDWI = green
    .subtract(swir1)
    .divide(green.add(swir1))
    .rename('MNDWI');


  // NDTI
  var NDTI = red
    .subtract(green)
    .divide(red.add(green))
    .rename('NDTI');


  // TSM spectral proxy
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
// 6. PROCESS COLLECTION
// ============================================================

var indexed = s2
  .map(maskS2)
  .map(addIndices);

print(
  'Indexed collection:',
  indexed
);


// ============================================================
// 7. MONTHS
// ============================================================

var months = ee.List.sequence(1, 12);


// ============================================================
// 8. MONTHLY IMAGE
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

  var collection = indexed.filterDate(
    start,
    end
  );

  var count = collection.size();


  // Empty image with correct bands
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
// 9. MONTHLY COLLECTION
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
      reducer: ee.Reducer.mean(),
      geometry: ROI,
      scale: 10,
      bestEffort: true,
      maxPixels: 1e9
    });


  return ee.Feature(null, {

    year: image.get('year'),

    month: image.get('month'),

    date: image.get('date'),

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

  });
}


// ============================================================
// 11. MONTHLY STATISTICS
// ============================================================

var monthlyStats =
  ee.FeatureCollection(
    monthlyImages.map(imageToFeature)
  );

print(
  'Monthly statistics:',
  monthlyStats
);


// ============================================================
// 12. YEAR DATA
// ============================================================

var data2018 = monthlyStats
  .filter(
    ee.Filter.eq('year', 2018)
  )
  .sort('month');

var data2019 = monthlyStats
  .filter(
    ee.Filter.eq('year', 2019)
  )
  .sort('month');

print(
  '2018 statistics:',
  data2018
);

print(
  '2019 statistics:',
  data2019
);


// ============================================================
// 13. MONTHLY COMPARISON
// ============================================================

var list2018 = data2018.toList(12);
var list2019 = data2019.toList(12);


function percentageChange(oldValue, newValue) {

  oldValue = ee.Number(oldValue);
  newValue = ee.Number(newValue);

  return ee.Algorithms.If(
    oldValue.abs().gt(0.000001),

    newValue
      .subtract(oldValue)
      .divide(oldValue.abs())
      .multiply(100),

    null
  );
}


var monthlyComparison =
  ee.FeatureCollection(

    months.map(function(month) {

      month = ee.Number(month);

      var f2018 = ee.Feature(
        list2018.get(
          month.subtract(1)
        )
      );

      var f2019 = ee.Feature(
        list2019.get(
          month.subtract(1)
        )
      );


      return ee.Feature(null, {

        month: month,

        NDVI_2018:
          f2018.get('NDVI'),

        NDVI_2019:
          f2019.get('NDVI'),

        NDVI_change_pct:
          percentageChange(
            f2018.get('NDVI'),
            f2019.get('NDVI')
          ),


        BSI_2018:
          f2018.get('BSI'),

        BSI_2019:
          f2019.get('BSI'),

        BSI_change_pct:
          percentageChange(
            f2018.get('BSI'),
            f2019.get('BSI')
          ),


        MNDWI_2018:
          f2018.get('MNDWI'),

        MNDWI_2019:
          f2019.get('MNDWI'),

        MNDWI_change_pct:
          percentageChange(
            f2018.get('MNDWI'),
            f2019.get('MNDWI')
          ),


        NDTI_2018:
          f2018.get('NDTI'),

        NDTI_2019:
          f2019.get('NDTI'),

        NDTI_change_pct:
          percentageChange(
            f2018.get('NDTI'),
            f2019.get('NDTI')
          ),


        TSM_2018:
          f2018.get('TSM'),

        TSM_2019:
          f2019.get('TSM'),

        TSM_change_pct:
          percentageChange(
            f2018.get('TSM'),
            f2019.get('TSM')
          )

      });

    })

  );


print(
  '2018 to 2019 Monthly Comparison:',
  monthlyComparison
);


// ============================================================
// 14. ANNUAL MEAN
// ============================================================

function annualMean(year, property) {

  return ee.Number(
    monthlyStats
      .filter(
        ee.Filter.eq('year', year)
      )
      .aggregate_mean(property)
  );
}


// ============================================================
// 15. ANNUAL TABLE
// ============================================================

var annualBase =
  ee.FeatureCollection([

    ee.Feature(null, {

      NDVI_2018:
        annualMean(2018, 'NDVI'),

      NDVI_2019:
        annualMean(2019, 'NDVI'),


      BSI_2018:
        annualMean(2018, 'BSI'),

      BSI_2019:
        annualMean(2019, 'BSI'),


      MNDWI_2018:
        annualMean(2018, 'MNDWI'),

      MNDWI_2019:
        annualMean(2019, 'MNDWI'),


      NDTI_2018:
        annualMean(2018, 'NDTI'),

      NDTI_2019:
        annualMean(2019, 'NDTI'),


      TSM_2018:
        annualMean(2018, 'TSM'),

      TSM_2019:
        annualMean(2019, 'TSM')

    })

  ]);


// ============================================================
// 16. ANNUAL CHANGE
// ============================================================

var annualComparison =
  annualBase.map(function(feature) {

    return feature

      .set(
        'NDVI_change_pct',
        percentageChange(
          feature.get('NDVI_2018'),
          feature.get('NDVI_2019')
        )
      )

      .set(
        'BSI_change_pct',
        percentageChange(
          feature.get('BSI_2018'),
          feature.get('BSI_2019')
        )
      )

      .set(
        'MNDWI_change_pct',
        percentageChange(
          feature.get('MNDWI_2018'),
          feature.get('MNDWI_2019')
        )
      )

      .set(
        'NDTI_change_pct',
        percentageChange(
          feature.get('NDTI_2018'),
          feature.get('NDTI_2019')
        )
      )

      .set(
        'TSM_change_pct',
        percentageChange(
          feature.get('TSM_2018'),
          feature.get('TSM_2019')
        )
      );

  });


print(
  'Annual 2018 to 2019 Comparison:',
  annualComparison
);


// ============================================================
// 17. CORRELATION FUNCTION
// ============================================================

function getCorrelation(
  collection,
  x,
  y
) {

  var valid = collection.filter(
    ee.Filter.notNull([
      x,
      y
    ])
  );

  var result = valid.reduceColumns({

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
// 18. CORRELATION TABLE
// ============================================================

var relationships = [

  ['NDVI', 'BSI', 'NDVI vs BSI'],

  ['BSI', 'NDTI', 'BSI vs NDTI'],

  ['NDTI', 'TSM', 'NDTI vs TSM'],

  ['MNDWI', 'NDTI', 'MNDWI vs NDTI']

];


var correlationTable =
  ee.FeatureCollection(

    relationships.map(function(pair) {

      var r2018 =
        getCorrelation(
          data2018,
          pair[0],
          pair[1]
        );

      var r2019 =
        getCorrelation(
          data2019,
          pair[0],
          pair[1]
        );


      return ee.Feature(null, {

        relationship: pair[2],

        variable_x: pair[0],

        variable_y: pair[1],

        correlation_2018: r2018,

        correlation_2019: r2019,

        correlation_change:
          ee.Algorithms.If(
            ee.Number(r2018).neq(null),
            ee.Number(r2019)
              .subtract(
                ee.Number(r2018)
              ),
            null
          )

      });

    })

  );


print(
  'Correlation Table:',
  correlationTable
);


// ============================================================
// 19. CORRELATION CHART
// ============================================================

var correlationChart =
  ui.Chart.feature.byFeature({

    features:
      correlationTable,

    xProperty:
      'relationship',

    yProperties: [
      'correlation_2018',
      'correlation_2019'
    ]

  })
  .setChartType('ColumnChart')
  .setOptions({

    title:
      'Maheshwar Ghat — Correlation 2018 vs 2019',

    hAxis: {
      title: 'Relationship',
      slantedText: true,
      slantedTextAngle: 35
    },

    vAxis: {
      title: 'Correlation (r)',
      viewWindow: {
        min: -1,
        max: 1
      }
    },

    colors: [
      '#1565C0',
      '#E53935'
    ],

    legend: {
      position: 'bottom'
    }

  });

print(
  correlationChart
);


// ============================================================
// 20. ANNUAL PERCENTAGE DATA
// ============================================================

var annualFeature =
  ee.Feature(
    annualComparison.first()
  );


var annualPct =
  ee.FeatureCollection([

    ee.Feature(null, {
      index: 'NDVI',
      change:
        annualFeature.get(
          'NDVI_change_pct'
        )
    }),

    ee.Feature(null, {
      index: 'BSI',
      change:
        annualFeature.get(
          'BSI_change_pct'
        )
    }),

    ee.Feature(null, {
      index: 'MNDWI',
      change:
        annualFeature.get(
          'MNDWI_change_pct'
        )
    }),

    ee.Feature(null, {
      index: 'NDTI',
      change:
        annualFeature.get(
          'NDTI_change_pct'
        )
    }),

    ee.Feature(null, {
      index: 'TSM',
      change:
        annualFeature.get(
          'TSM_change_pct'
        )
    })

  ]);


var annualPctChart =
  ui.Chart.feature.byFeature({

    features:
      annualPct,

    xProperty:
      'index',

    yProperties: [
      'change'
    ]

  })
  .setChartType('ColumnChart')
  .setOptions({

    title:
      'Maheshwar Ghat — 2018 to 2019 Relative Change',

    hAxis: {
      title: 'Index'
    },

    vAxis: {
      title: 'Change (%)',
      baseline: 0
    },

    colors: [
      '#7B1FA2'
    ],

    legend: {
      position: 'none'
    }

  });

print(
  annualPctChart
);


// ============================================================
// 21. MONTHLY CHANGE CHART
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

      yProperties: [
        property + '_change_pct'
      ]

    })
    .setChartType('ColumnChart')
    .setOptions({

      title: title,

      hAxis: {
        title: 'Month',
        ticks: [
          1, 2, 3, 4, 5, 6,
          7, 8, 9, 10, 11, 12
        ]
      },

      vAxis: {
        title: '2018 to 2019 Change (%)',
        baseline: 0
      },

      colors: [
        color
      ],

      legend: {
        position: 'none'
      }

    });

  print(chart);
}


relativeChangeChart(
  'NDVI',
  'NDVI — Monthly Change 2018 to 2019',
  '#00A86B'
);

relativeChangeChart(
  'BSI',
  'BSI — Monthly Change 2018 to 2019',
  '#795548'
);

relativeChangeChart(
  'MNDWI',
  'MNDWI — Monthly Change 2018 to 2019',
  '#1565C0'
);

relativeChangeChart(
  'NDTI',
  'NDTI — Monthly Change 2018 to 2019',
  '#EF6C00'
);

relativeChangeChart(
  'TSM',
  'TSM — Monthly Change 2018 to 2019',
  '#D32F2F'
);


// ============================================================
// 22. TWO YEAR LINE CHART
// ============================================================

function twoYearChart(
  property,
  title,
  yTitle
) {

  var data =
    monthlyStats.filter(
      ee.Filter.or(
        ee.Filter.eq('year', 2018),
        ee.Filter.eq('year', 2019)
      )
    );


  var chart =
    ui.Chart.feature.groups({

      features: data,

      xProperty: 'month',

      yProperty: property,

      seriesProperty: 'year'

    })
    .setChartType('LineChart')
    .setOptions({

      title: title,

      hAxis: {
        title: 'Month',
        ticks: [
          1, 2, 3, 4, 5, 6,
          7, 8, 9, 10, 11, 12
        ]
      },

      vAxis: {
        title: yTitle
      },

      colors: [
        '#1565C0',
        '#E53935'
      ],

      lineWidth: 4,

      pointSize: 6,

      legend: {
        position: 'bottom'
      }

    });

  print(chart);
}


twoYearChart(
  'NDVI',
  'Monthly NDVI — 2018 vs 2019',
  'Mean NDVI'
);

twoYearChart(
  'BSI',
  'Monthly BSI — 2018 vs 2019',
  'Mean BSI'
);

twoYearChart(
  'MNDWI',
  'Monthly MNDWI — 2018 vs 2019',
  'Mean MNDWI'
);

twoYearChart(
  'NDTI',
  'Monthly NDTI — 2018 vs 2019',
  'Mean NDTI'
);

twoYearChart(
  'TSM',
  'Monthly TSM — 2018 vs 2019',
  'TSM Proxy'
);


// ============================================================
// 23. SCATTER CHART
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
          ee.Filter.eq('year', 2018),
          ee.Filter.eq('year', 2019)
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

      features: data,

      xProperty: x,

      yProperties: [
        y
      ]

    })
    .setChartType('ScatterChart')
    .setOptions({

      title: title,

      hAxis: {
        title: xTitle
      },

      vAxis: {
        title: yTitle
      },

      colors: [
        color
      ],

      pointSize: 7,

      legend: {
        position: 'none'
      },

      trendlines: {
        0: {
          type: 'linear',
          lineWidth: 3,
          showR2: true
        }
      }

    });

  print(chart);
}


// ============================================================
// 24. REQUIRED SCATTER PLOTS
// ============================================================

scatterChart(
  'NDVI',
  'BSI',
  'NDVI vs BSI — Maheshwar 2018–2019',
  'NDVI',
  'BSI',
  '#00A86B'
);

scatterChart(
  'BSI',
  'NDTI',
  'BSI vs NDTI — Maheshwar 2018–2019',
  'BSI',
  'NDTI',
  '#795548'
);

scatterChart(
  'NDTI',
  'TSM',
  'NDTI vs TSM — Maheshwar 2018–2019',
  'NDTI',
  'TSM Proxy',
  '#EF6C00'
);

scatterChart(
  'MNDWI',
  'NDTI',
  'MNDWI vs NDTI — Maheshwar 2018–2019',
  'MNDWI',
  'NDTI',
  '#1565C0'
);


// ============================================================
// 25. 2018 COMPOSITE
// ============================================================

var composite2018 =
  indexed
    .filterDate(
      '2018-01-01',
      '2019-01-01'
    )
    .median()
    .clip(ROI);


// ============================================================
// 26. 2019 COMPOSITE
// ============================================================

var composite2019 =
  indexed
    .filterDate(
      '2019-01-01',
      '2020-01-01'
    )
    .median()
    .clip(ROI);


// ============================================================
// 27. RGB MAPS
// ============================================================

Map.addLayer(
  composite2018,
  {
    bands: [
      'B4',
      'B3',
      'B2'
    ],
    min: 0,
    max: 0.3
  },
  'RGB 2018'
);


Map.addLayer(
  composite2019,
  {
    bands: [
      'B4',
      'B3',
      'B2'
    ],
    min: 0,
    max: 0.3
  },
  'RGB 2019'
);


// ============================================================
// 28. NDVI MAPS
// ============================================================

var ndviVis = {
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
};


Map.addLayer(
  composite2018.select('NDVI'),
  ndviVis,
  'NDVI 2018'
);


Map.addLayer(
  composite2019.select('NDVI'),
  ndviVis,
  'NDVI 2019'
);


// ============================================================
// 29. BSI 2019
// ============================================================

Map.addLayer(
  composite2019.select('BSI'),
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
  'BSI 2019'
);


// ============================================================
// 30. MNDWI 2019
// ============================================================

Map.addLayer(
  composite2019.select('MNDWI'),
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
  'MNDWI 2019'
);


// ============================================================
// 31. NDTI 2019
// ============================================================

Map.addLayer(
  composite2019.select('NDTI'),
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
  'NDTI 2019'
);


// ============================================================
// 32. TSM 2019
// ============================================================

Map.addLayer(
  composite2019.select('TSM'),
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
  'TSM 2019'
);


// ============================================================
// 33. EXPORT MONTHLY COMPARISON
// ============================================================

Export.table.toDrive({

  collection:
    monthlyComparison,

  description:
    'Maheshwar_2018_2019_MONTHLY_COMPARISON',

  folder:
    'Maheshwar_Narmada_Research',

  fileNamePrefix:
    'Maheshwar_2018_2019_MONTHLY_COMPARISON',

  fileFormat:
    'CSV'

});


// ============================================================
// 34. EXPORT ANNUAL
// ============================================================

Export.table.toDrive({

  collection:
    annualComparison,

  description:
    'Maheshwar_2018_2019_ANNUAL_COMPARISON',

  folder:
    'Maheshwar_Narmada_Research',

  fileNamePrefix:
    'Maheshwar_2018_2019_ANNUAL_COMPARISON',

  fileFormat:
    'CSV'

});


// ============================================================
// 35. EXPORT CORRELATION
// ============================================================

Export.table.toDrive({

  collection:
    correlationTable,

  description:
    'Maheshwar_2018_2019_CORRELATION_TABLE',

  folder:
    'Maheshwar_Narmada_Research',

  fileNamePrefix:
    'Maheshwar_2018_2019_CORRELATION_TABLE',

  fileFormat:
    'CSV'

});


// ============================================================
// 36. EXPORT RAW MONTHLY DATA
// ============================================================

Export.table.toDrive({

  collection:
    monthlyStats,

  description:
    'Maheshwar_2018_2019_MONTHLY_RAW_INDICES',

  folder:
    'Maheshwar_Narmada_Research',

  fileNamePrefix:
    'Maheshwar_2018_2019_MONTHLY_RAW_INDICES',

  fileFormat:
    'CSV'

});


// ============================================================
// 37. FINAL SUMMARY
// ============================================================

print(
  '===================================================='
);

print(
  'MAHESHWAR GHAT — NARMADA RIVER'
);

print(
  '2018 → 2019 MULTI-INDEX ANALYSIS'
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
  'Period: 2018–2019'
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
  'Monthly statistics completed'
);

print(
  'Annual comparison completed'
);

print(
  '2018 vs 2019 percentage change completed'
);

print(
  'Correlation analysis completed'
);

print(
  'Scatter plots completed'
);

print(
  'Monthly line charts completed'
);

print(
  'Monthly percentage charts completed'
);

print(
  'RGB maps completed'
);

print(
  'Index maps completed'
);

print(
  'CSV exports created'
);

print(
  '===================================================='
);
