/*jshint multistr: true, browser: true, maxstatements: 100, camelcase: false*/
/*globals $, cartodb, _, Mustache*/

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
        'tags.people':
          '@5:#6c2167;\
          @4:#a24186;\
          @3:#ca699d;\
          @2:#e498b4;\
          @1:#f3cbd3;',
        'tags.money':
          '@5:#1d4f60;\
          @4:#2d7974;\
          @3:#4da284;\
          @2:#80c799;\
          @1:#c4e6c3;',
        'tags.households':
          '@5:#63589f;\
          @4:#9178c4;\
          @3:#b998dd;\
          @2:#dbbaed;\
          @1:#f3e0f7;',
        'tags.housing':
          '@5:#2a5674;\
          @4:#45829b;\
          @3:#68abb8;\
          @2:#96d0d1;\
          @1:#d1eeea;',
        'tags.ratio':
          '@5:#eb4a40;\
          @4:#f17854;\
          @3:#f59e72;\
          @2:#f9c098;\
          @1:#fde0c5;',
        'tags.index':
          '@5:#eb4a40;\
          @4:#f17854;\
          @3:#f59e72;\
          @2:#f9c098;\
          @1:#fde0c5;'
};

/** choropleth visualization */

var cartoCSS = '{{ramp}} \
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

var mapSQLPredenominated =
  'WITH stats AS(SELECT MAX({{ numer_colname }}),   ' +
  '                     MIN({{ numer_colname }})   ' +
  '              FROM {{ numer_tablename }} data)   ' +
  'SELECT data.cartodb_id, geom.the_geom_webmercator,   ' +
  '       (data.{{ numer_colname }} - stats.min) /   ' +
  '       (stats.max - stats.min) AS val   ' +
  'FROM stats, {{ numer_tablename }} data,   ' +
  '     {{geom_tablename }} geom   ' +
  'WHERE data.{{ numer_geomref_colname }} = ' +
  'geom.{{ geom_geomref_colname }}';
var mapSQLAreaNormalized =
  'WITH stats AS(SELECT MAX({{ numer_colname }} / ' +
  '                         ST_Area(geom.the_geom_webmercator)),   ' +
  '                     MIN({{ numer_colname }} / ' +
  '                         ST_Area(geom.the_geom_webmercator))   ' +
  '              FROM {{ numer_tablename }} data,  ' +
  '                   {{ geom_tablename }} geom    ' +
  '              WHERE data.{{ numer_geomref_colname }} =  ' +
  '                    geom.{{ geom_geomref_colname }} )   ' +
  'SELECT data.cartodb_id, geom.the_geom_webmercator,   ' +
  '       ((data.{{ numer_colname }} /  ' +
  '        ST_Area(geom.the_geom_webmercator)) - stats.min) /   ' +
  '       (stats.max - stats.min) AS val   ' +
  'FROM stats, {{ numer_tablename }} data,   ' +
  '     {{geom_tablename }} geom   ' +
  'WHERE data.{{ numer_geomref_colname }} = ' +
  'geom.{{ geom_geomref_colname }}';
var mapSQLDenominated =
  'WITH stats AS(SELECT MAX(numer.{{ numer_colname }} / ' +
  '                     NULLIF(denom.{{ denom_colname }}, 0)),   ' +
  '                     MIN(numer.{{ numer_colname }} / ' +
  '                     NULLIF(denom.{{ denom_colname }}, 0))   ' +
  '              FROM {{ numer_tablename }} numer,  ' +
  '                   {{ denom_tablename }} denom    ' +
  '              WHERE numer.{{ numer_geomref_colname }} =  ' +
  '                    denom.{{ denom_geomref_colname }} )   ' +
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

  /*** RENDERING FUNCTIONS ***/
  //var renderStats = function () {
  //  $('.figure-sql').val(measureSql.replace(/  (\s*)/g, '\n$1'));
  //  $('.figure-timespan').text(selectedMeasure.timespan);
  //};

  var renderSubsections = function () {
    query('subsection').done(function (subsections) {
      $('.box-nav').empty();
      var $ul = $('<ul />', {"class": "box-navNavigation"});
      // extract unique subsections from `data`
      $.each( subsections, function (i, subsection) {
        var $a = $("<a />", { href: '#' })
          .text(subsection.name + ' (' + subsection.num_measures + ')')
          .on('click', function () {
            $(".js-box-input").text(subsection.label);
            $(".box-navNavigation a").removeClass( "is-selected" );
            $(this).toggleClass( "is-selected" );
            //renderMeasures(subsection);
          });
        $('<li />').addClass(i === 0 ? 'is-selected' : '')
                   .append($a).appendTo($ul);
      });
      $ul.appendTo('.box-nav');
    });

      //renderMeasures(_.find(subsections, function (s) {
      //  return s.label === selection.subsection;
      //}));
  };

  var renderMap = function () {
    query('data').done(function (results) {
      var result = results[0];
      if (!result) {
        return;
      }
      var unit = result.unit_tags[0];
      if (result.numer_aggregate === 'sum') {
        if (result.denom_tablename) {
          measureSql = Mustache.render(mapSQLDenominated, result);
        } else {
          measureSql = Mustache.render(mapSQLAreaNormalized, result);
        }
      } else {
        measureSql = Mustache.render(mapSQLPredenominated, result);
      }
      sublayer.setSQL(measureSql);
      sublayer.setCartoCSS(Mustache.render(cartoCSS, {ramp: ramps[unit]}));
    });

    //renderStats();
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
        var $option = $('<option />')
                       .text(r[type + '_name'] || 'None')
                       .data(r)
                       .val(r[type + '_id'] || '');
        if (r[type + '_id'] === selection[type + '_id']) {
          $option.prop('selected', true);
        }
        if (r.valid_numer && r.valid_denom && r.valid_geom && r.valid_timespan) {
          $available.append($option);
        } else {
          $unavailable.append($option);
        }
      });
    });
  };

  var renderMenu = function () {
    renderSubsections();
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
      //$('.box-boundarySelect').on('change', function (evt) {
      //  var $select = $(evt.target);
      //});

      $( ".box-input" ).on( "click", function () {
        $(this).toggleClass( "is-open" );
        maxHeightList();
        $(".box-container").toggleClass( "is-hidden" );
      });
      renderMenu();
    });
});
