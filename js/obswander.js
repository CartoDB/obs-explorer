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

var lastResult = {};

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
  'tags.years': {
    5: '#1d4f60',
    4: '#2d7974',
    3: '#4da284',
    2: '#80c799',
    1: '#c4e6c3'
  },
  'tags.telephones': {
    5: '#63589f',
    4: '#9178c4',
    3: '#b998dd',
    2: '#dbbaed',
    1: '#f3e0f7'
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
  'tags.vehicles': {
    5: '#eb4a40',
    4: '#f17854',
    3: '#f59e72',
    2: '#f9c098',
    1: '#fde0c5'
  },
  'tags.businesses': {
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
    <div class="quintile text">{{ max }}</div> \
    <div class="quintile text">{{ headtails.3 }}</div> \
    <div class="quintile text">{{ headtails.2 }}</div> \
    <div class="quintile text">{{ headtails.1 }}</div> \
    <div class="quintile text">{{ headtails.0 }}</div> \
    <div class="quintile text">{{ min }}</div> \
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
  [val >= {{ headtails.3 }}] { \
     polygon-fill: @5; \
  } \
  [val < {{ headtails.3 }}][val >= {{ headtails.2 }}] { \
     polygon-fill: @4; \
  } \
  [val < {{ headtails.2 }}][val >= {{ headtails.1 }}] { \
     polygon-fill: @3; \
  } \
  [val < {{ headtails.1 }}][val >= {{ headtails.0 }}] { \
     polygon-fill: @2; \
  } \
  [val < {{ headtails.0 }}] { \
     polygon-fill: @1; \
  } \
}';

var obsFragment = "\
-- First, create a new table, name it how you'd like, \n\
-- and replace <my table name> below with that name \n\
\n\
INSERT INTO <my table name> (the_geom, name)\n\
SELECT * \n\
FROM OBS_GetBoundariesByGeometry(\n\
  st_makeenvelope({{ bounds }}, 4326),\n\
  '{{ geom_id }}'\n\
) As m(the_geom, geoid);\n\
\n\
\n\
-- Next, add a column of type \"{{ numer_type }}\" named \"{{ numer_colname }}\"\n\
\n\
UPDATE <my table name>\n\
SET {{ numer_colname }} = OBS_GetMeasureByID(name, \n\
  '{{ numer_id }}', \n\
  '{{ geom_id }}', \n\
  '{{ numer_timespan }}') / \n\
{{# denom_id }}\
NULLIF(OBS_GetMeasureByID(name, \n\
  '{{ denom_id }}', \n\
  '{{ geom_id }}', \n\
  '{{ denom_timespan }}'), 0)\
{{/ denom_id }}\
{{^ denom_id }}\
  (ST_Area(the_geom_webmercator) / 1000000.0)\
{{/ denom_id }}\
;\
";

var measureExprs = {
  predenominated: 'data.{{ numer_colname }} val ',
  areaNormalized: 'data.{{ numer_colname }}' +
    ' / (ST_Area(geom.the_geom_webmercator) / 1000000.0) val ',
  denominated: 'numer.{{ numer_colname }}' +
  ' / NULLIF(denom.{{ denom_colname }}, 0) val '
};

var statsSql =
  'SELECT MIN(val) min, MAX(val) max, ' +
  'CDB_HeadsTailsBins(array_agg(distinct(val::numeric)), 4) as headtails ' +
  'FROM ({{{ table }}}) _table_sql';

var tables = {
  predenominated: 'SELECT ' + measureExprs.predenominated +
    ', geom.cartodb_id, geom.the_geom_webmercator ' +
    ', geom.{{ geom_geomref_colname }} geom_ref ' +
    'FROM {{ numer_tablename }} data,   ' +
    '     {{ geom_tablename }} geom   ' +
    'WHERE data.{{ numer_geomref_colname }} =  geom.{{ geom_geomref_colname }}',
  areaNormalized: 'SELECT ' + measureExprs.areaNormalized +
    ', geom.cartodb_id, geom.the_geom_webmercator ' +
    ', geom.{{ geom_geomref_colname }} geom_ref ' +
    'FROM {{ numer_tablename }} data,   ' +
    '     {{ geom_tablename }} geom   ' +
    'WHERE data.{{ numer_geomref_colname }} = geom.{{ geom_geomref_colname }}',
  denominated: 'SELECT ' + measureExprs.denominated +
    ', geom.cartodb_id, geom.the_geom_webmercator ' +
    ', geom.{{ geom_geomref_colname }} geom_ref ' +
    'FROM {{ numer_tablename }} numer,   ' +
    '     {{ denom_tablename }} denom,   ' +
    '     {{ geom_tablename }} geom   ' +
    'WHERE numer.{{ numer_geomref_colname }} = ' +
    '     denom.{{ denom_geomref_colname }} AND ' +
    '     denom.{{ denom_geomref_colname }} = ' +
    '     geom.{{ geom_geomref_colname }}'
};

var unitHuman = {
  predenominated: function(unit) { return unit.replace('tags.', ''); },
  areaNormalized: function(unit) {
    return unit.replace('tags.', '') + ' per sq km'; },
  denominated: function() { return '%'; }
};

var queries = {
  data: "\
    SELECT numer_colname, numer_geomref_colname, numer_tablename, \
           denom_colname, denom_geomref_colname, denom_tablename, \
           geom_colname, geom_geomref_colname, geom_tablename, \
           unit_tags, numer_aggregate,  \
           numer_id, denom_id, geom_id, \
           numer_timespan, denom_timespan, geom_timespan, \
           numer_type, denom_type, geom_type \
    FROM obs_meta \
    WHERE st_intersects( \
        the_geom, st_makeenvelope({{ bounds }}, 4326)) \
      AND '{{ numer_id }}' = numer_id \
      AND ('{{ denom_id }}' = denom_id OR \
           ('{{ denom_id }}' = '' AND denom_id IS NULL)) \
      AND '{{ geom_id }}' = geom_id \
      AND '{{ timespan_id }}' = numer_timespan",
  subsection: "\
    SELECT id, name, num_measures \
    FROM ( \
      SELECT UNNEST(subsection_tags) tag_id, \
             COUNT(distinct numer_id) num_measures \
      FROM obs_meta \
      WHERE st_intersects( \
        the_geom, st_makeenvelope({{ bounds }}, 4326)) \
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
    WHERE st_intersects(the_geom, st_makeenvelope({{ bounds }}, 4326)) \
    GROUP BY geom_id ORDER BY geom_id",
  timespan: "\
    SELECT numer_timespan timespan_id, numer_timespan timespan_name, \
    '{{ numer_id }}' = ANY(ARRAY_AGG(DISTINCT numer_id)) valid_numer, \
    '{{ denom_id }}' = ANY(ARRAY_AGG(DISTINCT denom_id)) OR \
                       '{{ denom_id }}' = '' valid_denom, \
    '{{ geom_id }}' = ANY(ARRAY_AGG(DISTINCT geom_id)) valid_geom, \
    true valid_timespan \
    FROM obs_meta \
    WHERE st_intersects(the_geom, st_makeenvelope({{ bounds }}, 4326)) \
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
    WHERE st_intersects(the_geom, st_makeenvelope({{ bounds }}, 4326)) \
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
    WHERE st_intersects(the_geom, st_makeenvelope({{ bounds }}, 4326)) \
    GROUP BY denom_id ORDER BY denom_id"
};

var fmt = function(val, max, unitHuman) {
  var fmtstr;
  if (max >= 1000) {
    fmtstr = '0,0';
  } else if (max >= 100) {
    fmtstr = '00.[0]';
  } else {
    fmtstr = '0.[00]';
  }
  if (unitHuman === '%') {
    fmtstr += '%';
  }
  return numeral(val).format(fmtstr);
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
  return $dfd.promise();
};

$( document ).ready(function () {
  var sublayer;

  var renderDialog = function () {
    lastResult.bounds = nativeMap.getBounds().toBBoxString();
    $('.obs-code-fragment').text(Mustache.render(obsFragment, lastResult));
  };

  var renderMap = function () {
    query('data').done(function (results) {
      var result = results[0];
      if (!result) {
        return;
      }
      lastResult = result;
      renderDialog();
      var unit = result.unit_tags[0];
      if (!ramps[unit]) {
        throw Error('No ramp for unit "' + unit + '"');
      }
      var ramp = ramps[unit];
      var mapType;
      if (result.denom_tablename) {
        mapType = 'denominated';
      } else if (result.numer_aggregate === 'sum') {
        mapType = 'areaNormalized';
      } else {
        mapType = 'predenominated';
      }
      var tableSql = Mustache.render(tables[mapType], result);
      sql.execute(statsSql, {table: tableSql}, function (stats) {
        stats = stats.rows[0];
        var min = stats.min;
        var max = stats.max;
        var headtails = stats.headtails;
        var unitstr = unitHuman[mapType](unit);
        var renderedCSS = Mustache.render(cartoCSS, {
          ramp: ramp,
          headtails: headtails
        });
        sublayer.setCartoCSS(renderedCSS);
        sublayer.setSQL(tableSql);
        var l = new cartodb.geo.ui.Legend({
          type: 'custom',
          template: '<div>' + Mustache.render(legendTemplate, {
            max: fmt(max, max, unitstr),
            min: fmt(min, max, unitstr),
            ramp: ramp,
            headtails: _.map(headtails, function(ht) {
              return fmt(ht, max, unitstr);
            }),
            unit: unitstr
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
      var $changeOne = $select.find('.box-optgroupChangeOne');
      var $changeTwo = $select.find('.box-optgroupChangeTwo');
      var $changeThree = $select.find('.box-optgroupChangeThree');
      var $unavailable = $select.find('.box-optgroupUnavailable');
      $available.empty();
      $changeOne.empty();
      $changeTwo.empty();
      $changeThree.empty();
      $unavailable.empty();
      _.each(results, function (r) {
        var selected = false;
        var invalidCount;
        var $option = $('<option />')
                       .text(r[type + '_name'] || 'None')
                       .data(r)
                       .val(r[type + '_id'] || '');
        if ((r[type + '_id'] || '') === selection[type + '_id']) {
          $option.prop('selected', true);
          selected = true;
        }
        invalidCount = (r.valid_numer ? 0 : 1) + (r.valid_denom ? 0 : 1) +
          (r.valid_geom ? 0 : 1) + (r.valid_timespan ? 0 : 1);
        if (invalidCount === 0) {
          if (selected) {
            $select.closest('.box-selectWrapper').removeClass('has-error');
          }
          $available.append($option);
        } else {
          if (selected) {
            $select.closest('.box-selectWrapper').addClass('has-error');
          }
          if (invalidCount === 1) {
            $changeOne.append($option);
          } else if (invalidCount === 2) {
            $changeTwo.append($option);
          } else if (invalidCount === 3) {
            $changeThree.append($option);
          } else {
            $unavailable.append($option);
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
    zoom: 2, center: [20, -20], search: true
  })
    .done(function (map, layers){
      sublayer = layers[1].getSubLayer(0);

      nativeMap = map.getNativeMap();

      nativeMap.doubleClickZoom.enable();
      nativeMap.scrollWheelZoom.enable();
      nativeMap.boxZoom.enable();
      nativeMap.touchZoom.enable();
      nativeMap.keyboard.enable();

      nativeMap.on('zoomend', function () {
        if (nativeMap.getZoom() > 4) {
          $('body').removeClass('coverage')
                   .addClass('explore');
        } else {
          $('body').addClass('coverage')
                   .removeClass('explore');
        }
      });

      nativeMap.on('moveend', function () {
        renderMenu();
        renderDialog();
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
