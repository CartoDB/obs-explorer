/*jshint multistr: true, browser: true, maxstatements: 100, camelcase: false*/
/*globals $, cartodb, _, Mustache, numeral, JSON, escape*/

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
  'unknown': {
    5: '#6c2167', 4: '#a24186', 3: '#ca699d', 2: '#e498b4', 1: '#f3cbd3'
  },
  'unknown-categorical': {
    1: '#7F3C8D', 2: '#11A579', 3: '#3969AC', 4: '#F2B701', 5: '#E73F74',
    6: '#80BA5A', 7: '#E68310', 8: '#008695', 9: '#CF1C90', 10: '#f97b72',
    other: '#A5AA99'
  },
  'tags.people': {
    5: '#6c2167', 4: '#a24186', 3: '#ca699d', 2: '#e498b4', 1: '#f3cbd3'
  },
  'tags.money': {
    5: '#1d4f60', 4: '#2d7974', 3: '#4da284', 2: '#80c799', 1: '#c4e6c3'
  },
  'tags.years': {
    5: '#1d4f60', 4: '#2d7974', 3: '#4da284', 2: '#80c799', 1: '#c4e6c3'
  },
  'tags.telephones': {
    5: '#63589f', 4: '#9178c4', 3: '#b998dd', 2: '#dbbaed', 1: '#f3e0f7'
  },
  'tags.households': {
    5: '#63589f', 4: '#9178c4', 3: '#b998dd', 2: '#dbbaed', 1: '#f3e0f7'
  },
  'tags.housing_units': {
    5: '#2a5674', 4: '#45829b', 3: '#68abb8', 2: '#96d0d1', 1: '#d1eeea'
  },
  'tags.ratio': {
    5: '#eb4a40', 4: '#f17854', 3: '#f59e72', 2: '#f9c098', 1: '#fde0c5'
  },
  'tags.index': {
    5: '#eb4a40', 4: '#f17854', 3: '#f59e72', 2: '#f9c098', 1: '#fde0c5'
  },
  'tags.vehicles': {
    5: '#eb4a40', 4: '#f17854', 3: '#f59e72', 2: '#f9c098', 1: '#fde0c5'
  },
  'tags.businesses': {
    5: '#eb4a40', 4: '#f17854', 3: '#f59e72', 2: '#f9c098', 1: '#fde0c5'
  },
  'tags.segmentation': {
    1: '#7F3C8D', 2: '#11A579', 3: '#3969AC', 4: '#F2B701', 5: '#E73F74',
    6: '#80BA5A', 7: '#E68310', 8: '#008695', 9: '#CF1C90', 10: '#f97b72',
    other: '#A5AA99'
  }
};

var choroplethLegendTemplate = '\
<div class="cartodb-legend legend-choropleth"> \
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

var categoricalLegendTemplate = '\
<div class="cartodb-legend legend-category"> \
  <div class="legend-title">{{ unit }}</div> \
  <div class="colors"> \
    <div class="quintile text">{{ buckets.1 }}</div> \
    <div class="quintile text">{{ buckets.2 }}</div> \
    <div class="quintile text">{{ buckets.3 }}</div> \
    <div class="quintile text">{{ buckets.4 }}</div> \
    <div class="quintile text">{{ buckets.5 }}</div> \
    <div class="quintile text">{{ buckets.6 }}</div> \
    <div class="quintile text">{{ buckets.7 }}</div> \
    <div class="quintile text">{{ buckets.8 }}</div> \
    <div class="quintile text">{{ buckets.9 }}</div> \
    <div class="quintile text">{{ buckets.0 }}</div> \
  </div> \
  <div class="colors"> \
    <div class="quintile" style="background-color:{{ ramp.1 }};"></div> \
    <div class="quintile" style="background-color:{{ ramp.2 }};"></div> \
    <div class="quintile" style="background-color:{{ ramp.3 }};"></div> \
    <div class="quintile" style="background-color:{{ ramp.4 }};"></div> \
    <div class="quintile" style="background-color:{{ ramp.5 }};"></div> \
    <div class="quintile" style="background-color:{{ ramp.6 }};"></div> \
    <div class="quintile" style="background-color:{{ ramp.7 }};"></div> \
    <div class="quintile" style="background-color:{{ ramp.8 }};"></div> \
    <div class="quintile" style="background-color:{{ ramp.9 }};"></div> \
    <div class="quintile" style="background-color:{{ ramp.10 }};"></div> \
  </div> \
</div>';

