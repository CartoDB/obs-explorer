/*jshint multistr: true, browser: true, maxstatements: 100*/
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

$( document ).ready(function () {
  var sublayer;
  var selectedMeasure = {
    aggregate: 'sum',
    dataTablename: 'obs_7a0c2217e1af9da6abb7bbb458044395952a9ceb',
    dataDataColname: 'housing_units',
    dataGeoidColname: 'geoid',
    dataColId: 'us.census.acs.B11001001'
  };
  var selectedBoundary = {
    geomGeoidColname: 'geoid',
    geomTablename: 'obs_6c1309a64d8f3e6986061f4d1ca7b57743e75e74',
    geoidColId: 'us.census.tiger.block_group_geoid',
    geomColId: 'us.census.tiger.block_group_clipped'
  };
  var selectedSubsection = 'Housing';
  var measureSql ='';
  var mapCenter = [37.804444, -122.270833];
  var nativeMap;

  /*** RENDERING FUNCTIONS ***/
  var renderStats = function () {
    $('.figure-sql').val(measureSql.replace(/  (\s*)/g, '\n$1'));
    $('.figure-timespan').text(selectedMeasure.timespan);
  };

  var renderSubsections = function (subsections) {
    $('.box-nav').empty();
    var $ul = $('<ul />', {"class": "box-navNavigation"});
    $.each( subsections, function (i, subsection) {
      var $a = $("<a />", { href: '#' })
        .text(subsection.label)
        .on('click', function () {
          $(".js-box-input").text(subsection.label);
          $(".box-navNavigation a").removeClass( "is-selected" );
          $(this).toggleClass( "is-selected" );
          renderMeasures(subsection);
        });
      $('<li />').addClass(i === 0 ? 'is-selected' : '')
                 .append($a).appendTo($ul);
    });
    $ul.appendTo('.box-nav');

    renderMeasures(_.find(subsections, function (s) {
      return s.label === selectedSubsection;
    }));
  };

  var renderMeasures = function (subsection) {
    var measures = subsection.measures;
    var $ul = $( "<ul/>", {
      "class": "box-resultList js-result-category"
    });

    $( ".js-result-category" ).empty();
    $( ".box-result" ).empty();

    $.each(measures, function (_, measure) {
      if (!measure) {
        return;
      }
      var $link = $("<a href='#'></a>")
        .text(measure.name)
        .data(measure)
        .on('click', function(evt) {
          evt.preventDefault();
          selectedMeasure = $(this).data();
          selectedSubsection = subsection.label;
          $(".js-result-category li a").removeClass( "is-selected" );
          $(this).toggleClass( "is-selected" );
          $('.box-container').toggleClass( "is-hidden" );
          $(".js-box-selectTitle").text($(this).text());

          renderMap();
        });
      if (measure.dataColId === selectedMeasure.dataColId) {
        selectedMeasure = measure;
        renderMap();
      }
      $ul.append($("<li />").append($link));
    });
    $ul.appendTo(".box-result");
    $(".js-result-category").niceScroll({
      cursorcolor: "#ccc", // change cursor color in hex
      cursorwidth: "4px"
    });
    maxHeightList();
  };

  var renderMap = function (){
    measureSql =
      'WITH stats AS(SELECT MAX(' + selectedMeasure.dataDataColname +
                              '),   ' +
      '                     MIN(' + selectedMeasure.dataDataColname +
                               ')   ' +
      '              FROM '+ selectedMeasure.dataTablename + ')   ' +
      'SELECT data.cartodb_id, geom.the_geom_webmercator,   ' +
      '       (data.'+ selectedMeasure.dataDataColname + '-stats.min)/   ' +
      '       (stats.max-stats.min) AS val   ' +
      'FROM stats, ' + selectedMeasure.dataTablename + ' data,   ' +
         selectedBoundary.geomTablename + ' geom   ' +
      'WHERE data.' + selectedMeasure.dataGeoidColname + ' = ' +
            'geom.' + selectedBoundary.geomGeoidColname;
    sublayer.setSQL(measureSql);
    var css = sublayer.getCartoCSS();
    sublayer.setCartoCSS(css);

    renderStats();
  };

  var renderBoundarySelect = function(boundaries) {
    var $boundarySelect = $('.box-boundarySelect');
    $boundarySelect.empty();
    $.each(boundaries, function (_, boundary) {
      $('<option />')
        .attr('selected', selectedBoundary.geomColId === boundary.geomColId)
        .data(boundary)
        .text(boundary.name)
        .appendTo($boundarySelect);
    });
  };

  /*** Update functions (SQL) ***/
  var updateMeasures = function (){
    var findMeasures =
      'SELECT name as label, \
         (SELECT JSON_AGG(( \
           \'{"name":"\' || replace(name, \'"\', \'\\"\') || \
           \'","aggregate":"\' || data_c.aggregate || \
           \'","dataTablename":"\' || data_t.tablename || \
           \'","dataTableId":"\' || data_t.id || \
           \'","dataDataColname":"\' || data_data_ct.colname || \
           \'","dataGeoidColname":"\' || data_geoid_ct.colname || \
           \'","dataColId":"\' || data_c.id || \
           \'","timespan":"\' || data_t.timespan || \
           \'" }\' \
           )::json) \
           FROM obs_column data_c, obs_column_tag ctag, \
                obs_column_table data_data_ct, \
                obs_column_table data_geoid_ct, \
                obs_table data_t \
           WHERE data_c.id = ctag.column_id \
             AND ctag.tag_id = t.id \
             AND data_data_ct.column_id = data_c.id  \
             AND data_data_ct.table_id = data_t.id \
             AND data_geoid_ct.column_id = \'{{geoidColId}}\'\
             AND data_geoid_ct.table_id = data_t.id \
         ) AS measures \
       FROM obs_tag t \
       WHERE type ILIKE \'subsection\' and id LIKE \'tags.%\' \
       GROUP BY id, name';

    sql.execute(findMeasures, {
      geoidColId: selectedBoundary.geoidColId
    })
      .done(function (rawdata) {
        var subsections = _.filter(rawdata.rows, function (subsection) {
          return subsection.measures;
        });
        renderSubsections(subsections);
      });
  };

  var updateBoundaries = function (){
    var findAvailableGeoms =
      "SELECT geom_t.id AS \"geomTableId\", \
              geom_t.tablename AS \"geomTablename\", \
              geom_geoid_ct.colname AS \"geomGeoidColname\", \
              geom_geom_ct.colname AS \"geomGeomColname\", \
              geom_geom_c.weight, geom_t.timespan, \
              geom_geom_c.name, geom_geom_c.id AS \"geomColId\", \
              geom_geoid_c.id AS \"geoidColId\" \
       FROM obs_column_to_column c2c, \
            obs_table geom_t, obs_column_table geom_geoid_ct, \
            obs_column geom_geoid_c, obs_column geom_geom_c, \
            obs_column_table geom_geom_ct \
       WHERE c2c.reltype = 'geom_ref' \
         AND c2c.source_id = geom_geoid_c.id \
         AND c2c.target_id = geom_geom_c.id \
         AND geom_geoid_c.id = geom_geoid_ct.column_id \
         AND geom_geoid_ct.table_id = geom_t.id \
         AND geom_geom_ct.table_id = geom_t.id \
         AND geom_geom_ct.column_id = geom_geom_c.id \
         AND geom_geom_c.type ILIKE 'geometry' \
         AND ST_Intersects(geom_t.bounds::Box2D, \
                           ST_MakeEnvelope({{bounds}})) \
       ORDER BY geom_geom_c.weight DESC, geom_t.timespan DESC, geom_t.id";
    var bounds = nativeMap.getBounds().toBBoxString();
    sql.execute(findAvailableGeoms, {
      bounds: bounds
    })
      .done(function (rawdata) {
        var availableBoundaries = rawdata.rows;
        //selectedBoundary = availableBoundaries[0];
        updateMeasures();
        renderBoundarySelect(availableBoundaries);
      });
  };

  var update = function () {
    updateBoundaries();
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
        update();
      });

      $('.box-boundarySelect').on('change', function (evt) {
        var $select = $(evt.target);
        selectedBoundary = $select.find(':selected').data();
        update();
      });

      $( ".box-input" ).on( "click", function () {
        $(this).toggleClass( "is-open" );
        maxHeightList();
        $(".box-container").toggleClass( "is-hidden" );
      });
      update();
    });
});
