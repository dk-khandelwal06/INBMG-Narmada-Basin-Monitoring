/***************************************************************
 OMKARESHWAR - NARMADA RIVER
 2018 vs 2019 MULTI-INDEX ANALYSIS

 Sentinel-2 SR Harmonized

 STUDY AREA:
 Omkareshwar, Madhya Pradesh, India

 INDICES:
 NDVI
 BSI
 NDWI
 MNDWI
 NDTI
 TSM_PROXY
 FAI

 OUTPUT:
 Monthly statistics
 2018 vs 2019 comparison
 Correlations
 Scatter plots
 Colourful charts
 Maps
 CSV exports

 IMPORTANT:
 TSM_PROXY is a spectral proxy, NOT laboratory TSM.
***************************************************************/


// ============================================================
// 1. STUDY AREA
// ============================================================

var ROI = ee.Geometry.Polygon([
  [
    [76.1350, 22.2580],
    [76.1750, 22.2580],
    [76.1750, 22.2250],
    [76.1350, 22.2250],
    [76.1350, 22.2580]
  ]
]);


// Omkareshwar temple/core point
var temple = ee.Geometry.Point([
  76.1510,
  22.2456
]);


Map.centerObject(
  ROI,
  13
);


Map.addLayer(
  ROI,
  {
    color: 'red'
  },
  'Omkareshwar Study Area'
);


Map.addLayer(
  temple,
  {
    color: 'yellow'
  },
  'Omkareshwar Temple'
);


// ============================================================
// 2. YEARS
// ============================================================

var START =
  '2018-01-01';

var END =
  '2020-01-01';


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
    START,
    END
  )
  .filter(
    ee.Filter.lt(
      'CLOUDY_PIXEL_PERCENTAGE',
      80
    )
  );


print(
  '======================================'
);

print(
  'Sentinel-2 image count 2018-2019:',
  s2.size()
);

print(
  '======================================'
);


// ============================================================
// 4. CLOUD MASK
// ============================================================
//
// SCL is used here because it provides
// scene classification information.
//
// Removed:
// 1 = saturated/defective
// 3 = cloud shadow
// 8 = cloud medium probability
// 9 = cloud high probability
// 10 = cirrus
// 11 = snow/ice
//
// ============================================================

