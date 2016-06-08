/*jshint multistr: true, browser: true, maxstatements: 100, camelcase: false*/
/*globals $, cartodb, _, Mustache, numeral*/

var maxHeightList = function (){
  var heightScreen = $(window).height();
  var heightNavigation = 86;
  var heightHeader = $('.box-header').height();
  var maxHeightScroll = (heightScreen) - (40 + heightNavigation +
                                          heightHeader) - 64;
  $('.box-resultList').css('max-height', maxHeightScroll);
};

var sql = new cartodb.SQL({
  user: 'observatory',
  https: true
});

var nativeMap;

var openSubsection = 'tags.housing';

var measureSql;

var ramps = {
  'tags.people': {
    5: '#6c2167',
    4: '#a24186',
    3: '#ca699d',
    2: '#e498b4',
    1: '#f3cbd3'
  },
  'tags.money': {
    5: '#1d4f60',
    4: '#2d7974',
    3: '#4da284',
    2: '#80c799',
    1: '#c4e6c3'
  },
  'tags.households': {
    5: '#63589f',
    4: '#9178c4',
    3: '#b998dd',
    2: '#dbbaed',
    1: '#f3e0f7'
  },
  'tags.housing_units': {
    5: '#2a5674',
    4: '#45829b',
    3: '#68abb8',
    2: '#96d0d1',
    1: '#d1eeea'
  },
  'tags.ratio': {
    5: '#eb4a40',
    4: '#f17854',
    3: '#f59e72',
    2: '#f9c098',
    1: '#fde0c5'
  },
  'tags.index': {
    5: '#eb4a40',
    4: '#f17854',
    3: '#f59e72',
    2: '#f9c098',
    1: '#fde0c5'
  },
  'categorical': {
    1: '#7F3C8D',
    2: '#11A579',
    3: '#3969AC',
    4: '#F2B701',
    5: '#E73F74',
    6: '#80BA5A',
    7: '#E68310',
    8: '#008695',
    9: '#CF1C90',
    10: '#f97b72',
    other: '#A5AA99'
  }
};

var legendTemplate = '\
<div class="cartodb-legend"> \
  <div class="legend-title">{{ unit }}</div> \
  <div class="colors"> \
    <div class="quintile">{{ range.5 }}</div> \
    <div class="quintile">{{ range.4 }}</div> \
    <div class="quintile">{{ range.3 }}</div> \
    <div class="quintile">{{ range.2 }}</div> \
    <div class="quintile">{{ range.1 }}</div> \
  </div> \
  <div class="colors"> \
    <div class="quintile" style="background-color:{{ ramp.5 }};"></div> \
    <div class="quintile" style="background-color:{{ ramp.4 }};"></div> \
    <div class="quintile" style="background-color:{{ ramp.3 }};"></div> \
    <div class="quintile" style="background-color:{{ ramp.2 }};"></div> \
    <div class="quintile" style="background-color:{{ ramp.1 }};"></div> \
  </div> \
</div>';

/** choropleth visualization */

var cartoCSS = ' \
@5:{{ ramp.5 }};\
@4:{{ ramp.4 }};\
@3:{{ ramp.3 }};\
@2:{{ ramp.2 }};\
@1:{{ ramp.1 }};\
\
#data { \
  polygon-opacity: 0.9; \
  polygon-gamma: 0.5; \
  line-color: #000000; \
  line-width: 0.25; \
  line-opacity: 0.2; \
  line-comp-op: hard-light; \
 \
  [val=null]{ \
     polygon-fill: #cacdce; \
  } \
  [val <= 1] { \
     polygon-fill: @5; \
  } \
  [val <= 0.333] { \
     polygon-fill: @4; \
  } \
  [val <= 0.111] { \
     polygon-fill: @3; \
  } \
  [val <= 0.037] { \
     polygon-fill: @2; \
  } \
  [val <= 0.012] { \
     polygon-fill: @1; \
  } \
}';

var statsSQLPredenominated =
  'SELECT MAX({{ numer_colname }}),   ' +
  '       MIN({{ numer_colname }}),   ' +
  '       AVG({{ numer_colname }}),   ' +
  '       STDDEV_POP({{ numer_colname }})   ' +
  'FROM {{ numer_tablename }} data';