var choroplethCSS = ' \
@5:{{ ramp.5 }};\n\
@4:{{ ramp.4 }};\n\
@3:{{ ramp.3 }};\n\
@2:{{ ramp.2 }};\n\
@1:{{ ramp.1 }};\n\
\n\
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
  [val >= {{ stats.buckets.3 }}] { \
     polygon-fill: @5; \
  } \
  [val < {{ stats.buckets.3 }}][val >= {{ stats.buckets.2 }}] { \
     polygon-fill: @4; \
  } \
  [val < {{ stats.buckets.2 }}][val >= {{ stats.buckets.1 }}] { \
     polygon-fill: @3; \
  } \
  [val < {{ stats.buckets.1 }}][val >= {{ stats.buckets.0 }}] { \
     polygon-fill: @2; \
  } \
  [val < {{ stats.buckets.0 }}] { \
     polygon-fill: @1; \
  } \
}';

var categoricalCSS = ' \
@other:{{ ramp.other }};\n\
@10:{{ ramp.10 }};\n\
@9:{{ ramp.9 }};\n\
@8:{{ ramp.8 }};\n\
@7:{{ ramp.7 }};\n\
@6:{{ ramp.6 }};\n\
@5:{{ ramp.5 }};\n\
@4:{{ ramp.4 }};\n\
@3:{{ ramp.3 }};\n\
@2:{{ ramp.2 }};\n\
@1:{{ ramp.1 }};\n\
\n\
#data { \
  polygon-opacity: 0.9; \
  polygon-gamma: 0.5; \
  line-color: #000000; \
  line-width: 0.25; \
  line-opacity: 0.2; \
  line-comp-op: hard-light; \
 \
  [val=null]{ polygon-fill: @other; } \
  [val="{{ stats.buckets.9 }}"] { polygon-fill: @9; } \
  [val="{{ stats.buckets.8 }}"] { polygon-fill: @8; } \
  [val="{{ stats.buckets.7 }}"] { polygon-fill: @7; } \
  [val="{{ stats.buckets.6 }}"] { polygon-fill: @6; } \
  [val="{{ stats.buckets.5 }}"] { polygon-fill: @5; } \
  [val="{{ stats.buckets.4 }}"] { polygon-fill: @4; } \
  [val="{{ stats.buckets.3 }}"] { polygon-fill: @3; } \
  [val="{{ stats.buckets.2 }}"] { polygon-fill: @2; } \
  [val="{{ stats.buckets.1 }}"] { polygon-fill: @1; } \
  [val="{{ stats.buckets.0 }}"] { polygon-fill: @10; } \
}';

var obsFragment = "\
-- First, create a new table, name it how you'd like, \n\
-- and replace <my table name> below with that name \n\
\n\
ALTER TABLE <my table name>\n\
ADD COLUMN {{ numer_colname }} {{ numer_type }};\n\
\n\
WITH meta AS (SELECT OBS_GetMeta(\n\
  st_makeenvelope({{ bounds }}, 4326),\n\
  '[{\"geom_id\": \"{{ geom_id }}\"},\n\
    {\"numer_id\": \"{{ numer_id }}\",\n\
     \"denom_id\": \"{{ denom_id }}\",\n\
     \"numer_timespan\": \"{{ numer_timespan }}\",\n\
     \"geom_id\": \"{{ geom_id }}\"}]'\n\
) meta)\n\
INSERT INTO <my table name> (the_geom, {{ numer_colname }})\n\
SELECT (data->0->>'value')::Geometry the_geom, \n\
       (data->0->>'geomref') geomref, \n\
       (data->1->>'value')::{{ numer_type }} {{ colname }} \n\
FROM OBS_GetData(\n\
  Array[(ST_MakeEnvelope({{ bounds }}, 4326), 1)::geomval],\n\
  (SELECT meta FROM meta), false)\n\
;\n\n\
-- numer: http://observatory.cartodb.com/tables/{{ numer_tablename }}\n\
-- denom: http://observatory.cartodb.com/tables/{{ denom_tablename }}\n\
-- geom: http://observatory.cartodb.com/tables/{{ geom_tablename }}\n\
";

