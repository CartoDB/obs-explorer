/*jshint multistr: true, browser: true, maxstatements: 100, camelcase: false*/
/*globals $, cartodb, _*/

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

//var selection = {
//  measure:  'us.census.acs.B11001001',
//  boundary: 'us.census.tiger.block_group_clipped',
//  timespan: '2010 - 2014',
//  subsection: 'Housing'
//};

var nativeMap;
var _selection = {
  numer_id: 'us.census.acs.B11001001',
  denom_id: null,
  geom_id:  'us.census.tiger.block_group_clipped',
  timespan_id: '2010 - 2014'
};

var openSubsection = 'tags.housing';

var palettes = {
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
          @1:#fde0c5;'
};

var queries = {
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
    '{{ denom_id }}' = ANY(ARRAY_AGG(DISTINCT denom_id)) OR '{{ denom_id }}' = '' valid_denom, \
    '{{ timespan_id }}' = ANY(ARRAY_AGG(DISTINCT numer_timespan)) valid_timespan, \
    true valid_geom \
    FROM obs_meta \
    WHERE st_intersects(geom_bounds, st_makeenvelope({{ bounds }})) \
    GROUP BY geom_id ORDER BY geom_id",
  timespan: "\
    SELECT numer_timespan timespan_id, numer_timespan timespan_name, \
    '{{ numer_id }}' = ANY(ARRAY_AGG(DISTINCT numer_id)) valid_numer, \
    '{{ denom_id }}' = ANY(ARRAY_AGG(DISTINCT denom_id)) OR '{{ denom_id }}' = '' valid_denom, \
    '{{ geom_id }}' = ANY(ARRAY_AGG(DISTINCT geom_id)) valid_geom, \
    true valid_timespan \
    FROM obs_meta \
    WHERE st_intersects(geom_bounds, st_makeenvelope({{ bounds }})) \
    GROUP BY numer_timespan ORDER BY numer_timespan DESC",
  numer: "\
    SELECT numer_id, MAX(numer_name) numer_name, \
                     MAX(numer_description) numer_description, \
    '{{ geom_id }}' = ANY(ARRAY_AGG(DISTINCT geom_id)) valid_geom, \
    '{{ denom_id }}' = ANY(ARRAY_AGG(DISTINCT denom_id)) OR '{{ denom_id }}' = '' valid_denom, \
    '{{ timespan_id }}' = ANY(ARRAY_AGG(DISTINCT numer_timespan)) valid_timespan, \
    true valid_numer \
    FROM obs_meta \
    WHERE st_intersects(geom_bounds, st_makeenvelope({{ bounds }})) \
    GROUP BY numer_id ORDER BY numer_id",
  denom: "\
    SELECT denom_id, MAX(denom_name) denom_name, \
                     MAX(denom_description) denom_description, \
    '{{ numer_id }}' = ANY(ARRAY_AGG(DISTINCT numer_id)) valid_numer, \
    '{{ geom_id }}' = ANY(ARRAY_AGG(DISTINCT geom_id)) valid_geom, \
    '{{ timespan_id }}' = ANY(ARRAY_AGG(DISTINCT numer_timespan)) valid_timespan, \
    true valid_denom \
    FROM obs_meta \
    WHERE st_intersects(geom_bounds, st_makeenvelope({{ bounds }})) \
    GROUP BY denom_id ORDER BY denom_id"
};

var getSelection = function () {
  var bounds = nativeMap.getBounds().toBBoxString();
  _selection.bounds = bounds;
  return _selection; // TODO
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

  //var renderMeasures = function (subsection) {
  //  var measures = subsection.measures;
  //  var $ul = $( "<ul/>", {
  //    "class": "box-resultList js-result-category"
  //  });

  //  $( ".js-result-category" ).empty();
  //  $( ".box-result" ).empty();

  //  $.each(measures, function (_, measure) {
  //    if (!measure) {
  //      return;
  //    }
  //    var $link = $("<a href='#'></a>")
  //      .text(measure.name)
  //      .data(measure)
  //      .on('click', function(evt) {
  //        evt.preventDefault();
  //        selectedMeasure = $(this).data();
  //        selectedSubsection = subsection.label;
  //        $(".js-result-category li a").removeClass( "is-selected" );
  //        $(this).toggleClass( "is-selected" );
  //        $('.box-container').toggleClass( "is-hidden" );
  //        $(".js-box-selectTitle").text($(this).text());

  //        renderMap();
  //      });
  //    if (measure.dataColId === selectedMeasure.dataColId) {
  //      selectedMeasure = measure;
  //      renderMap();
  //    }
  //    $ul.append($("<li />").append($link));
  //  });
  //  $ul.appendTo(".box-result");
  //  $(".js-result-category").niceScroll({
  //    cursorcolor: "#ccc", // change cursor color in hex
  //    cursorwidth: "4px"
  //  });
  //  maxHeightList();
  //};

  //var renderMap = function () {
  //  measureSql =
  //    'WITH stats AS(SELECT MAX(' + selectedMeasure.dataDataColname +
  //                            '),   ' +
  //    '                     MIN(' + selectedMeasure.dataDataColname +
  //                             ')   ' +
  //    '              FROM '+ selectedMeasure.dataTablename + ')   ' +
  //    'SELECT data.cartodb_id, geom.the_geom_webmercator,   ' +
  //    '       (data.'+ selectedMeasure.dataDataColname + '-stats.min)/   ' +
  //    '       (stats.max-stats.min) AS val   ' +
  //    'FROM stats, ' + selectedMeasure.dataTablename + ' data,   ' +
  //       selectedBoundary.geomTablename + ' geom   ' +
  //    'WHERE data.' + selectedMeasure.dataGeoidColname + ' = ' +
  //          'geom.' + selectedBoundary.geomGeoidColname;
  //  sublayer.setSQL(measureSql);
  //  var css = sublayer.getCartoCSS();
  //  sublayer.setCartoCSS(css);

  //  renderStats();
  //};
  //
  var renderSelect = function (type) {
    query(type).done(function (results) {
      var $select = $('.box-' + type + 'Select');
      var $available = $select.find('.box-optgroupAvailable');
      var $unavailable = $select.find('.box-optgroupUnavailable');
      $available.empty();
      $unavailable.empty();
      //$select.append($('<option />').text('None').val(''));
      _.each(results, function (r) {
        var $option = $('<option />')
                       .text(r[type + '_name'])
                       .data(r)
                       .val(r[type + '_id']);
        if (r[type + '_id'] === getSelection()[type + '_id']) {
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

  var render = function () {
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
        render();
      });

      $('.box-select').on('change', function (evt) {
        render();
      });
      //$('.box-boundarySelect').on('change', function (evt) {
      //  var $select = $(evt.target);
      //});

      $( ".box-input" ).on( "click", function () {
        $(this).toggleClass( "is-open" );
        maxHeightList();
        $(".box-container").toggleClass( "is-hidden" );
      });
      render();
    });
});