function maskS2(image) {

  var scl =
    image.select(
      'SCL'
    );


  var mask =
    scl.neq(1)
      .and(
        scl.neq(3)
      )
      .and(
        scl.neq(8)
      )
      .and(
        scl.neq(9)
      )
      .and(
        scl.neq(10)
      )
      .and(
        scl.neq(11)
      );


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


var clean =
  s2.map(
    maskS2
  );


print(
  'Cloud masked image count:',
  clean.size()
);


// ============================================================
// 5. ADD SPECTRAL INDICES
// ============================================================

function addIndices(image) {

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

  var swir2 =
    image.select(
      'B12'
    );


  // ----------------------------------------------------------
  // NDVI
  // ----------------------------------------------------------

  var NDVI =
    nir
      .subtract(
        red
      )
      .divide(
        nir.add(
          red
        )
      )
      .rename(
        'NDVI'
      );


  // ----------------------------------------------------------
  // NDWI
  // ----------------------------------------------------------

  var NDWI =
    green
      .subtract(
        nir
      )
      .divide(
        green.add(
          nir
        )
      )
      .rename(
        'NDWI'
      );


  // ----------------------------------------------------------
  // MNDWI
  // ----------------------------------------------------------

  var MNDWI =
    green
      .subtract(
        swir1
      )
      .divide(
        green.add(
          swir1
        )
      )
      .rename(
        'MNDWI'
      );


  // ----------------------------------------------------------
  // BSI
  // ----------------------------------------------------------

  var BSI =
    swir1
      .add(
        red
      )
      .subtract(
        nir.add(
          blue
        )
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
  // NDTI
  // ----------------------------------------------------------

  var NDTI =
    red
      .subtract(
        green
      )
      .divide(
        red.add(
          green
        )
      )
      .rename(
        'NDTI'
      );


  // ----------------------------------------------------------
  // TSM PROXY
  // ----------------------------------------------------------

  var TSM =
    red
      .divide(
        green
      )
      .rename(
        'TSM_PROXY'
      );


  // ----------------------------------------------------------
  // FAI
  // ----------------------------------------------------------

  var redWavelength =
    665;

  var nirWavelength =
    842;

  var swirWavelength =
    1610;


  var baseline =
    red.add(
      swir1
        .subtract(
          red
        )
        .multiply(
          (nirWavelength -
            redWavelength) /
          (swirWavelength -
            redWavelength)
        )
    );


  var FAI =
    nir
      .subtract(
        baseline
      )
      .rename(
        'FAI'
      );


  return image
    .addBands(
      NDVI
    )
    .addBands(
      BSI
    )
    .addBands(
      NDWI
    )
    .addBands(
      MNDWI
    )
    .addBands(
      NDTI
    )
    .addBands(
      TSM
    )
    .addBands(
      FAI
    );
}


var indexed =
  clean.map(
    addIndices
  );


print(
  'Indexed Sentinel-2 collection:',
  indexed
);


// ============================================================
// 6. MONTHLY COMPOSITES
// ============================================================

var years =
  ee.List([
    2018,
    2019
  ]);


var months =
  ee.List.sequence(
    1,
    12
  );


var monthlyNested =
  years.map(
    function(year) {

      year =
        ee.Number(
          year
        );


      return months.map(
        function(month) {

          month =
            ee.Number(
              month
            );


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
            indexed
              .filterDate(
                start,
                end
              );


          var count =
            collection.size();


          // IMPORTANT:
          // Create an empty image WITH ALL BANDS.
          // This prevents the previous
          // "Image has no bands" error.

          var empty =
            ee.Image.constant([
              0,
              0,
              0,
              0,
              0,
              0,
              0
            ])
            .rename([
              'NDVI',
              'BSI',
              'NDWI',
              'MNDWI',
              'NDTI',
              'TSM_PROXY',
              'FAI'
            ])
            .selfMask()
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
              'date',
              start.millis()
            )
            .set(
              'image_count',
              count
            );
        }
      );
    }
  );


var monthly =
  ee.ImageCollection.fromImages(
    ee.List(
      monthlyNested
    ).flatten()
  );


print(
  'Monthly composites:',
  monthly
);


// ============================================================
// 7. VALID MONTHS
// ============================================================

var validMonthly =
  monthly.filter(
    ee.Filter.gt(
      'image_count',
      0
    )
  );


print(
  'Valid monthly composites:',
  validMonthly.size()
);


// ============================================================
// 8. CHECK MONTHLY IMAGE COUNTS
// ============================================================

var imageCountTable =
  validMonthly.map(
    function(image) {

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

          image_count:
            image.get(
              'image_count'
            )
        }
      );
    }
  );


print(
  'Monthly Sentinel-2 image counts:',
  imageCountTable
);


// ============================================================
// 9. MONTHLY STATISTICS
// ============================================================

function makeMonthlyFeature(image) {

  var stats =
    image
      .select([
        'NDVI',
        'BSI',
        'NDWI',
        'MNDWI',
        'NDTI',
        'TSM_PROXY',
        'FAI'
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

      NDWI:
        stats.get(
          'NDWI'
        ),

      MNDWI:
        stats.get(
          'MNDWI'
        ),

      NDTI:
        stats.get(
          'NDTI'
        ),

      TSM_PROXY:
        stats.get(
          'TSM_PROXY'
        ),

      FAI:
        stats.get(
          'FAI'
        )
    }
  );
}


var statistics =
  ee.FeatureCollection(
    validMonthly.map(
      makeMonthlyFeature
    )
  );


print(
  '======================================'
);

print(
  'MONTHLY STATISTICS',
  statistics
);

print(
  '======================================'
);


// ============================================================
// 10. SPLIT 2018 / 2019
// ============================================================

var data2018 =
  statistics.filter(
    ee.Filter.eq(
      'year',
      2018
    )
  );


var data2019 =
  statistics.filter(
    ee.Filter.eq(
      'year',
      2019
    )
  );


print(
  '2018 statistics:',
  data2018
);


print(
  '2019 statistics:',
  data2019
);


// ============================================================
// 11. CORRELATION FUNCTION
// ============================================================