var uploadFragment = "\
WITH meta AS (SELECT OBS_GetMeta(\
  st_makeenvelope({{ bounds }}, 4326),\
  '[{\"geom_id\": \"{{ geom_id }}\"},\
    {\"numer_id\": \"{{ numer_id }}\",\
     \"denom_id\": \"{{ denom_id }}\",\
     \"numer_timespan\": \"{{ numer_timespan }}\",\
     \"geom_id\": \"{{ geom_id }}\"}]'\
) meta)\
SELECT (data->0->>'value')::Geometry the_geom, \
       (data->0->>'geomref') geomref, \n\
       (data->1->>'value')::{{ numer_type }} {{ colname }} \
FROM OBS_GetData(\
  Array[(ST_MakeEnvelope({{ bounds }}, 4326), 1)::geomval],\
  (SELECT meta FROM meta), false)";

var measureExprs = {
  predenominated: 'data.{{ numer_colname }} val ',
  categorical: 'data.{{ numer_colname }} val ',
  areaNormalized: 'data.{{ numer_colname }}' +
    ' / (ST_Area(geom.the_geom_webmercator) / 1000000.0) val ',
  denominated: 'numer.{{ numer_colname }}' +
  ' / NULLIF(denom.{{ denom_colname }}, 0) val '
};

var categoryStatsSql =
  'SELECT array_agg(buckets) buckets FROM ( ' +
  'SELECT row_number() over () catname, val as buckets, COUNT(*) cnt ' +
  'FROM ({{{ table }}}) _table_sql ' +
  'GROUP BY val ORDER BY COUNT(*) DESC '+
  ') foo';

var measureStatsSql =
  'SELECT MIN(val) min, MAX(val) max, ' +
  'CDB_HeadsTailsBins(array_agg(distinct(val::numeric)), 4) as buckets ' +
  'FROM ({{{ table }}}) _table_sql';

