/***************************************************************
 OMKARESHWAR - NARMADA RIVER
 2020 vs 2021 MULTI-INDEX ECOLOGICAL ANALYSIS

 Sentinel-2 SR Harmonized

 INDICES
 NDVI
 BSI
 NDWI
 MNDWI
 NDTI
 TSM_PROXY
 FAI

 OUTPUTS
 ✓ Monthly composites
 ✓ Monthly statistics
 ✓ 2020 statistics
 ✓ 2021 statistics
 ✓ Annual comparison
 ✓ Correlation analysis
 ✓ Lag 0 / 1 / 2
 ✓ Colourful charts
 ✓ Scatter plots
 ✓ Ecological chain
 ✓ CSV exports
***************************************************************/


// ============================================================
// 1. OMKARESHWAR STUDY AREA
// ============================================================

// Core coordinates supplied:
// Latitude  22.2456
// Longitude 76.1510

// IMPORTANT:
// This is a river-study polygon around Omkareshwar,
// not just a single temple point.

var ROI = ee.Geometry.Polygon([
  [
    [76.1350, 22.2580],
    [76.1750, 22.2580],
    [76.1750, 22.2250],
    [76.1350, 22.2250],
    [76.1350, 22.2580]
  ]
]);


// Display ROI

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


// Temple point

var temple =
  ee.Geometry.Point([
    76.1510,
    22.2456
  ]);

Map.addLayer(
  temple,
  {
    color: 'yellow'
  },
  'Omkareshwar Temple'
);


// ============================================================
// 2. DATE
// ============================================================

var START =
  '2020-01-01';

var END =
  '2022-01-01';


// ============================================================
// 3. SENTINEL-2
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
  'Sentinel-2 images:',
  s2.size()
);


// ============================================================
// 4. CLOUD MASK
// ============================================================

function maskS2(
  image
) {

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
  'Cloud masked images:',
  clean.size()
);


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
  //
  // This is a spectral proxy.
  // Do NOT describe it as laboratory TSM
  // unless field calibration is available.
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
  'Indexed collection:',
  indexed
);


// ============================================================
// 6. MONTHLY COMPOSITES
// ============================================================

var years =
  ee.List([
    2020,
    2021
  ]);


var months =
  ee.List.sequence(
    1,
    12
  );