function correlation(
  data,
  x,
  y
) {

  var filtered =
    data.filter(
      ee.Filter.notNull([
        x,
        y
      ])
    );


  return filtered
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
// 12. IMPORTANT ECOLOGICAL PAIRS
// ============================================================

var pairs = [

  ['NDVI', 'BSI'],

  ['BSI', 'NDTI'],

  ['BSI', 'TSM_PROXY'],

  ['NDVI', 'NDTI'],

  ['NDVI', 'TSM_PROXY'],

  ['NDTI', 'TSM_PROXY'],

  ['MNDWI', 'NDTI'],

  ['MNDWI', 'TSM_PROXY'],

  ['NDWI', 'NDTI'],

  ['FAI', 'NDTI'],

  ['FAI', 'TSM_PROXY']
];


// ============================================================
// 13. CORRELATION TABLE
// ============================================================

function makeCorrelationTable(
  data,
  year
) {

  var features =
    pairs.map(
      function(pair) {

        var r =
          correlation(
            data,
            pair[0],
            pair[1]
          );


        return ee.Feature(
          null,
          {

            year:
              year,

            variable_1:
              pair[0],

            variable_2:
              pair[1],

            correlation:
              r
          }
        );
      }
    );


  return ee.FeatureCollection(
    features
  );
}


var corr2018 =
  makeCorrelationTable(
    data2018,
    2018
  );


var corr2019 =
  makeCorrelationTable(
    data2019,
    2019
  );


print(
  '2018 correlation table:',
  corr2018
);


print(
  '2019 correlation table:',
  corr2019
);


// ============================================================
// 14. CORRELATION CHANGE
// ============================================================

var list2018 =
  corr2018.toList(
    corr2018.size()
  );


var list2019 =
  corr2019.toList(
    corr2019.size()
  );


var changeList =
  ee.List.sequence(
    0,
    corr2018.size()
      .subtract(1)
  )
  .map(
    function(i) {

      var f18 =
        ee.Feature(
          list2018.get(i)
        );


      var f19 =
        ee.Feature(
          list2019.get(i)
        );


      var r18 =
        ee.Number(
          f18.get(
            'correlation'
          )
        );


      var r19 =
        ee.Number(
          f19.get(
            'correlation'
          )
        );


      return ee.Feature(
        null,
        {

          variable_1:
            f18.get(
              'variable_1'
            ),

          variable_2:
            f18.get(
              'variable_2'
            ),

          correlation_2018:
            r18,

          correlation_2019:
            r19,

          change_2019_minus_2018:
            r19.subtract(
              r18
            )
        }
      );
    }
  );


var correlationChange =
  ee.FeatureCollection(
    changeList
  );


print(
  'CORRELATION CHANGE 2019 - 2018:',
  correlationChange
);


// ============================================================
// 15. CHART FUNCTION
// ============================================================

function makeYearChart(
  property,
  title,
  yTitle
) {

  var chart =
    ui.Chart.feature.groups({

      features:
        statistics,

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
          1, 2, 3, 4,
          5, 6, 7, 8,
          9, 10, 11, 12
        ],

        slantedText:
          true,

        slantedTextAngle:
          45
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
          'bottom'
      },

      chartArea: {

        left:
          80,

        right:
          30,

        top:
          60,

        bottom:
          100
      }
    });


  print(
    chart
  );
}


// ============================================================
// 16. COLOURFUL MONTHLY CHARTS
// ============================================================

makeYearChart(
  'NDVI',
  '🌿 NDVI — 2018 vs 2019',
  'NDVI'
);


makeYearChart(
  'BSI',
  '🟤 BSI — Bare Soil / Bank Exposure',
  'BSI'
);


makeYearChart(
  'NDWI',
  '💧 NDWI — 2018 vs 2019',
  'NDWI'
);


makeYearChart(
  'MNDWI',
  '🔵 MNDWI — Water Signal',
  'MNDWI'
);


makeYearChart(
  'NDTI',
  '🟠 NDTI — Turbidity Proxy',
  'NDTI'
);


makeYearChart(
  'TSM_PROXY',
  '🔴 TSM Proxy — 2018 vs 2019',
  'TSM Proxy'
);


makeYearChart(
  'FAI',
  '🟣 FAI — Floating Material Proxy',
  'FAI'
);


// ============================================================
// 17. ECOLOGICAL CHAIN CHART
// ============================================================