var tables = {
  predenominated: 'SELECT ' + measureExprs.predenominated +
    ', geom.cartodb_id, geom.the_geom_webmercator ' +
    ', geom.{{ geom_geomref_colname }} geom_ref ' +
    'FROM {{ numer_tablename }} as data,   ' +
    '     {{ geom_tablename }} geom   ' +
    'WHERE data.{{ numer_geomref_colname }} =  geom.{{ geom_geomref_colname }}',
  categorical: 'SELECT ' + measureExprs.categorical +
    ', geom.cartodb_id, geom.the_geom_webmercator ' +
    ', geom.{{ geom_geomref_colname }} geom_ref ' +
    'FROM {{ numer_tablename }} as data,   ' +
    '     {{ geom_tablename }} geom   ' +
    'WHERE data.{{ numer_geomref_colname }} =  geom.{{ geom_geomref_colname }}',
  areaNormalized: 'SELECT ' + measureExprs.areaNormalized +
    ', geom.cartodb_id, geom.the_geom_webmercator ' +
    ', geom.{{ geom_geomref_colname }} geom_ref ' +
    'FROM {{ numer_tablename }} as data,   ' +
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
  categorical: function(_) { return ''; },
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
    WHERE '{{ numer_id }}' = numer_id \
      AND ('{{ denom_id }}' = denom_id OR \
           ('{{ denom_id }}' = '' AND denom_id IS NULL)) \
      AND '{{ geom_id }}' = geom_id \
      AND '{{ timespan_id }}' = numer_timespan",
  subsection: "\
    SELECT numer_tags AS id, obs_tag.name, count(*) num_measures \
    FROM ( \
      SELECT jsonb_object_keys(numer_tags) numer_tags \
      FROM obs_meta_numer \
      WHERE the_geom && ST_MakeEnvelope({{ bounds }}, 4326) \
        AND (numer_tags ?| {{{ subsections }}} OR \
             Cardinality({{{ subsections }}}::TEXT[]) = 0) \
    ) foo, obs_tag \
    WHERE numer_tags like 'subsection/%' \
      AND REPLACE(numer_tags, 'subsection/', '') = obs_tag.id \
    GROUP BY numer_tags, obs_tag.name",
    // Temporarily force "true" for valid_timespan
    //
    //   score NUMERIC,
    //     numtiles BIGINT,
    //       notnull_percent NUMERIC,
    //         numgeoms NUMERIC,
    //           percentfill NUMERIC,
    //             estnumgeoms NUMERIC,
    //               meanmediansize NUMERIC
    //
  geom: "\
    SELECT geom_id, geom_name, geom_description, valid_numer, \
           coalesce(valid_denom, true) valid_denom, true as valid_timespan, \
           true valid_geom, score, numtiles, notnull_percent, numgeoms, \
           percentfill, estnumgeoms, meanmediansize \
    FROM OBS_GetAvailableGeometries(st_makeenvelope({{ bounds }}, 4326), \
         NULL, '{{ numer_id }}', '{{ denom_id }}', '{{ timespan_id }}') \
    ORDER BY score DESC",
  timespan: "\
    SELECT timespan_id, timespan_name, valid_numer, \
           coalesce(valid_denom, true) valid_denom, valid_geom, \
           true valid_timespan \
    FROM OBS_GetAvailableTimespans( \
           st_makeenvelope({{ bounds }}, 4326), NULL, '{{ numer_id }}', \
                          '{{ denom_id }}', '{{ geom_id }}')",
  numer: "\
    SELECT numer_id, numer_name, numer_description, valid_geom, \
           coalesce(valid_denom, true) valid_denom, valid_timespan, \
           true valid_numer, numer_tags \
    FROM OBS_GetAvailableNumerators( \
           st_makeenvelope({{ bounds }}, 4326), NULL, '{{ denom_id }}', \
                          '{{ geom_id }}', '{{ timespan_id }}')",
  denom: "\
    SELECT denom_id, denom_name, denom_description, valid_numer, \
           valid_numer, valid_geom, true valid_timespan, true valid_denom \
    FROM OBS_GetAvailableDenominators( \
           st_makeenvelope({{ bounds }}, 4326), NULL, '{{ numer_id }}', \
                          '{{ geom_id }}', '{{ timespan_id }}')"
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

var getSubsections = function () {
  return $('.box-subsectionSelect').val() || [];
};

var getSelection = function () {
  return {
    bounds: nativeMap.getBounds().toBBoxString(),
    numer_id: $('.box-numerSelect').val(),
    denom_id: $('.box-denomSelect').val(),
    geom_id: $('.box-geomSelect').val(),
    timespan_id: $('.box-timespanSelect').val(),
    subsections: 'Array' + JSON.stringify(getSubsections()).replace(/"/g, "'") +
                 '::TEXT[]'
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

/**
 * Get or set an element of state in hash
 */
var state = function (key, val) {
  var hash = decodeURIComponent(window.location.hash.substr(1));
  var state;
  if (val) {
    if (hash.length > 0) {
      state = JSON.parse(hash);
    } else {
      state = {};
    }
    state[key] = val;
    window.location.hash = JSON.stringify(state);
  } else {
    if (hash.length > 0) {
      return JSON.parse(hash)[key];
    }
  }
};

$( document ).ready(function () {
  var sublayer;

  if (state('api_key')) {
    $('#api_yek').val(state('api_key'));
  }

  var renderDialog = function () {
    lastResult.bounds = nativeMap.getBounds().toBBoxString().replace(/(\.\d\d)\d*/g, '$1');
    $('.obs-code-fragment').text(Mustache.render(obsFragment, lastResult));
    $('#upload-sql').attr('value', Mustache.render(uploadFragment, lastResult));
  };

  $('#api_yek').on('change', function (evt) {
    if ($('#store_credentials').is(':checked')) {
      state('api_key', $(evt.target).val());
    }
  });

  $('#user').on('change', function (evt) {
    if ($('#store_credentials').is(':checked')) {
      state('user', $(evt.target).val());
    }
  });

  $('.open-in-carto').on('click', function (evt) {
    var key = state('api_key') || $('#api_yek').val(),
        user = state('user') || $('#user').val(),
        $a = $(evt.target).parent('a');
    if (key && user) {
      var url = "http://oneclick.carto.com/?file=" + encodeURIComponent(encodeURI(
        "http://" + user + ".carto.com/api/v2/sql?q=" +
        $('#upload-sql').val() +
        "&format=csv&api_key=" + key))
      $a.attr('href', url);
    } else {
      $('#openInCartoModal').modal('show');
    }
  });

  var renderMap = function () {
    query('data').done(function (results) {
      var result = results[0];
      if (!result) {
        return;
      }
      lastResult = result;
      renderDialog();
      var unit;
      if (result.unit_tags) {
        unit = result.unit_tags[0];
      } else {
        unit = 'unknown';
      }
      if (!ramps[unit]) {
        //throw Error('No ramp for unit "' + unit + '"');
        unit = 'unknown';
      }
      var ramp = ramps[unit];
      var mapType;
      var statsSql, cartoCSS, legendTemplate;
      if (result.denom_tablename) {
        mapType = 'denominated';
      } else if (result.numer_aggregate === 'sum') {
        mapType = 'areaNormalized';
      } else if (unit === 'tags.segmentation' || result.numer_type.match(/Text/i)) {
        mapType = 'categorical';
        if (unit === 'unknown') {
          ramp = ramps['unknown-categorical']
        }
      } else {
        mapType = 'predenominated';
      }
      var tableSql = Mustache.render(tables[mapType], result);
      if (mapType === 'categorical') {
        statsSql = categoryStatsSql;
        cartoCSS = categoricalCSS;
        legendTemplate = categoricalLegendTemplate;
      } else {
        statsSql = measureStatsSql;
        cartoCSS = choroplethCSS;
        legendTemplate = choroplethLegendTemplate;
      }
      sql.execute(statsSql, {table: tableSql.replace(
        ' as data,',
        ' as data TABLESAMPLE SYSTEM(5),')
      }, function (stats) {
        var l, renderedCSS;
        stats = stats.rows[0];
        var unitstr = unitHuman[mapType](unit);
        renderedCSS = Mustache.render(cartoCSS, {
          ramp: ramp,
          stats: stats
        });
        if (legendTemplate === choroplethLegendTemplate) {
          l = new cartodb.geo.ui.Legend({
            type: 'custom',
            template: '<div>' + Mustache.render(legendTemplate, {
              max: fmt(stats.max, stats.max, unitstr),
              min: fmt(stats.min, stats.max, unitstr),
              ramp: ramp,
              headtails: _.map(stats.buckets, function(ht) {
                return fmt(ht, stats.max, unitstr);
              }),
              unit: unitstr
            }) + '</div>'
          });
        } else {
          l = new cartodb.geo.ui.Legend({
            type: 'custom',
            template: '<div>' + Mustache.render(legendTemplate, {
              buckets: stats.buckets,
              ramp: ramp,
              unit: unitstr
            }) + '</div>'
          });
        }
        sublayer.setCartoCSS(renderedCSS);
        sublayer.setSQL(tableSql);
        l.render();
        $('.cartodb-legend.wrapper').replaceWith(l.$el);
      });
    });
  };

  var renderSubsections = function () {
    var $select = $('.box-subsectionSelect');
    query('subsection').done(function (results) {
      var subsections = getSubsections();
      $select.empty();
      _.each(results, function (r) {
        var $option = $('<option />').val(r.id)
                        .text(r.name + ' (' + r.num_measures+ ')');
        if (_.indexOf(subsections, r.id) !== -1) {
          $option.prop('selected', true);
        }
        $select.append($option);
      });
      $select.select2();
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
      var subsections = getSubsections();
      $available.empty();
      $changeOne.empty();
      $changeTwo.empty();
      $changeThree.empty();
      $unavailable.empty();
      _.each(results, function (r) {

        // Filter by subsection for numer, _all_ selected subsections must be
        // tags
        if (type === 'numer') {
          var tags = r.numer_tags;
          if (subsections.length > 0 &&
              _.intersection(subsections, _.keys(tags)).length !== subsections.length
          ) {
            return;
          }
        }

        var selected = false;
        var invalidCount;
        try {
          var name = decodeURIComponent(escape(r[type + '_name'])) || 'None';
        } catch (err) {
          var name = r[type + '_name'] || 'None';
        }
        if (type === 'geom') {
          name += ' (' + r.numgeoms.toFixed(0) + ')';
        }
        var $option = $('<option />')
                       .text(name)
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
      /** Always include an option for no denom **/
      if ($available.children().length === 0 && type === 'denom') {
        var $noDenomOption = $('<option />')
                              .text("None")
                              .data({
                                denom_description : "",
                                denom_id : "",
                                denom_name : "None"
                              }).val('');
        if (selection[type + '_id'] === "") {
          $noDenomOption.prop('selected', true);
          //selected = true;
        }
        $available.append($noDenomOption);
      }
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
        if (nativeMap.getZoom() > 4) {
          renderMenu();
          renderSubsections();
          renderDialog();
        }
      });

      $('.box-select').on('change', function () {
        if (nativeMap.getZoom() > 4) {
          renderMenu();
          renderSubsections();
          renderMap();
        }
      });

      $('.box-subsectionSelect').on('change', function () {
        if (nativeMap.getZoom() > 4) {
          renderMenu();
          renderSubsections();
        }
      });

      $( ".box-input" ).on( "click", function () {
        $(this).toggleClass( "is-open" );
        maxHeightList();
        $(".box-container").toggleClass( "is-hidden" );
      });

      if (nativeMap.getZoom() > 4) {
        renderMenu();
        renderSubsections();
        renderMap();
      }
    });
});
