/***************************************************************
 OMKARESHWAR - NARMADA RIVER
 2016 vs 2017 MULTI-INDEX ANALYSIS

 DATASET:
 Landsat 8 Collection 2 Tier 1 Level 2
 LANDSAT/LC08/C02/T1_L2

 WHY LANDSAT 8?
 Sentinel-2 does not provide a consistent 2016 SR record.
 Landsat 8 provides observations for BOTH 2016 and 2017.

 STUDY:
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
 2016 vs 2017
 Correlation analysis
 Scatter plots
 Colourful charts
 Annual comparison
 Maps
 CSV exports
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


// Omkareshwar temple point
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
// 2. DATE RANGE
// ============================================================

var START =
  '2016-01-01';

var END =
  '2018-01-01';


// ============================================================
// 3. LANDSAT 8 COLLECTION
// ============================================================

var landsat =
  ee.ImageCollection(
    'LANDSAT/LC08/C02/T1_L2'
  )
  .filterBounds(
    ROI
  )
  .filterDate(
    START,
    END
  );


print(
  '======================================'
);

print(
  'Landsat 8 image count 2016-2017:',
  landsat.size()
);

print(
  '======================================'
);


// ============================================================
// 4. LANDSAT CLOUD / SHADOW MASK
// ============================================================

function maskLandsat(image) {

  var qa =
    image.select(
      'QA_PIXEL'
    );


  // Bit 1 = Dilated cloud
  var dilatedCloud =
    1 << 1;


  // Bit 2 = Cirrus
  var cirrus =
    1 << 2;


  // Bit 3 = Cloud
  var cloud =
    1 << 3;


  // Bit 4 = Cloud shadow
  var cloudShadow =
    1 << 4;


  var mask =
    qa.bitwiseAnd(
      dilatedCloud
    ).eq(0)
    .and(
      qa.bitwiseAnd(
        cirrus
      ).eq(0)
    )
    .and(
      qa.bitwiseAnd(
        cloud
      ).eq(0)
    )
    .and(
      qa.bitwiseAnd(
        cloudShadow
      ).eq(0)
    );


  // ----------------------------------------------------------
  // Surface reflectance scale
  //
  // Landsat Collection 2:
  // SR = DN * 0.0000275 - 0.2
  // ----------------------------------------------------------

  var optical =
    image
      .select(
        'SR_B.*'
      )
      .multiply(
        0.0000275
      )
      .add(
        -0.2
      );


  return optical
    .updateMask(
      mask
    )
    .copyProperties(
      image,
      [
        'system:time_start'
      ]
    );
}


var clean =
  landsat.map(
    maskLandsat
  );


print(
  'Cloud masked Landsat images:',
  clean.size()
);


// ============================================================
// 5. ADD INDICES
// ============================================================
//
// Landsat 8:
//
// B2 = Blue
// B3 = Green
// B4 = Red
// B5 = NIR
// B6 = SWIR1
// B7 = SWIR2
//
// ============================================================

function addIndices(image) {

  var blue =
    image.select(
      'SR_B2'
    );

  var green =
    image.select(
      'SR_B3'
    );

  var red =
    image.select(
      'SR_B4'
    );

  var nir =
    image.select(
      'SR_B5'
    );

  var swir1 =
    image.select(
      'SR_B6'
    );

  var swir2 =
    image.select(
      'SR_B7'
    );


  // ==========================================================
  // NDVI
  // ==========================================================

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


  // ==========================================================
  // NDWI
  // ==========================================================

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


  // ==========================================================
  // MNDWI
  // ==========================================================

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


  // ==========================================================
  // BSI
  // ==========================================================

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


  // ==========================================================
  // NDTI
  // ==========================================================

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


  // ==========================================================
  // TSM PROXY
  // ==========================================================
  //
  // This is a spectral proxy.
  // It is NOT laboratory measured TSM.
  //
  // ==========================================================

  var TSM =
    red
      .divide(
        green
      )
      .rename(
        'TSM_PROXY'
      );


  // ==========================================================
  // FAI
  // ==========================================================
  //
  // Approximate Floating Algae Index style calculation
  // using Landsat-8 spectral bands.
  //
  // Red  ≈ 655 nm
  // NIR  ≈ 865 nm
  // SWIR ≈ 1609 nm
  //
  // ==========================================================

  var redWavelength =
    655;

  var nirWavelength =
    865;

  var swirWavelength =
    1609;


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
  'Indexed Landsat collection:',
  indexed
);


// ============================================================
// 6. MONTHLY COMPOSITES
// ============================================================

var years =
  ee.List([
    2016,
    2017
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


          // --------------------------------------------------
          // Empty image WITH BANDS
          //
          // This prevents:
          //
          // Image.select:
          // Band pattern NDVI applied to Image with no bands
          // --------------------------------------------------

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
// 7. ONLY VALID MONTHS
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
// 8. MONTHLY IMAGE COUNT TABLE
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
  'Monthly image counts:',
  imageCountTable
);


// ============================================================
// 9. MONTHLY STATISTICS
// ============================================================

function makeMonthlyFeature(
  image
) {

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
  'MONTHLY STATISTICS 2016-2017:',
  statistics
);

print(
  '======================================'
);


// ============================================================
// 10. SPLIT YEARS
// ============================================================

var data2016 =
  statistics.filter(
    ee.Filter.eq(
      'year',
      2016
    )
  );


var data2017 =
  statistics.filter(
    ee.Filter.eq(
      'year',
      2017
    )
  );


print(
  '2016 statistics:',
  data2016
);


print(
  '2017 statistics:',
  data2017
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
// 12. IMPORTANT ECOLOGICAL RELATIONSHIPS
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


var corr2016 =
  makeCorrelationTable(
    data2016,
    2016
  );


var corr2017 =
  makeCorrelationTable(
    data2017,
    2017
  );


print(
  '2016 Correlations:',
  corr2016
);


print(
  '2017 Correlations:',
  corr2017
);


// ============================================================
// 14. CORRELATION CHANGE
// ============================================================

var list2016 =
  corr2016.toList(
    corr2016.size()
  );


var list2017 =
  corr2017.toList(
    corr2017.size()
  );


var changeList =
  ee.List.sequence(
    0,
    corr2016.size()
      .subtract(1)
  )
  .map(
    function(i) {

      var f16 =
        ee.Feature(
          list2016.get(i)
        );


      var f17 =
        ee.Feature(
          list2017.get(i)
        );


      var r16 =
        ee.Number(
          f16.get(
            'correlation'
          )
        );


      var r17 =
        ee.Number(
          f17.get(
            'correlation'
          )
        );


      return ee.Feature(
        null,
        {

          variable_1:
            f16.get(
              'variable_1'
            ),

          variable_2:
            f16.get(
              'variable_2'
            ),

          correlation_2016:
            r16,

          correlation_2017:
            r17,

          change_2017_minus_2016:
            r17.subtract(
              r16
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
  'CORRELATION CHANGE 2017 - 2016:',
  correlationChange
);


// ============================================================
// 15. MONTHLY CHART FUNCTION
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
        7,

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
  '🌿 NDVI — 2016 vs 2017',
  'NDVI'
);


makeYearChart(
  'BSI',
  '🟤 BSI — Bare Soil / Bank Exposure',
  'BSI'
);


makeYearChart(
  'NDWI',
  '💧 NDWI — 2016 vs 2017',
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
  '🔴 TSM Proxy — 2016 vs 2017',
  'TSM Proxy'
);


makeYearChart(
  'FAI',
  '🟣 FAI — Floating Material Proxy',
  'FAI'
);


// ============================================================
// 17. ECOLOGICAL COUPLING CHART
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
      '🌿 → 🟤 → 🟠 → 🔴 Ecological Coupling 2016-2017',

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
// 18. SCATTER PLOT FUNCTION
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
// 19. SCATTER PLOTS
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
  '🟤 BSI vs 🔴 TSM'
);


makeScatter(
  'NDVI',
  'NDTI',
  '🌿 NDVI vs 🟠 NDTI'
);


makeScatter(
  'NDTI',
  'TSM_PROXY',
  '🟠 NDTI vs 🔴 TSM'
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

      var mean2016 =
        data2016.aggregate_mean(
          index
        );


      var mean2017 =
        data2017.aggregate_mean(
          index
        );


      return ee.Feature(
        null,
        {

          index:
            index,

          year2016:
            mean2016,

          year2017:
            mean2017
        }
      );
    }
  );


var annual =
  ee.FeatureCollection(
    annualFeatures
  );


print(
  'ANNUAL MEANS 2016 vs 2017:',
  annual
);


// ============================================================
// 21. ANNUAL CHANGE
// ============================================================

var annualChange =
  annual.map(
    function(feature) {

      var v16 =
        ee.Number(
          feature.get(
            'year2016'
          )
        );


      var v17 =
        ee.Number(
          feature.get(
            'year2017'
          )
        );


      var change =
        v17.subtract(
          v16
        );


      var percentChange =
        ee.Algorithms.If(

          v16.abs().gt(
            0.000001
          ),

          change
            .divide(
              v16.abs()
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
  '2016 → 2017 ANNUAL CHANGE:',
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
      'year2016',
      'year2017'
    ]

  })
  .setChartType(
    'ColumnChart'
  )
  .setOptions({

    title:
      '🌊 Omkareshwar Narmada — 2016 vs 2017',

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
// 23. FIRST VALID 2016 IMAGE
// ============================================================

var image2016 =
  ee.Image(
    validMonthly
      .filter(
        ee.Filter.eq(
          'year',
          2016
        )
      )
      .first()
  );


// ============================================================
// 24. 2016 RGB MAP
// ============================================================

Map.addLayer(
  image2016,
  {
    bands: [
      'SR_B4',
      'SR_B3',
      'SR_B2'
    ],

    min:
      0,

    max:
      0.3
  },
  '2016 RGB'
);


// ============================================================
// 25. 2016 NDVI MAP
// ============================================================

Map.addLayer(
  image2016.select(
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
  '2016 NDVI'
);


// ============================================================
// 26. 2016 MNDWI MAP
// ============================================================

Map.addLayer(
  image2016.select(
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
  '2016 MNDWI'
);


// ============================================================
// 27. 2016 NDTI MAP
// ============================================================

Map.addLayer(
  image2016.select(
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
  '2016 NDTI'
);


// ============================================================
// 28. FIRST VALID 2017 IMAGE
// ============================================================

var image2017 =
  ee.Image(
    validMonthly
      .filter(
        ee.Filter.eq(
          'year',
          2017
        )
      )
      .first()
  );


// ============================================================
// 29. 2017 RGB
// ============================================================

Map.addLayer(
  image2017,
  {
    bands: [
      'SR_B4',
      'SR_B3',
      'SR_B2'
    ],

    min:
      0,

    max:
      0.3
  },
  '2017 RGB'
);


// ============================================================
// 30. 2017 NDVI
// ============================================================

Map.addLayer(
  image2017.select(
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
  '2017 NDVI'
);


// ============================================================
// 31. 2017 MNDWI
// ============================================================

Map.addLayer(
  image2017.select(
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
  '2017 MNDWI'
);


// ============================================================
// 32. 2017 NDTI
// ============================================================

Map.addLayer(
  image2017.select(
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
  '2017 NDTI'
);


// ============================================================
// 33. EXPORT MONTHLY CSV
// ============================================================

Export.table.toDrive({

  collection:
    statistics,

  description:
    'Omkareshwar_Narmada_2016_2017_Monthly',

  folder:
    'Omkareshwar_Narmada_GEE',

  fileNamePrefix:
    'Omkareshwar_2016_2017_Monthly',

  fileFormat:
    'CSV'
});


// ============================================================
// 34. EXPORT ANNUAL CSV
// ============================================================

Export.table.toDrive({

  collection:
    annualChange,

  description:
    'Omkareshwar_Narmada_2016_2017_Annual',

  folder:
    'Omkareshwar_Narmada_GEE',

  fileNamePrefix:
    'Omkareshwar_2016_2017_Annual',

  fileFormat:
    'CSV'
});


// ============================================================
// 35. EXPORT CORRELATION 2016
// ============================================================

Export.table.toDrive({

  collection:
    corr2016,

  description:
    'Omkareshwar_Correlation_2016',

  folder:
    'Omkareshwar_Narmada_GEE',

  fileNamePrefix:
    'Omkareshwar_Correlation_2016',

  fileFormat:
    'CSV'
});


// ============================================================
// 36. EXPORT CORRELATION 2017
// ============================================================

Export.table.toDrive({

  collection:
    corr2017,

  description:
    'Omkareshwar_Correlation_2017',

  folder:
    'Omkareshwar_Narmada_GEE',

  fileNamePrefix:
    'Omkareshwar_Correlation_2017',

  fileFormat:
    'CSV'
});


// ============================================================
// 37. EXPORT CORRELATION CHANGE
// ============================================================

Export.table.toDrive({

  collection:
    correlationChange,

  description:
    'Omkareshwar_Correlation_Change_2016_2017',

  folder:
    'Omkareshwar_Narmada_GEE',

  fileNamePrefix:
    'Omkareshwar_Correlation_Change_2016_2017',

  fileFormat:
    'CSV'
});


// ============================================================
// 38. EXPORT IMAGE COUNT
// ============================================================

Export.table.toDrive({

  collection:
    imageCountTable,

  description:
    'Omkareshwar_Landsat_Image_Count_2016_2017',

  folder:
    'Omkareshwar_Narmada_GEE',

  fileNamePrefix:
    'Omkareshwar_Landsat_Image_Count_2016_2017',

  fileFormat:
    'CSV'
});


// ============================================================
// 39. FINAL MESSAGE
// ============================================================

print(
  '============================================'
);

print(
  '🌊 OMKARESHWAR NARMADA RIVER'
);

print(
  '2016 vs 2017 ANALYSIS COMPLETE'
);

print(
  '============================================'
);

print(
  '✓ Landsat 8 Collection 2 Level-2'
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
  '✓ FAI Proxy'
);

print(
  '✓ 2016 vs 2017'
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