var statsSQLAreaNormalized =
  'SELECT MAX({{ numer_colname }} / ' +
  '           (ST_Area(geom.the_geom_webmercator) / 1000000.0)),   ' +
  '       MIN({{ numer_colname }} / ' +
  '           (ST_Area(geom.the_geom_webmercator) / 1000000.0)),   ' +
  '       AVG({{ numer_colname }} / ' +
  '           (ST_Area(geom.the_geom_webmercator) / 1000000.0)),   ' +
  '       STDDEV_POP({{ numer_colname }} / ' +
  '           (ST_Area(geom.the_geom_webmercator) / 1000000.0))   ' +
  'FROM {{ numer_tablename }} data,  ' +
  '     {{ geom_tablename }} geom    ' +
  'WHERE data.{{ numer_geomref_colname }} =  ' +
  '      geom.{{ geom_geomref_colname }} ';

var statsSQLDenominated =
  'SELECT MAX(numer.{{ numer_colname }} / ' +
  '           NULLIF(denom.{{ denom_colname }}, 0)),   ' +
  '       MIN(numer.{{ numer_colname }} / ' +
  '           NULLIF(denom.{{ denom_colname }}, 0)),   ' +
  '       AVG(numer.{{ numer_colname }} / ' +
  '           NULLIF(denom.{{ denom_colname }}, 0)),   ' +
  '       STDDEV_POP(numer.{{ numer_colname }} / ' +
  '           NULLIF(denom.{{ denom_colname }}, 0))   ' +
  'FROM {{ numer_tablename }} numer,  ' +
  '     {{ denom_tablename }} denom    ' +
  'WHERE numer.{{ numer_geomref_colname }} =  ' +
  '      denom.{{ denom_geomref_colname }} ';

var mapSQLPredenominated =
  'WITH stats AS(' + statsSQLPredenominated + ')   ' +
  'SELECT data.cartodb_id, geom.the_geom_webmercator,   ' +
  '       (data.{{ numer_colname }} - stats.min) /   ' +
  '       (stats.max - stats.min) AS val   ' +
  'FROM stats, {{ numer_tablename }} data,   ' +
  '     {{geom_tablename }} geom   ' +
  'WHERE data.{{ numer_geomref_colname }} = ' +
  'geom.{{ geom_geomref_colname }}';

var mapSQLAreaNormalized =
  'WITH stats AS(' + statsSQLAreaNormalized + ')   ' +
  'SELECT data.cartodb_id, geom.the_geom_webmercator,   ' +
  '       ((data.{{ numer_colname }} /  ' +
  '      (ST_Area(geom.the_geom_webmercator) / 1000000.0)) - stats.min) /   ' +
  '       (stats.max - stats.min) AS val   ' +
  'FROM stats, {{ numer_tablename }} data,   ' +
  '     {{geom_tablename }} geom   ' +
  'WHERE data.{{ numer_geomref_colname }} = ' +
  'geom.{{ geom_geomref_colname }}';

var mapSQLDenominated =
  'WITH stats AS(' + statsSQLDenominated + ')   ' +
  'SELECT numer.cartodb_id, geom.the_geom_webmercator,   ' +
  '       ((numer.{{ numer_colname }} /  ' +
  '        NULLIF(denom.{{ denom_colname }}, 0)) - stats.min) /   ' +
  '       (stats.max - stats.min) AS val   ' +
  'FROM stats, {{ numer_tablename }} numer,   ' +
  '     {{ denom_tablename }} denom,   ' +
  '     {{ geom_tablename }} geom   ' +
  'WHERE numer.{{ numer_geomref_colname }} = ' +
        'denom.{{ denom_geomref_colname }} AND ' +
        'denom.{{ denom_geomref_colname }} = ' +
        'geom.{{ geom_geomref_colname }}';