var chainChart =
  ui.Chart.feature.byFeature({

    features:
      statistics.sort(
        'date'
      ),

    xProperty:
      'date',

    yProperties: [
      'NDVI',
      'BSI',
      'NDTI',
      'TSM_PROXY'
    ]

  })
  .setChartType(
    'LineChart'
  )
  .setOptions({

    title:
      '🌿 → 🟤 → 🟠 → 🔴 Ecological Coupling',

    hAxis: {

      title:
        'Date',

      format:
        'MMM yyyy',

      slantedText:
        true,

      slantedTextAngle:
        45
    },

    vAxis: {

      title:
        'Index / Proxy'
    },

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
  chainChart
);


// ============================================================
// 18. SCATTER CHART FUNCTION
// ============================================================

function makeScatter(
  x,
  y,
  title
) {

  var chart =
    ui.Chart.feature.byFeature({

      features:
        statistics.filter(
          ee.Filter.notNull([
            x,
            y
          ])
        ),

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

      hAxis: {

        title:
          x
      },

      vAxis: {

        title:
          y
      },

      pointSize:
        8,

      trendlines: {

        0: {

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
// 19. IMPORTANT SCATTER PLOTS
// ============================================================

makeScatter(
  'NDVI',
  'BSI',
  '🌿 NDVI vs 🟤 BSI'
);


makeScatter(
  'BSI',
  'NDTI',
  '🟤 BSI vs 🟠 NDTI'
);


makeScatter(
  'BSI',
  'TSM_PROXY',
  '🟤 BSI vs 🔴 TSM Proxy'
);


makeScatter(
  'NDVI',
  'NDTI',
  '🌿 NDVI vs 🟠 NDTI'
);


makeScatter(
  'NDTI',
  'TSM_PROXY',
  '🟠 NDTI vs 🔴 TSM Proxy'
);


makeScatter(
  'MNDWI',
  'NDTI',
  '🔵 MNDWI vs 🟠 NDTI'
);


makeScatter(
  'FAI',
  'NDTI',
  '🟣 FAI vs 🟠 NDTI'
);


// ============================================================
// 20. ANNUAL MEANS
// ============================================================

var indexNames = [
  'NDVI',
  'BSI',
  'NDWI',
  'MNDWI',
  'NDTI',
  'TSM_PROXY',
  'FAI'
];


var annualFeatures =
  indexNames.map(
    function(index) {

      var mean2018 =
        data2018.aggregate_mean(
          index
        );


      var mean2019 =
        data2019.aggregate_mean(
          index
        );


      return ee.Feature(
        null,
        {

          index:
            index,

          year2018:
            mean2018,

          year2019:
            mean2019
        }
      );
    }
  );


var annual =
  ee.FeatureCollection(
    annualFeatures
  );


print(
  'ANNUAL MEAN 2018 vs 2019:',
  annual
);


// ============================================================
// 21. ANNUAL CHANGE
// ============================================================

var annualChange =
  annual.map(
    function(feature) {

      var v18 =
        ee.Number(
          feature.get(
            'year2018'
          )
        );


      var v19 =
        ee.Number(
          feature.get(
            'year2019'
          )
        );


      var change =
        v19.subtract(
          v18
        );


      var percentChange =
        ee.Algorithms.If(

          v18.abs().gt(
            0.000001
          ),

          change
            .divide(
              v18.abs()
            )
            .multiply(
              100
            ),

          null
        );


      return feature
        .set(
          'absolute_change',
          change
        )
        .set(
          'percent_change',
          percentChange
        );
    }
  );


print(
  '2018 → 2019 CHANGE:',
  annualChange
);


// ============================================================
// 22. ANNUAL BAR CHART
// ============================================================

var annualChart =
  ui.Chart.feature.byFeature({

    features:
      annualChange,

    xProperty:
      'index',

    yProperties: [
      'year2018',
      'year2019'
    ]

  })
  .setChartType(
    'ColumnChart'
  )
  .setOptions({

    title:
      '🌊 Omkareshwar Narmada — Annual 2018 vs 2019',

    hAxis: {

      title:
        'Index'
    },

    vAxis: {

      title:
        'Mean Value'
    },

    bar: {

      groupWidth:
        '70%'
    },

    legend: {

      position:
        'bottom'
    },

    chartArea: {

      left:
        80,

      right:
        30,

      top:
        60,

      bottom:
        100
    }
  });


print(
  annualChart
);


// ============================================================
// 23. MAP: 2018
// ============================================================

var image2018 =
  ee.Image(
    validMonthly
      .filter(
        ee.Filter.eq(
          'year',
          2018
        )
      )
      .first()
  );


Map.addLayer(
  image2018,
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
  '2018 RGB'
);


Map.addLayer(
  image2018.select(
    'NDVI'
  ),
  {

    min:
      -0.2,

    max:
      0.8,

    palette: [
      'red',
      'orange',
      'yellow',
      'lightgreen',
      'green',
      'darkgreen'
    ]

  },
  '2018 NDVI'
);


Map.addLayer(
  image2018.select(
    'MNDWI'
  ),
  {

    min:
      -0.5,

    max:
      0.7,

    palette: [
      'brown',
      'orange',
      'white',
      'cyan',
      'blue',
      'darkblue'
    ]

  },
  '2018 MNDWI'
);


Map.addLayer(
  image2018.select(
    'NDTI'
  ),
  {

    min:
      -0.4,

    max:
      0.4,

    palette: [
      'blue',
      'cyan',
      'yellow',
      'orange',
      'red',
      'darkred'
    ]

  },
  '2018 NDTI'
);


// ============================================================
// 24. MAP: 2019
// ============================================================

var image2019 =
  ee.Image(
    validMonthly
      .filter(
        ee.Filter.eq(
          'year',
          2019
        )
      )
      .first()
  );


Map.addLayer(
  image2019,
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
  '2019 RGB'
);


Map.addLayer(
  image2019.select(
    'NDVI'
  ),
  {

    min:
      -0.2,

    max:
      0.8,

    palette: [
      'red',
      'orange',
      'yellow',
      'lightgreen',
      'green',
      'darkgreen'
    ]

  },
  '2019 NDVI'
);


Map.addLayer(
  image2019.select(
    'MNDWI'
  ),
  {

    min:
      -0.5,

    max:
      0.7,

    palette: [
      'brown',
      'orange',
      'white',
      'cyan',
      'blue',
      'darkblue'
    ]

  },
  '2019 MNDWI'
);


Map.addLayer(
  image2019.select(
    'NDTI'
  ),
  {

    min:
      -0.4,

    max:
      0.4,

    palette: [
      'blue',
      'cyan',
      'yellow',
      'orange',
      'red',
      'darkred'
    ]

  },
  '2019 NDTI'
);


// ============================================================
// 25. EXPORT MONTHLY CSV
// ============================================================

Export.table.toDrive({

  collection:
    statistics,

  description:
    'Omkareshwar_Narmada_2018_2019_Monthly',

  folder:
    'Omkareshwar_Narmada_GEE',

  fileNamePrefix:
    'Omkareshwar_2018_2019_Monthly',

  fileFormat:
    'CSV'
});


// ============================================================
// 26. EXPORT ANNUAL CSV
// ============================================================

Export.table.toDrive({

  collection:
    annualChange,

  description:
    'Omkareshwar_Narmada_2018_2019_Annual',

  folder:
    'Omkareshwar_Narmada_GEE',

  fileNamePrefix:
    'Omkareshwar_2018_2019_Annual',

  fileFormat:
    'CSV'
});


// ============================================================
// 27. EXPORT CORRELATION 2018
// ============================================================

Export.table.toDrive({

  collection:
    corr2018,

  description:
    'Omkareshwar_Correlation_2018',

  folder:
    'Omkareshwar_Narmada_GEE',

  fileNamePrefix:
    'Omkareshwar_Correlation_2018',

  fileFormat:
    'CSV'
});


// ============================================================
// 28. EXPORT CORRELATION 2019
// ============================================================

Export.table.toDrive({

  collection:
    corr2019,

  description:
    'Omkareshwar_Correlation_2019',

  folder:
    'Omkareshwar_Narmada_GEE',

  fileNamePrefix:
    'Omkareshwar_Correlation_2019',

  fileFormat:
    'CSV'
});


// ============================================================
// 29. EXPORT CORRELATION CHANGE
// ============================================================

Export.table.toDrive({

  collection:
    correlationChange,

  description:
    'Omkareshwar_Correlation_Change_2018_2019',

  folder:
    'Omkareshwar_Narmada_GEE',

  fileNamePrefix:
    'Omkareshwar_Correlation_Change_2018_2019',

  fileFormat:
    'CSV'
});


// ============================================================
// 30. FINAL INFORMATION
// ============================================================

print(
  '============================================'
);

print(
  '🌊 OMKARESHWAR NARMADA'
);

print(
  '2018 vs 2019 ANALYSIS COMPLETE'
);

print(
  '============================================'
);

print(
  '✓ Sentinel-2 SR Harmonized'
);

print(
  '✓ Cloud masking'
);

print(
  '✓ Monthly composites'
);

print(
  '✓ NDVI'
);

print(
  '✓ BSI'
);

print(
  '✓ NDWI'
);

print(
  '✓ MNDWI'
);

print(
  '✓ NDTI'
);

print(
  '✓ TSM Proxy'
);

print(
  '✓ FAI'
);

print(
  '✓ 2018 vs 2019'
);

print(
  '✓ Correlation analysis'
);

print(
  '✓ Scatter plots'
);

print(
  '✓ Colourful charts'
);

print(
  '✓ Annual comparison'
);

print(
  '✓ CSV exports'
);

print(
  '============================================'
);
