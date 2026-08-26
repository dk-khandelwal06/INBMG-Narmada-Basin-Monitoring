/***************************************************************
 OMKARESHWAR - NARMADA RIVER, MADHYA PRADESH
 2022 vs 2023 MULTI-INDEX ANALYSIS

 Sentinel-2 SR Harmonized
 Indices:
 NDVI
 BSI
 NDWI
 MNDWI
 NDTI
 TSM_PROXY
 FAI

 Outputs:
 1. Monthly composites
 2. Monthly statistics
 3. 2022 statistics
 4. 2023 statistics
 5. 2022 vs 2023 comparison
 6. Correlation matrices
 7. Lag 0/1/2 correlations
 8. Scatter plots
 9. Monthly charts
 10. CSV exports

***************************************************************/


// ============================================================
// 1. STUDY AREA
// ============================================================

// Approximate Omkareshwar area.
// Replace this with your exact uploaded ROI if available.

var ROI = ee.Geometry.Polygon([
  [
    [76.132, 22.223],
    [76.160, 22.223],
    [76.160, 22.198],
    [76.132, 22.198],
    [76.132, 22.223]
  ]
]);


// Map
Map.centerObject(ROI, 13);

Map.addLayer(
  ROI,
  {color: 'red'},
  'Omkareshwar Study Area'
);


// ============================================================
// 2. DATE RANGE
// ============================================================

var START_DATE = '2022-01-01';
var END_DATE   = '2024-01-01';


// ============================================================
// 3. SENTINEL-2 SR HARMONIZED
// ============================================================

var s2 =
  ee.ImageCollection(
    'COPERNICUS/S2_SR_HARMONIZED'
  )
  .filterBounds(ROI)
  .filterDate(
    START_DATE,
    END_DATE
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
//
// Uses SCL because it is safer for this workflow
// than relying on QA60 across different Sentinel-2 periods.
//
// SCL classes removed:
// 3  cloud shadow
// 8  medium probability cloud
// 9  high probability cloud
// 10 cirrus
// 11 snow/ice
// 1 saturated/defective
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
    .updateMask(mask)
    .divide(10000)
    .copyProperties(
      image,
      [
        'system:time_start',
        'system:index'
      ]
    );
}


// Apply mask

var cleanS2 =
  s2.map(
    maskS2
  );


print(
  'Cloud-masked images:',
  cleanS2.size()
);


// ============================================================
// 5. INDEX CALCULATION
// ============================================================

function addIndices(image) {

  // Sentinel-2 bands:
  //
  // B2  = Blue
  // B3  = Green
  // B4  = Red
  // B8  = NIR
  // B11 = SWIR1
  // B12 = SWIR2


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
    nir.subtract(red)
      .divide(
        nir.add(red)
      )
      .rename(
        'NDVI'
      );


  // ----------------------------------------------------------
  // NDWI
  // ----------------------------------------------------------

  var NDWI =
    green.subtract(nir)
      .divide(
        green.add(nir)
      )
      .rename(
        'NDWI'
      );


  // ----------------------------------------------------------
  // MNDWI
  // ----------------------------------------------------------

  var MNDWI =
    green.subtract(swir1)
      .divide(
        green.add(swir1)
      )
      .rename(
        'MNDWI'
      );


  // ----------------------------------------------------------
  // BSI
  //
  // BSI =
  // ((SWIR + RED) - (NIR + BLUE))
  // /
  // ((SWIR + RED) + (NIR + BLUE))
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
  // NDTI
  //
  // Normalized Difference Turbidity Index
  // ----------------------------------------------------------

  var NDTI =
    red.subtract(green)
      .divide(
        red.add(green)
      )
      .rename(
        'NDTI'
      );


  // ----------------------------------------------------------
  // TSM PROXY
  //
  // Empirical spectral proxy.
  // NOT field-calibrated TSM.
  //
  // Keep this explicitly as TSM_PROXY in research.
  // ----------------------------------------------------------

  var TSM_PROXY =
    red
      .divide(
        green
      )
      .rename(
        'TSM_PROXY'
      );


  // ----------------------------------------------------------
  // FAI
  //
  // Floating Algae / Floating Material proxy
  //
  // Uses:
  // NIR = B8
  // Red = B4
  // SWIR1 = B11
  //
  // ----------------------------------------------------------

  var lambdaRed = 665;
  var lambdaNIR = 842;
  var lambdaSWIR = 1610;


  var baseline =
    red.add(
      swir1
        .subtract(red)
        .multiply(
          (lambdaNIR - lambdaRed) /
          (lambdaSWIR - lambdaRed)
        )
    );


  var FAI =
    nir.subtract(
      baseline
    )
    .rename(
      'FAI'
    );


  // ----------------------------------------------------------
  // RETURN
  // ----------------------------------------------------------

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
      TSM_PROXY
    )
    .addBands(
      FAI
    );
}