var queries = {
  data: "\
    SELECT numer_colname, numer_geomref_colname, numer_tablename, \
           denom_colname, denom_geomref_colname, denom_tablename, \
           geom_colname, geom_geomref_colname, geom_tablename, \
           unit_tags, numer_aggregate  \
    FROM obs_meta \
    WHERE st_intersects( \
        geom_bounds, st_makeenvelope({{ bounds }})) \
      AND '{{ numer_id }}' = numer_id \
      AND ('{{ denom_id }}' = denom_id OR '{{ denom_id }}' = '') \
      AND '{{ geom_id }}' = geom_id \
      AND '{{ timespan_id }}' = numer_timespan",
  subsection: "\
    SELECT id, name, num_measures \
    FROM ( \
      SELECT UNNEST(subsection_tags) tag_id, \
             COUNT(distinct numer_id) num_measures \
      FROM obs_meta \
      WHERE st_intersects( \
        geom_bounds, st_makeenvelope({{ bounds }})) \
      GROUP BY tag_id ) unnested JOIN obs_tag \
    ON unnested.tag_id = id",
  geom: "\
    SELECT geom_id, MAX(geom_name) geom_name, \
                    MAX(geom_description) geom_description, \
    '{{ numer_id }}' = ANY(ARRAY_AGG(DISTINCT numer_id)) valid_numer, \
    '{{ denom_id }}' = ANY(ARRAY_AGG(DISTINCT denom_id)) OR \
                       '{{ denom_id }}' = '' valid_denom, \
    '{{ timespan_id }}' = \
         ANY(ARRAY_AGG(DISTINCT numer_timespan)) valid_timespan, \
    true valid_geom \
    FROM obs_meta \
    WHERE st_intersects(geom_bounds, st_makeenvelope({{ bounds }})) \
    GROUP BY geom_id ORDER BY geom_id",
  timespan: "\
    SELECT numer_timespan timespan_id, numer_timespan timespan_name, \
    '{{ numer_id }}' = ANY(ARRAY_AGG(DISTINCT numer_id)) valid_numer, \
    '{{ denom_id }}' = ANY(ARRAY_AGG(DISTINCT denom_id)) OR \
                       '{{ denom_id }}' = '' valid_denom, \
    '{{ geom_id }}' = ANY(ARRAY_AGG(DISTINCT geom_id)) valid_geom, \
    true valid_timespan \
    FROM obs_meta \
    WHERE st_intersects(geom_bounds, st_makeenvelope({{ bounds }})) \
    GROUP BY numer_timespan ORDER BY numer_timespan DESC",
  numer: "\
    SELECT numer_id, MAX(numer_name) numer_name, \
                     MAX(numer_description) numer_description, \
    '{{ geom_id }}' = ANY(ARRAY_AGG(DISTINCT geom_id)) valid_geom, \
    '{{ denom_id }}' = ANY(ARRAY_AGG(DISTINCT denom_id)) OR \
                       '{{ denom_id }}' = '' valid_denom, \
    '{{ timespan_id }}' = \
            ANY(ARRAY_AGG(DISTINCT numer_timespan)) valid_timespan, \
    true valid_numer \
    FROM obs_meta \
    WHERE st_intersects(geom_bounds, st_makeenvelope({{ bounds }})) \
    GROUP BY numer_id ORDER BY numer_id",
  denom: "\
    SELECT denom_id, MAX(denom_name) denom_name, \
                     MAX(denom_description) denom_description, \
    '{{ numer_id }}' = ANY(ARRAY_AGG(DISTINCT numer_id)) valid_numer, \
    '{{ geom_id }}' = ANY(ARRAY_AGG(DISTINCT geom_id)) valid_geom, \
    '{{ timespan_id }}' = \
               ANY(ARRAY_AGG(DISTINCT numer_timespan)) valid_timespan, \
    true valid_denom \
    FROM obs_meta \
    WHERE st_intersects(geom_bounds, st_makeenvelope({{ bounds }})) \
    GROUP BY denom_id ORDER BY denom_id"
};

var calcRange = function (max, min, avg, stddev, unitHuman) {

  var fmt;
  if (max >= 1000) {
    fmt = '0';
  } else if (max >= 100) {
    fmt = '0.[0]';
  } else {
    fmt = '0.[00]';
  }
  if (unitHuman === '%') {
    fmt += '%';
  }

  return {
    max: max,
    5:  numeral(1 * (max  - min) + min).format(fmt),
    4:  numeral(0.333 * (max  - min) + min).format(fmt),
    3:  numeral(0.111 * (max  - min) + min).format(fmt),
    2:  numeral(0.037 * (max  - min) + min).format(fmt),
    1:  numeral(0.012 * (max  - min) + min).format(fmt),
    min: numeral(min).format(fmt)
  };
};