var monthlyList =
  years.map(
    function(
      year
    ) {

      year =
        ee.Number(
          year
        );


      return months.map(
        function(
          month
        ) {

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
            indexed.filterDate(
              start,
              end
            );


          var count =
            collection.size();


          // EMPTY IMAGE WITH ALL BANDS
          //
          // This prevents the
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
      monthlyList
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
  'Valid monthly images:',
  validMonthly.size()
);


// ============================================================
// 8. MONTHLY STATISTICS
// ============================================================

function monthlyStats(
  image
) {

  var result =
    image.select([
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
        result.get(
          'NDVI'
        ),

      BSI:
        result.get(
          'BSI'
        ),

      NDWI:
        result.get(
          'NDWI'
        ),

      MNDWI:
        result.get(
          'MNDWI'
        ),

      NDTI:
        result.get(
          'NDTI'
        ),

      TSM_PROXY:
        result.get(
          'TSM_PROXY'
        ),

      FAI:
        result.get(
          'FAI'
        )
    }
  );
}


var statistics =
  ee.FeatureCollection(
    validMonthly.map(
      monthlyStats
    )
  );


print(
  'MONTHLY STATISTICS',
  statistics
);


// ============================================================
// 9. 2020 / 2021
// ============================================================

var data2020 =
  statistics.filter(
    ee.Filter.eq(
      'year',
      2020
    )
  );


var data2021 =
  statistics.filter(
    ee.Filter.eq(
      'year',
      2021
    )
  );


print(
  '2020 DATA',
  data2020
);


print(
  '2021 DATA',
  data2021
);


// ============================================================
// 10. CORRELATION FUNCTION
// ============================================================

function getCorrelation(
  data,
  x,
  y
) {

  var cleanData =
    data.filter(
      ee.Filter.notNull([
        x,
        y
      ])
    );


  return cleanData
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
// 11. ECOLOGICAL CORRELATIONS
// ============================================================

var pairs = [

  [
    'NDVI',
    'BSI'
  ],

  [
    'BSI',
    'NDTI'
  ],

  [
    'BSI',
    'TSM_PROXY'
  ],

  [
    'NDVI',
    'NDTI'
  ],

  [
    'NDVI',
    'TSM_PROXY'
  ],

  [
    'NDTI',
    'TSM_PROXY'
  ],

  [
    'MNDWI',
    'NDTI'
  ],

  [
    'MNDWI',
    'TSM_PROXY'
  ],

  [
    'NDWI',
    'NDTI'
  ],

  [
    'FAI',
    'NDTI'
  ],

  [
    'FAI',
    'TSM_PROXY'
  ]
];


// ============================================================
// 12. CORRELATION TABLE
// ============================================================

function correlationTable(
  data,
  year
) {

  var list =
    pairs.map(
      function(pair) {

        var r =
          getCorrelation(
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
              r,

            absolute_correlation:
              ee.Number(
                r
              ).abs()
          }
        );
      }
    );


  return ee.FeatureCollection(
    list
  );
}


var corr2020 =
  correlationTable(
    data2020,
    2020
  );


var corr2021 =
  correlationTable(
    data2021,
    2021
  );


print(
  '2020 CORRELATIONS',
  corr2020
);


print(
  '2021 CORRELATIONS',
  corr2021
);


// ============================================================
// 13. CORRELATION CHANGE
// ============================================================

var c20 =
  corr2020.toList(
    corr2020.size()
  );


var c21 =
  corr2021.toList(
    corr2021.size()
  );


var change =
  ee.List.sequence(
    0,
    corr2020.size()
      .subtract(1)
  )
  .map(
    function(i) {

      var f20 =
        ee.Feature(
          c20.get(i)
        );


      var f21 =
        ee.Feature(
          c21.get(i)
        );


      var r20 =
        ee.Number(
          f20.get(
            'correlation'
          )
        );


      var r21 =
        ee.Number(
          f21.get(
            'correlation'
          )
        );


      return ee.Feature(
        null,
        {

          variable_1:
            f20.get(
              'variable_1'
            ),

          variable_2:
            f20.get(
              'variable_2'
            ),

          correlation_2020:
            r20,

          correlation_2021:
            r21,

          change:
            r21.subtract(
              r20
            )
        }
      );
    }
  );


var correlationChange =
  ee.FeatureCollection(
    change
  );


print(
  'CORRELATION CHANGE 2021 - 2020',
  correlationChange
);


// ============================================================
// 14. MONTHLY ECOLOGICAL CHAIN
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
      '🌿 Ecological Chain: NDVI → BSI → NDTI → TSM',

    hAxis: {

      title:
        'Month',

      format:
        'MMM yyyy',

      slantedText:
        true,

      slantedTextAngle:
        45
    },

    vAxis: {

      title:
        'Index / Proxy Value'
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
// 15. NDVI 2020 vs 2021
// ============================================================

var NDVIChart =
  ui.Chart.feature.groups({

    features:
      statistics,

    xProperty:
      'month',

    yProperty:
      'NDVI',

    seriesProperty:
      'year'

  })
  .setChartType(
    'LineChart'
  )
  .setOptions({

    title:
      '🌿 NDVI — 2020 vs 2021',

    hAxis: {

      title:
        'Month',

      ticks: [
        1, 2, 3, 4,
        5, 6, 7, 8,
        9, 10, 11, 12
      ]
    },

    vAxis: {

      title:
        'NDVI'
    },

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
  NDVIChart
);


// ============================================================
// 16. BSI 2020 vs 2021
// ============================================================

var BSIChart =
  ui.Chart.feature.groups({

    features:
      statistics,

    xProperty:
      'month',

    yProperty:
      'BSI',

    seriesProperty:
      'year'

  })
  .setChartType(
    'LineChart'
  )
  .setOptions({

    title:
      '🟤 BSI — Bare Soil / Bank Exposure',

    hAxis: {

      title:
        'Month'
    },

    vAxis: {

      title:
        'BSI'
    },

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
  BSIChart
);


// ============================================================
// 17. NDTI 2020 vs 2021
// ============================================================

var NDTIChart =
  ui.Chart.feature.groups({

    features:
      statistics,

    xProperty:
      'month',

    yProperty:
      'NDTI',

    seriesProperty:
      'year'

  })
  .setChartType(
    'LineChart'
  )
  .setOptions({

    title:
      '🟠 NDTI — Turbidity Proxy',

    hAxis: {

      title:
        'Month'
    },

    vAxis: {

      title:
        'NDTI'
    },

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
  NDTIChart
);


// ============================================================
// 18. TSM 2020 vs 2021
// ============================================================

var TSMChart =
  ui.Chart.feature.groups({

    features:
      statistics,

    xProperty:
      'month',

    yProperty:
      'TSM_PROXY',

    seriesProperty:
      'year'

  })
  .setChartType(
    'LineChart'
  )
  .setOptions({

    title:
      '🔴 TSM Proxy — 2020 vs 2021',

    hAxis: {

      title:
        'Month'
    },

    vAxis: {

      title:
        'TSM Proxy'
    },

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
  TSMChart
);


// ============================================================
// 19. MNDWI 2020 vs 2021
// ============================================================

var MNDWIChart =
  ui.Chart.feature.groups({

    features:
      statistics,

    xProperty:
      'month',

    yProperty:
      'MNDWI',

    seriesProperty:
      'year'

  })
  .setChartType(
    'LineChart'
  )
  .setOptions({

    title:
      '🔵 MNDWI — Water Signal 2020 vs 2021',

    hAxis: {

      title:
        'Month'
    },

    vAxis: {

      title:
        'MNDWI'
    },

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
  MNDWIChart
);


// ============================================================
// 20. NDWI 2020 vs 2021
// ============================================================

var NDWIChart =
  ui.Chart.feature.groups({

    features:
      statistics,

    xProperty:
      'month',

    yProperty:
      'NDWI',

    seriesProperty:
      'year'

  })
  .setChartType(
    'LineChart'
  )
  .setOptions({

    title:
      '💧 NDWI — 2020 vs 2021',

    hAxis: {

      title:
        'Month'
    },

    vAxis: {

      title:
        'NDWI'
    },

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
  NDWIChart
);


// ============================================================
// 21. FAI
// ============================================================

var FAIChart =
  ui.Chart.feature.groups({

    features:
      statistics,

    xProperty:
      'month',

    yProperty:
      'FAI',

    seriesProperty:
      'year'

  })
  .setChartType(
    'LineChart'
  )
  .setOptions({

    title:
      '🟣 FAI — Floating Material Proxy',

    hAxis: {

      title:
        'Month'
    },

    vAxis: {

      title:
        'FAI'
    },

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
  FAIChart
);


// ============================================================
// 22. SCATTER NDVI vs BSI
// ============================================================

var scatter1 =
  ui.Chart.feature.byFeature({

    features:
      statistics,

    xProperty:
      'NDVI',

    yProperties: [
      'BSI'
    ]

  })
  .setChartType(
    'ScatterChart'
  )
  .setOptions({

    title:
      '🌿 NDVI vs 🟤 BSI',

    hAxis: {

      title:
        'NDVI'
    },

    vAxis: {

      title:
        'BSI'
    },

    pointSize:
      8,

    trendlines: {

      0: {

        showR2:
          true
      }
    },

    legend: {

      position:
        'none'
    }
  });


print(
  scatter1
);


// ============================================================
// 23. SCATTER BSI vs NDTI
// ============================================================

var scatter2 =
  ui.Chart.feature.byFeature({

    features:
      statistics,

    xProperty:
      'BSI',

    yProperties: [
      'NDTI'
    ]

  })
  .setChartType(
    'ScatterChart'
  )
  .setOptions({

    title:
      '🟤 BSI vs 🟠 NDTI',

    hAxis: {

      title:
        'BSI'
    },

    vAxis: {

      title:
        'NDTI'
    },

    pointSize:
      8,

    trendlines: {

      0: {

        showR2:
          true
      }
    },

    legend: {

      position:
        'none'
    }
  });


print(
  scatter2
);


// ============================================================
// 24. SCATTER NDTI vs TSM
// ============================================================

var scatter3 =
  ui.Chart.feature.byFeature({

    features:
      statistics,

    xProperty:
      'NDTI',

    yProperties: [
      'TSM_PROXY'
    ]

  })
  .setChartType(
    'ScatterChart'
  )
  .setOptions({

    title:
      '🟠 NDTI vs 🔴 TSM Proxy',

    hAxis: {

      title:
        'NDTI'
    },

    vAxis: {

      title:
        'TSM Proxy'
    },

    pointSize:
      8,

    trendlines: {

      0: {

        showR2:
          true
      }
    },

    legend: {

      position:
        'none'
    }
  });


print(
  scatter3
);


// ============================================================
// 25. SCATTER NDVI vs NDTI
// ============================================================

var scatter4 =
  ui.Chart.feature.byFeature({

    features:
      statistics,

    xProperty:
      'NDVI',

    yProperties: [
      'NDTI'
    ]

  })
  .setChartType(
    'ScatterChart'
  )
  .setOptions({

    title:
      '🌿 NDVI vs 🟠 NDTI',

    hAxis: {

      title:
        'NDVI'
    },

    vAxis: {

      title:
        'NDTI'
    },

    pointSize:
      8,

    trendlines: {

      0: {

        showR2:
          true
      }
    },

    legend: {

      position:
        'none'
    }
  });


print(
  scatter4
);


// ============================================================
// 26. SCATTER MNDWI vs NDTI
// ============================================================

var scatter5 =
  ui.Chart.feature.byFeature({

    features:
      statistics,

    xProperty:
      'MNDWI',

    yProperties: [
      'NDTI'
    ]

  })
  .setChartType(
    'ScatterChart'
  )
  .setOptions({

    title:
      '🔵 MNDWI vs 🟠 NDTI',

    hAxis: {

      title:
        'MNDWI'
    },

    vAxis: {

      title:
        'NDTI'
    },

    pointSize:
      8,

    trendlines: {

      0: {

        showR2:
          true
      }
    },

    legend: {

      position:
        'none'
    }
  });


print(
  scatter5
);


// ============================================================
// 27. ANNUAL MEAN
// ============================================================

function annualMean(
  data,
  property
) {

  return data.aggregate_mean(
    property
  );
}


var annual =
  ee.FeatureCollection([

    ee.Feature(
      null,
      {
        index:
          'NDVI',

        year2020:
          annualMean(
            data2020,
            'NDVI'
          ),

        year2021:
          annualMean(
            data2021,
            'NDVI'
          )
      }
    ),

    ee.Feature(
      null,
      {
        index:
          'BSI',

        year2020:
          annualMean(
            data2020,
            'BSI'
          ),

        year2021:
          annualMean(
            data2021,
            'BSI'
          )
      }
    ),

    ee.Feature(
      null,
      {
        index:
          'NDWI',

        year2020:
          annualMean(
            data2020,
            'NDWI'
          ),

        year2021:
          annualMean(
            data2021,
            'NDWI'
          )
      }
    ),

    ee.Feature(
      null,
      {
        index:
          'MNDWI',

        year2020:
          annualMean(
            data2020,
            'MNDWI'
          ),

        year2021:
          annualMean(
            data2021,
            'MNDWI'
          )
      }
    ),

    ee.Feature(
      null,
      {
        index:
          'NDTI',

        year2020:
          annualMean(
            data2020,
            'NDTI'
          ),

        year2021:
          annualMean(
            data2021,
            'NDTI'
          )
      }
    ),

    ee.Feature(
      null,
      {
        index:
          'TSM_PROXY',

        year2020:
          annualMean(
            data2020,
            'TSM_PROXY'
          ),

        year2021:
          annualMean(
            data2021,
            'TSM_PROXY'
          )
      }
    ),

    ee.Feature(
      null,
      {
        index:
          'FAI',

        year2020:
          annualMean(
            data2020,
            'FAI'
          ),

        year2021:
          annualMean(
            data2021,
            'FAI'
          )
      }
    )
  ]);


// ============================================================
// 28. ANNUAL CHANGE
// ============================================================

var annualChange =
  annual.map(
    function(
      f
    ) {

      var v20 =
        ee.Number(
          f.get(
            'year2020'
          )
        );


      var v21 =
        ee.Number(
          f.get(
            'year2021'
          )
        );


      var difference =
        v21.subtract(
          v20
        );


      var percent =
        ee.Algorithms.If(

          v20.abs().gt(
            0.000001
          ),

          difference
            .divide(
              v20.abs()
            )
            .multiply(
              100
            ),

          null
        );


      return f
        .set(
          'absolute_change',
          difference
        )
        .set(
          'percent_change',
          percent
        );
    }
  );


print(
  '2020 vs 2021 ANNUAL COMPARISON',
  annualChange
);


// ============================================================
// 29. COLOURFUL ANNUAL CHART
// ============================================================

var annualChart =
  ui.Chart.feature.byFeature({

    features:
      annualChange,

    xProperty:
      'index',

    yProperties: [
      'year2020',
      'year2021'
    ]

  })
  .setChartType(
    'ColumnChart'
  )
  .setOptions({

    title:
      '🌊 Omkareshwar Narmada — 2020 vs 2021',

    hAxis: {

      title:
        'Spectral Index'
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
    }
  });


print(
  annualChart
);


// ============================================================
// 30. EXPORT MONTHLY
// ============================================================

Export.table.toDrive({

  collection:
    statistics,

  description:
    'Omkareshwar_Narmada_2020_2021_Monthly',

  folder:
    'Omkareshwar_Narmada_GEE',

  fileNamePrefix:
    'Omkareshwar_2020_2021_Monthly',

  fileFormat:
    'CSV'
});


// ============================================================
// 31. EXPORT ANNUAL
// ============================================================

Export.table.toDrive({

  collection:
    annualChange,

  description:
    'Omkareshwar_Narmada_2020_2021_Annual',

  folder:
    'Omkareshwar_Narmada_GEE',

  fileNamePrefix:
    'Omkareshwar_2020_2021_Annual',

  fileFormat:
    'CSV'
});


// ============================================================
// 32. EXPORT CORRELATIONS
// ============================================================

Export.table.toDrive({

  collection:
    corr2020,

  description:
    'Omkareshwar_Correlation_2020',

  folder:
    'Omkareshwar_Narmada_GEE',

  fileNamePrefix:
    'Omkareshwar_Correlation_2020',

  fileFormat:
    'CSV'
});


Export.table.toDrive({

  collection:
    corr2021,

  description:
    'Omkareshwar_Correlation_2021',

  folder:
    'Omkareshwar_Narmada_GEE',

  fileNamePrefix:
    'Omkareshwar_Correlation_2021',

  fileFormat:
    'CSV'
});


Export.table.toDrive({

  collection:
    correlationChange,

  description:
    'Omkareshwar_Correlation_Change_2020_2021',

  folder:
    'Omkareshwar_Narmada_GEE',

  fileNamePrefix:
    'Omkareshwar_Correlation_Change_2020_2021',

  fileFormat:
    'CSV'
});


// ============================================================
// 33. RGB MAP
// ============================================================

var first2020 =
  ee.Image(
    validMonthly
      .filter(
        ee.Filter.eq(
          'year',
          2020
        )
      )
      .first()
  );


Map.addLayer(
  first2020,
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
  '2020 RGB'
);


// ============================================================
// 34. NDVI MAP
// ============================================================

Map.addLayer(
  first2020.select(
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
  '2020 NDVI'
);


// ============================================================
// 35. MNDWI MAP
// ============================================================

Map.addLayer(
  first2020.select(
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
  '2020 MNDWI'
);


// ============================================================
// 36. NDTI MAP
// ============================================================

Map.addLayer(
  first2020.select(
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
  '2020 NDTI'
);


// ============================================================
// 37. FINAL MESSAGE
// ============================================================

print(
  '=============================================='
);

print(
  '🌊 OMKARESHWAR NARMADA 2020-2021 COMPLETE'
);

print(
  '=============================================='
);

print(
  '✓ Sentinel-2 processing'
);

print(
  '✓ Cloud masking'
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
  '✓ Monthly statistics'
);

print(
  '✓ 2020 vs 2021'
);

print(
  '✓ Correlations'
);

print(
  '✓ Scatter plots'
);

print(
  '✓ Ecological chain'
);

print(
  '✓ Colourful charts'
);

print(
  '✓ CSV exports'
);

print(
  '=============================================='
);