// Apply indices

var indexed =
  cleanS2.map(
    addIndices
  );


print(
  'Indexed collection:',
  indexed
);


// ============================================================
// 6. MONTHLY COMPOSITES
// ============================================================

var months =
  ee.List.sequence(
    1,
    12
  );


var years =
  ee.List([
    2022,
    2023
  ]);


var monthlyImages =
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


          var monthly =
            indexed.filterDate(
              start,
              end
            );


          var count =
            monthly.size();


          // Important:
          // If month has no image, return a fully masked
          // image WITH ALL REQUIRED BANDS.
          //
          // This prevents:
          // "Image.select: Band pattern ... applied
          // to an Image with no bands"

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
                monthly.median(),
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


// Flatten

var monthlyCollection =
  ee.ImageCollection.fromImages(
    ee.List(
      monthlyImages
    ).flatten()
  );


print(
  'Monthly composites:',
  monthlyCollection
);


// ============================================================
// 7. REMOVE MONTHS WITH NO IMAGERY
// ============================================================

var validMonthly =
  monthlyCollection.filter(
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
// 8. MONTHLY STATISTICS
// ============================================================

function calculateMonthlyStats(image) {

  var stats =
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
        ee.Reducer.mean()
          .combine({
            reducer2:
              ee.Reducer.median(),

            sharedInputs:
              true
          })
          .combine({
            reducer2:
              ee.Reducer.stdDev(),

            sharedInputs:
              true
          }),

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


      NDVI_mean:
        stats.get(
          'NDVI_mean'
        ),

      NDVI_median:
        stats.get(
          'NDVI_median'
        ),

      NDVI_sd:
        stats.get(
          'NDVI_stdDev'
        ),


      BSI_mean:
        stats.get(
          'BSI_mean'
        ),

      BSI_median:
        stats.get(
          'BSI_median'
        ),

      BSI_sd:
        stats.get(
          'BSI_stdDev'
        ),


      NDWI_mean:
        stats.get(
          'NDWI_mean'
        ),

      NDWI_median:
        stats.get(
          'NDWI_median'
        ),

      NDWI_sd:
        stats.get(
          'NDWI_stdDev'
        ),


      MNDWI_mean:
        stats.get(
          'MNDWI_mean'
        ),

      MNDWI_median:
        stats.get(
          'MNDWI_median'
        ),

      MNDWI_sd:
        stats.get(
          'MNDWI_stdDev'
        ),


      NDTI_mean:
        stats.get(
          'NDTI_mean'
        ),

      NDTI_median:
        stats.get(
          'NDTI_median'
        ),

      NDTI_sd:
        stats.get(
          'NDTI_stdDev'
        ),


      TSM_PROXY_mean:
        stats.get(
          'TSM_PROXY_mean'
        ),

      TSM_PROXY_median:
        stats.get(
          'TSM_PROXY_median'
        ),

      TSM_PROXY_sd:
        stats.get(
          'TSM_PROXY_stdDev'
        ),


      FAI_mean:
        stats.get(
          'FAI_mean'
        ),

      FAI_median:
        stats.get(
          'FAI_median'
        ),

      FAI_sd:
        stats.get(
          'FAI_stdDev'
        )
    }
  );
}


// Calculate

var monthlyStats =
  ee.FeatureCollection(
    validMonthly.map(
      calculateMonthlyStats
    )
  );


print(
  'MONTHLY STATISTICS:',
  monthlyStats
);


// ============================================================
// 9. 2022 DATA
// ============================================================

var stats2022 =
  monthlyStats.filter(
    ee.Filter.eq(
      'year',
      2022
    )
  );


print(
  '=============================='
);

print(
  '2022 STATISTICS'
);

print(
  stats2022
);