var getSelection = function () {
  return {
    bounds: nativeMap.getBounds().toBBoxString(),
    numer_id: $('.box-numerSelect').val(),
    denom_id: $('.box-denomSelect').val(),
    geom_id: $('.box-geomSelect').val(),
    timespan_id: $('.box-timespanSelect').val()
  };
};

var query = function (type) {
  if (!queries[type]) {
    throw 'No query for type "' + type + '"';
  }
  var $dfd = $.Deferred();
  sql.execute(queries[type], getSelection())
    .done(function (rawdata) {
      $dfd.resolve(rawdata.rows);
    });
    //.fail(function (err) {
    //  $dfd.reject(err);
    //});
  return $dfd.promise();
};

$( document ).ready(function () {
  var sublayer;
  var mapCenter = [37.804444, -122.270833];

  var renderMap = function () {
    query('data').done(function (results) {
      var result = results[0];
      var statsSql;
      if (!result) {
        return;
      }
      var unit = result.unit_tags[0];
      var ramp = ramps[unit];
      var unitHuman;
      if (result.denom_tablename) {
        measureSql = Mustache.render(mapSQLDenominated, result);
        statsSql = statsSQLDenominated;
        unitHuman = '%';
      } else if (result.numer_aggregate === 'sum') {
        measureSql = Mustache.render(mapSQLAreaNormalized, result);
        statsSql = statsSQLAreaNormalized;
        unitHuman = unit.replace('tags.', '') + ' per sq km';
      } else {
        measureSql = Mustache.render(mapSQLPredenominated, result);
        statsSql = statsSQLPredenominated;
        unitHuman = unit.replace('tags.', '');
      }
      sublayer.setSQL(measureSql);
      sublayer.setCartoCSS(Mustache.render(cartoCSS, {ramp: ramp}));
      sql.execute(statsSql, result).done(function (rawdata) {
        var stats = rawdata.rows[0];
        var range = calcRange(stats.max, stats.min, stats.avg,
                              stats.stddev_pop, unitHuman);
        var l = new cartodb.geo.ui.Legend({
          type: 'custom',
          template: '<div>' + Mustache.render(legendTemplate, {
            stats: stats,
            ramp: ramp,
            range: range,
            unit: unitHuman
          }) + '</div>'
        });
        l.render();
        $('.cartodb-legend.wrapper').replaceWith(l.$el);
      });
    });
  };

  var renderSelect = function (type) {
    var selection = getSelection();
    query(type).done(function (results) {
      var $select = $('.box-' + type + 'Select');
      var $available = $select.find('.box-optgroupAvailable');
      var $unavailable = $select.find('.box-optgroupUnavailable');
      $available.empty();
      $unavailable.empty();
      _.each(results, function (r) {
        var selected = false;
        var $option = $('<option />')
                       .text(r[type + '_name'] || 'None')
                       .data(r)
                       .val(r[type + '_id'] || '');
        if ((r[type + '_id'] || '') === selection[type + '_id']) {
          $option.prop('selected', true);
          selected = true;
        }
        if (r.valid_numer && r.valid_denom && r.valid_geom &&
            r.valid_timespan) {
          $available.append($option);
          if (selected) {
            $select.closest('.box-selectWrapper').removeClass('has-error');
          }
        } else {
          $unavailable.append($option);
          if (selected) {
            $select.closest('.box-selectWrapper').addClass('has-error');
          }
        }
      });
      $select.select2();
    });
  };

  var renderMenu = function () {
    renderSelect('geom');
    renderSelect('numer');
    renderSelect('denom');
    renderSelect('timespan');
  };

  cartodb.createVis('map', 'viz.json', {
    zoom: 11, center: mapCenter, search: true
  })
    .done(function (map, layers){
      sublayer = layers[1].getSubLayer(0);

      nativeMap = map.getNativeMap();

      nativeMap.doubleClickZoom.enable();
      nativeMap.scrollWheelZoom.enable();
      nativeMap.boxZoom.enable();
      nativeMap.touchZoom.enable();
      nativeMap.keyboard.enable();

      nativeMap.on('moveend', function () {
        renderMenu();
      });

      $('.box-select').on('change', function () {
        renderMenu();
        renderMap();
      });

      $( ".box-input" ).on( "click", function () {
        $(this).toggleClass( "is-open" );
        maxHeightList();
        $(".box-container").toggleClass( "is-hidden" );
      });
      renderMenu();
      renderMap();
    });
});