// ============================================================
// 10. 2023 DATA
// ============================================================

var stats2023 =
  monthlyStats.filter(
    ee.Filter.eq(
      'year',
      2023
    )
  );


print(
  '=============================='
);

print(
  '2023 STATISTICS'
);

print(
  stats2023
);


// ============================================================
// 11. VALID DATA FOR CORRELATIONS
// ============================================================

var analysisStats =
  monthlyStats.filter(
    ee.Filter.notNull([
      'NDVI_mean',
      'BSI_mean',
      'NDWI_mean',
      'MNDWI_mean',
      'NDTI_mean',
      'TSM_PROXY_mean',
      'FAI_mean'
    ])
  );


var data2022 =
  analysisStats.filter(
    ee.Filter.eq(
      'year',
      2022
    )
  );


var data2023 =
  analysisStats.filter(
    ee.Filter.eq(
      'year',
      2023
    )
  );


print(
  'Valid 2022 records:',
  data2022.size()
);

print(
  'Valid 2023 records:',
  data2023.size()
);


// ============================================================
// 12. CORRELATION FUNCTION
// ============================================================

function correlation(
  collection,
  x,
  y
) {

  var filtered =
    collection.filter(
      ee.Filter.notNull([
        x,
        y
      ])
    );


  var result =
    filtered.reduceColumns({

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
// 13. RELATIONSHIPS
// ============================================================

var relationships = [

  [
    'NDVI',
    'NDVI_mean',
    'BSI',
    'BSI_mean'
  ],

  [
    'BSI',
    'BSI_mean',
    'NDTI',
    'NDTI_mean'
  ],

  [
    'BSI',
    'BSI_mean',
    'TSM',
    'TSM_PROXY_mean'
  ],

  [
    'NDVI',
    'NDVI_mean',
    'NDTI',
    'NDTI_mean'
  ],

  [
    'NDVI',
    'NDVI_mean',
    'TSM',
    'TSM_PROXY_mean'
  ],

  [
    'NDTI',
    'NDTI_mean',
    'TSM',
    'TSM_PROXY_mean'
  ],

  [
    'MNDWI',
    'MNDWI_mean',
    'NDTI',
    'NDTI_mean'
  ],

  [
    'MNDWI',
    'MNDWI_mean',
    'TSM',
    'TSM_PROXY_mean'
  ],

  [
    'NDWI',
    'NDWI_mean',
    'NDTI',
    'NDTI_mean'
  ],

  [
    'FAI',
    'FAI_mean',
    'NDTI',
    'NDTI_mean'
  ],

  [
    'FAI',
    'FAI_mean',
    'TSM',
    'TSM_PROXY_mean'
  ]
];


// ============================================================
// 14. CORRELATION TABLE
// ============================================================

function makeCorrelationTable(
  collection,
  year
) {

  var list =
    relationships.map(
      function(pair) {

        var r =
          correlation(
            collection,
            pair[1],
            pair[3]
          );


        return ee.Feature(
          null,
          {

            year:
              year,

            variable_1:
              pair[0],

            variable_2:
              pair[2],

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


// ============================================================
// 15. 2022 CORRELATIONS
// ============================================================

var correlation2022 =
  makeCorrelationTable(
    data2022,
    2022
  );


print(
  '=============================='
);

print(
  '2022 CORRELATION TABLE'
);

print(
  correlation2022
);


// ============================================================
// 16. 2023 CORRELATIONS
// ============================================================

var correlation2023 =
  makeCorrelationTable(
    data2023,
    2023
  );


print(
  '=============================='
);

print(
  '2023 CORRELATION TABLE'
);

print(
  correlation2023
);


// ============================================================
// 17. 2023 - 2022 CORRELATION CHANGE
// ============================================================

var list2022 =
  correlation2022.toList(
    correlation2022.size()
  );


var list2023 =
  correlation2023.toList(
    correlation2023.size()
  );


var changeList =
  ee.List.sequence(
    0,
    correlation2022.size()
      .subtract(1)
  )
  .map(
    function(i) {

      i =
        ee.Number(
          i
        );


      var f22 =
        ee.Feature(
          list2022.get(i)
        );


      var f23 =
        ee.Feature(
          list2023.get(i)
        );


      var r22 =
        ee.Number(
          f22.get(
            'correlation'
          )
        );


      var r23 =
        ee.Number(
          f23.get(
            'correlation'
          )
        );


      return ee.Feature(
        null,
        {

          variable_1:
            f22.get(
              'variable_1'
            ),

          variable_2:
            f22.get(
              'variable_2'
            ),

          correlation_2022:
            r22,

          correlation_2023:
            r23,

          correlation_change:
            r23.subtract(
              r22
            ),

          absolute_change:
            r23.subtract(
              r22
            ).abs()
        }
      );
    }
  );


var correlationChange =
  ee.FeatureCollection(
    changeList
  );


print(
  '=============================='
);

print(
  'CORRELATION CHANGE 2023 - 2022'
);

print(
  correlationChange
);


// ============================================================
// 18. LAG DATASET
// ============================================================

function makeLagDataset(
  collection,
  sourceProperty,
  targetProperty,
  lag
) {

  var sorted =
    collection
      .filter(
        ee.Filter.notNull([
          sourceProperty,
          targetProperty
        ])
      )
      .sort(
        'date'
      );


  var list =
    sorted.toList(
      sorted.size()
    );


  var n =
    sorted.size();


  var maxIndex =
    n.subtract(
      lag
    ).subtract(
      1
    );


  var indices =
    ee.List(
      ee.Algorithms.If(

        maxIndex.gte(0),

        ee.List.sequence(
          0,
          maxIndex
        ),

        ee.List([])
      )
    );


  var features =
    indices.map(
      function(i) {

        i =
          ee.Number(
            i
          );


        var source =
          ee.Feature(
            list.get(
              i
            )
          );


        var target =
          ee.Feature(
            list.get(
              i.add(
                lag
              )
            )
          );


        return ee.Feature(
          null,
          {

            source_date:
              source.get(
                'date'
              ),

            target_date:
              target.get(
                'date'
              ),

            source_value:
              source.get(
                sourceProperty
              ),

            target_value:
              target.get(
                targetProperty
              ),

            lag_months:
              lag
          }
        );
      }
    );


  return ee.FeatureCollection(
    features
  );
}


// ============================================================
// 19. LAG CORRELATION
// ============================================================

function getLagCorrelation(
  collection,
  source,
  target,
  lag
) {

  var lagData =
    makeLagDataset(
      collection,
      source,
      target,
      lag
    );


  var size =
    lagData.size();


  return ee.Algorithms.If(

    size.gte(3),

    lagData.reduceColumns({

      reducer:
        ee.Reducer.pearsonsCorrelation(),

      selectors: [
        'source_value',
        'target_value'
      ]

    }).get(
      'correlation'
    ),

    null
  );
}


// ============================================================
// 20. LAG RELATIONSHIPS
// ============================================================

var lagRelationships = [

  [
    'NDVI',
    'NDVI_mean',
    'BSI',
    'BSI_mean'
  ],

  [
    'NDVI',
    'NDVI_mean',
    'NDTI',
    'NDTI_mean'
  ],

  [
    'BSI',
    'BSI_mean',
    'NDTI',
    'NDTI_mean'
  ],

  [
    'BSI',
    'BSI_mean',
    'TSM',
    'TSM_PROXY_mean'
  ],

  [
    'NDTI',
    'NDTI_mean',
    'TSM',
    'TSM_PROXY_mean'
  ],

  [
    'MNDWI',
    'MNDWI_mean',
    'NDTI',
    'NDTI_mean'
  ],

  [
    'MNDWI',
    'MNDWI_mean',
    'TSM',
    'TSM_PROXY_mean'
  ],

  [
    'FAI',
    'FAI_mean',
    'NDTI',
    'NDTI_mean'
  ]
];


// ============================================================
// 21. MAKE LAG TABLE
// ============================================================

function makeLagTable(
  collection,
  year
) {

  var allFeatures = [];


  lagRelationships.forEach(
    function(pair) {

      [0, 1, 2].forEach(
        function(lag) {

          var r =
            getLagCorrelation(
              collection,
              pair[1],
              pair[3],
              lag
            );


          allFeatures.push(
            ee.Feature(
              null,
              {

                year:
                  year,

                source:
                  pair[0],

                target:
                  pair[2],

                lag_months:
                  lag,

                correlation:
                  r,

                absolute_correlation:
                  ee.Algorithms.If(

                    r,

                    ee.Number(
                      r
                    ).abs(),

                    null
                  )
              }
            )
          );
        }
      );
    }
  );


  return ee.FeatureCollection(
    allFeatures
  );
}


// ============================================================
// 22. LAG TABLE 2022
// ============================================================

var lag2022 =
  makeLagTable(
    data2022,
    2022
  );


print(
  '=============================='
);

print(
  '2022 LAG ANALYSIS'
);

print(
  lag2022
);


// ============================================================
// 23. LAG TABLE 2023
// ============================================================

var lag2023 =
  makeLagTable(
    data2023,
    2023
  );


print(
  '=============================='
);

print(
  '2023 LAG ANALYSIS'
);

print(
  lag2023
);


// ============================================================
// 24. STRONGEST RELATIONSHIPS
// ============================================================

print(
  'Strongest 2022 relationships:',
  correlation2022.sort(
    'absolute_correlation',
    false
  )
);


print(
  'Strongest 2023 relationships:',
  correlation2023.sort(
    'absolute_correlation',
    false
  )
);


print(
  'Strongest 2022 lag relationships:',
  lag2022.sort(
    'absolute_correlation',
    false
  )
);


print(
  'Strongest 2023 lag relationships:',
  lag2023.sort(
    'absolute_correlation',
    false
  )
);


// ============================================================
// 25. SCATTER: NDVI vs BSI
// ============================================================

var chartNDVIBSI =
  ui.Chart.feature.byFeature({

    features:
      analysisStats,

    xProperty:
      'NDVI_mean',

    yProperties: [
      'BSI_mean'
    ]

  })
  .setChartType(
    'ScatterChart'
  )
  .setOptions({

    title:
      'NDVI vs BSI - Omkareshwar',

    hAxis: {
      title:
        'NDVI'
    },

    vAxis: {
      title:
        'BSI'
    },

    pointSize:
      7,

    trendlines: {

      0: {
        showR2:
          true
      }
    }
  });


print(
  chartNDVIBSI
);


// ============================================================
// 26. SCATTER: BSI vs NDTI
// ============================================================

var chartBSINDTI =
  ui.Chart.feature.byFeature({

    features:
      analysisStats,

    xProperty:
      'BSI_mean',

    yProperties: [
      'NDTI_mean'
    ]

  })
  .setChartType(
    'ScatterChart'
  )
  .setOptions({

    title:
      'BSI vs NDTI',

    hAxis: {
      title:
        'BSI'
    },

    vAxis: {
      title:
        'NDTI'
    },

    pointSize:
      7,

    trendlines: {

      0: {
        showR2:
          true
      }
    }
  });


print(
  chartBSINDTI
);


// ============================================================
// 27. SCATTER: NDTI vs TSM
// ============================================================

var chartNDTITSM =
  ui.Chart.feature.byFeature({

    features:
      analysisStats,

    xProperty:
      'NDTI_mean',

    yProperties: [
      'TSM_PROXY_mean'
    ]

  })
  .setChartType(
    'ScatterChart'
  )
  .setOptions({

    title:
      'NDTI vs TSM Proxy',

    hAxis: {
      title:
        'NDTI'
    },

    vAxis: {
      title:
        'TSM Proxy'
    },

    pointSize:
      7,

    trendlines: {

      0: {
        showR2:
          true
      }
    }
  });


print(
  chartNDTITSM
);


// ============================================================
// 28. SCATTER: NDVI vs NDTI
// ============================================================

var chartNDVINDTI =
  ui.Chart.feature.byFeature({

    features:
      analysisStats,

    xProperty:
      'NDVI_mean',

    yProperties: [
      'NDTI_mean'
    ]

  })
  .setChartType(
    'ScatterChart'
  )
  .setOptions({

    title:
      'NDVI vs NDTI',

    hAxis: {
      title:
        'NDVI'
    },

    vAxis: {
      title:
        'NDTI'
    },

    pointSize:
      7,

    trendlines: {

      0: {
        showR2:
          true
      }
    }
  });


print(
  chartNDVINDTI
);


// ============================================================
// 29. SCATTER: MNDWI vs NDTI
// ============================================================

var chartMNDWINDTI =
  ui.Chart.feature.byFeature({

    features:
      analysisStats,

    xProperty:
      'MNDWI_mean',

    yProperties: [
      'NDTI_mean'
    ]

  })
  .setChartType(
    'ScatterChart'
  )
  .setOptions({

    title:
      'MNDWI vs NDTI',

    hAxis: {
      title:
        'MNDWI'
    },

    vAxis: {
      title:
        'NDTI'
    },

    pointSize:
      7,

    trendlines: {

      0: {
        showR2:
          true
      }
    }
  });


print(
  chartMNDWINDTI
);


// ============================================================
// 30. MONTHLY ECOLOGICAL CHAIN
// ============================================================

var chainChart =
  ui.Chart.feature.byFeature({

    features:
      analysisStats.sort(
        'date'
      ),

    xProperty:
      'date',

    yProperties: [

      'NDVI_mean',

      'BSI_mean',

      'NDTI_mean',

      'TSM_PROXY_mean'

    ]

  })
  .setChartType(
    'LineChart'
  )
  .setOptions({

    title:
      'Ecological Chain: NDVI → BSI → NDTI → TSM',

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
      2,

    pointSize:
      4,

    legend: {

      position:
        'bottom'
    }
  });


print(
  chainChart
);


// ============================================================
// 31. MONTHLY NDTI 2022 vs 2023
// ============================================================

var ndtiYearChart =
  ui.Chart.feature.groups({

    features:
      analysisStats,

    xProperty:
      'month',

    yProperty:
      'NDTI_mean',

    seriesProperty:
      'year'

  })
  .setChartType(
    'LineChart'
  )
  .setOptions({

    title:
      'NDTI - 2022 vs 2023',

    hAxis: {

      title:
        'Month'
    },

    vAxis: {

      title:
        'NDTI'
    },

    lineWidth:
      3,

    pointSize:
      5
  });


print(
  ndtiYearChart
);


// ============================================================
// 32. MONTHLY NDVI 2022 vs 2023
// ============================================================

var ndviYearChart =
  ui.Chart.feature.groups({

    features:
      analysisStats,

    xProperty:
      'month',

    yProperty:
      'NDVI_mean',

    seriesProperty:
      'year'

  })
  .setChartType(
    'LineChart'
  )
  .setOptions({

    title:
      'NDVI - 2022 vs 2023',

    hAxis: {

      title:
        'Month'
    },

    vAxis: {

      title:
        'NDVI'
    },

    lineWidth:
      3,

    pointSize:
      5
  });


print(
  ndviYearChart
);


// ============================================================
// 33. MONTHLY BSI 2022 vs 2023
// ============================================================

var bsiYearChart =
  ui.Chart.feature.groups({

    features:
      analysisStats,

    xProperty:
      'month',

    yProperty:
      'BSI_mean',

    seriesProperty:
      'year'

  })
  .setChartType(
    'LineChart'
  )
  .setOptions({

    title:
      'BSI - 2022 vs 2023',

    hAxis: {

      title:
        'Month'
    },

    vAxis: {

      title:
        'BSI'
    },

    lineWidth:
      3,

    pointSize:
      5
  });


print(
  bsiYearChart
);


// ============================================================
// 34. MONTHLY MNDWI 2022 vs 2023
// ============================================================

var mndwiYearChart =
  ui.Chart.feature.groups({

    features:
      analysisStats,

    xProperty:
      'month',

    yProperty:
      'MNDWI_mean',

    seriesProperty:
      'year'

  })
  .setChartType(
    'LineChart'
  )
  .setOptions({

    title:
      'MNDWI - 2022 vs 2023',

    hAxis: {

      title:
        'Month'
    },

    vAxis: {

      title:
        'MNDWI'
    },

    lineWidth:
      3,

    pointSize:
      5
  });


print(
  mndwiYearChart
);


// ============================================================
// 35. MONTHLY TSM 2022 vs 2023
// ============================================================

var tsmYearChart =
  ui.Chart.feature.groups({

    features:
      analysisStats,

    xProperty:
      'month',

    yProperty:
      'TSM_PROXY_mean',

    seriesProperty:
      'year'

  })
  .setChartType(
    'LineChart'
  )
  .setOptions({

    title:
      'TSM Proxy - 2022 vs 2023',

    hAxis: {

      title:
        'Month'
    },

    vAxis: {

      title:
        'TSM Proxy'
    },

    lineWidth:
      3,

    pointSize:
      5
  });


print(
  tsmYearChart
);


// ============================================================
// 36. ANNUAL MEAN FUNCTION
// ============================================================

function annualMean(
  collection,
  property
) {

  return collection.aggregate_mean(
    property
  );
}


// ============================================================
// 37. ANNUAL COMPARISON TABLE
// ============================================================

var annualComparison =
  ee.FeatureCollection([

    ee.Feature(
      null,
      {
        variable:
          'NDVI',

        value_2022:
          annualMean(
            data2022,
            'NDVI_mean'
          ),

        value_2023:
          annualMean(
            data2023,
            'NDVI_mean'
          )
      }
    ),

    ee.Feature(
      null,
      {
        variable:
          'BSI',

        value_2022:
          annualMean(
            data2022,
            'BSI_mean'
          ),

        value_2023:
          annualMean(
            data2023,
            'BSI_mean'
          )
      }
    ),

    ee.Feature(
      null,
      {
        variable:
          'NDWI',

        value_2022:
          annualMean(
            data2022,
            'NDWI_mean'
          ),

        value_2023:
          annualMean(
            data2023,
            'NDWI_mean'
          )
      }
    ),

    ee.Feature(
      null,
      {
        variable:
          'MNDWI',

        value_2022:
          annualMean(
            data2022,
            'MNDWI_mean'
          ),

        value_2023:
          annualMean(
            data2023,
            'MNDWI_mean'
          )
      }
    ),

    ee.Feature(
      null,
      {
        variable:
          'NDTI',

        value_2022:
          annualMean(
            data2022,
            'NDTI_mean'
          ),

        value_2023:
          annualMean(
            data2023,
            'NDTI_mean'
          )
      }
    ),

    ee.Feature(
      null,
      {
        variable:
          'TSM_PROXY',

        value_2022:
          annualMean(
            data2022,
            'TSM_PROXY_mean'
          ),

        value_2023:
          annualMean(
            data2023,
            'TSM_PROXY_mean'
          )
      }
    ),

    ee.Feature(
      null,
      {
        variable:
          'FAI',

        value_2022:
          annualMean(
            data2022,
            'FAI_mean'
          ),

        value_2023:
          annualMean(
            data2023,
            'FAI_mean'
          )
      }
    )
  ]);


// ============================================================
// 38. CALCULATE CHANGE
// ============================================================

var annualFinal =
  annualComparison.map(
    function(feature) {

      var v2022 =
        ee.Number(
          feature.get(
            'value_2022'
          )
        );


      var v2023 =
        ee.Number(
          feature.get(
            'value_2023'
          )
        );


      var change =
        v2023.subtract(
          v2022
        );


      var percent =
        ee.Algorithms.If(

          v2022.abs().gt(
            0.000001
          ),

          change
            .divide(
              v2022.abs()
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
          percent
        );
    }
  );


print(
  '=============================='
);

print(
  '2022 vs 2023 ANNUAL COMPARISON'
);

print(
  annualFinal
);


// ============================================================
// 39. YEAR COMPARISON CHART
// ============================================================

var annualChart =
  ui.Chart.feature.byFeature({

    features:
      annualFinal,

    xProperty:
      'variable',

    yProperties: [

      'value_2022',

      'value_2023'

    ]

  })
  .setChartType(
    'ColumnChart'
  )
  .setOptions({

    title:
      'Omkareshwar Narmada: 2022 vs 2023',

    hAxis: {

      title:
        'Index'
    },

    vAxis: {

      title:
        'Mean Value'
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
// 40. EXPORT MONTHLY DATA
// ============================================================

Export.table.toDrive({

  collection:
    monthlyStats,

  description:
    'Omkareshwar_Narmada_Monthly_2022_2023',

  folder:
    'GEE_Omkareshwar_Narmada',

  fileNamePrefix:
    'Omkareshwar_Monthly_2022_2023',

  fileFormat:
    'CSV'
});


// ============================================================
// 41. EXPORT 2022
// ============================================================

Export.table.toDrive({

  collection:
    data2022,

  description:
    'Omkareshwar_Narmada_2022_Statistics',

  folder:
    'GEE_Omkareshwar_Narmada',

  fileNamePrefix:
    'Omkareshwar_2022_Statistics',

  fileFormat:
    'CSV'
});


// ============================================================
// 42. EXPORT 2023
// ============================================================

Export.table.toDrive({

  collection:
    data2023,

  description:
    'Omkareshwar_Narmada_2023_Statistics',

  folder:
    'GEE_Omkareshwar_Narmada',

  fileNamePrefix:
    'Omkareshwar_2023_Statistics',

  fileFormat:
    'CSV'
});


// ============================================================
// 43. EXPORT CORRELATION 2022
// ============================================================

Export.table.toDrive({

  collection:
    correlation2022,

  description:
    'Omkareshwar_Correlation_2022',

  folder:
    'GEE_Omkareshwar_Narmada',

  fileNamePrefix:
    'Omkareshwar_Correlation_2022',

  fileFormat:
    'CSV'
});


// ============================================================
// 44. EXPORT CORRELATION 2023
// ============================================================

Export.table.toDrive({

  collection:
    correlation2023,

  description:
    'Omkareshwar_Correlation_2023',

  folder:
    'GEE_Omkareshwar_Narmada',

  fileNamePrefix:
    'Omkareshwar_Correlation_2023',

  fileFormat:
    'CSV'
});


// ============================================================
// 45. EXPORT CORRELATION CHANGE
// ============================================================

Export.table.toDrive({

  collection:
    correlationChange,

  description:
    'Omkareshwar_Correlation_Change_2023_2022',

  folder:
    'GEE_Omkareshwar_Narmada',

  fileNamePrefix:
    'Omkareshwar_Correlation_Change_2023_2022',

  fileFormat:
    'CSV'
});


// ============================================================
// 46. EXPORT LAG 2022
// ============================================================

Export.table.toDrive({

  collection:
    lag2022,

  description:
    'Omkareshwar_Lag_Correlation_2022',

  folder:
    'GEE_Omkareshwar_Narmada',

  fileNamePrefix:
    'Omkareshwar_Lag_Correlation_2022',

  fileFormat:
    'CSV'
});


// ============================================================
// 47. EXPORT LAG 2023
// ============================================================

Export.table.toDrive({

  collection:
    lag2023,

  description:
    'Omkareshwar_Lag_Correlation_2023',

  folder:
    'GEE_Omkareshwar_Narmada',

  fileNamePrefix:
    'Omkareshwar_Lag_Correlation_2023',

  fileFormat:
    'CSV'
});


// ============================================================
// 48. EXPORT ANNUAL COMPARISON
// ============================================================

Export.table.toDrive({

  collection:
    annualFinal,

  description:
    'Omkareshwar_Annual_Comparison_2022_2023',

  folder:
    'GEE_Omkareshwar_Narmada',

  fileNamePrefix:
    'Omkareshwar_Annual_Comparison_2022_2023',

  fileFormat:
    'CSV'
});


// ============================================================
// 49. MAP EXAMPLE
// ============================================================

var first2022 =
  ee.Image(
    validMonthly
      .filter(
        ee.Filter.eq(
          'year',
          2022
        )
      )
      .first()
  );


Map.addLayer(
  first2022,
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
  '2022 RGB'
);


Map.addLayer(
  first2022.select(
    'NDVI'
  ),
  {
    min:
      -0.2,

    max:
      0.8,

    palette: [
      'red',
      'yellow',
      'green'
    ]
  },
  '2022 NDVI'
);


Map.addLayer(
  first2022.select(
    'MNDWI'
  ),
  {
    min:
      -0.5,

    max:
      0.7,

    palette: [
      'brown',
      'white',
      'blue'
    ]
  },
  '2022 MNDWI'
);


// ============================================================
// 50. FINAL
// ============================================================

print(
  '===================================================='
);

print(
  'OMKARESHWAR 2022-2023 ANALYSIS COMPLETE'
);

print(
  '===================================================='
);

print(
  'Monthly composites: READY'
);

print(
  'Monthly statistics: READY'
);

print(
  '2022 statistics: READY'
);

print(
  '2023 statistics: READY'
);

print(
  'Correlation analysis: READY'
);

print(
  'Lag 0/1/2 analysis: READY'
);

print(
  'Scatter plots: READY'
);

print(
  '2022 vs 2023 comparison: READY'
);

print(
  'CSV exports: READY'
);

print(
  '===================================================='
);
