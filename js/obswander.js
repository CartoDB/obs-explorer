/*jshint multistr: true, browser: true*/
/*globals $, cartodb, _*/
var sublayer;

var maxHeightList = function(){
  var heightScreen = $(window).height();
  var heightNavigation = 86;
  var heightHeader = $('.box-header').height();
  var maxHeightScroll = (heightScreen) - (40 + heightNavigation + heightHeader) - 64;
  $('.box-resultList').css('max-height', maxHeightScroll);
};

$( document ).ready(function() {
  var selection = {
    aggregate: 'sum',
    dataTablename: 'obs_1a098da56badf5f32e336002b0a81708c40d29cd',
    geomTablename: 'obs_6c1309a64d8f3e6986061f4d1ca7b57743e75e74',
    dataDataColname: 'housing_units',
    geomGeoidColname: 'geoid',
    dataGeoidColname: 'geoid'
  };
  var selectedBoundary;
  var findMeasures;
  var measureSql ='';
  var mapCenter = [37.804444, -122.270833];

  cartodb.createVis('map', 'viz.json', {
    zoom: 11, center: mapCenter, search: true
  })
    .done(function(map, layers){
      sublayer = layers[1].getSubLayer(0);

      var nativeMap = map.getNativeMap();

      var sql = new cartodb.SQL({ user: 'observatory', 'https': true });

      nativeMap.doubleClickZoom.enable();
      nativeMap.scrollWheelZoom.enable();
      nativeMap.boxZoom.enable();
      nativeMap.touchZoom.enable();
      nativeMap.keyboard.enable();

      var updateStats = function () {
        $('.figure-sql').val(measureSql.replace(/  (\s*)/g, '\n$1'));
        $('.figure-timespan').text(selection.timespan);
      };

      /* read json */
      var subitemsMenu = function($el, tags) {
        var id = $el.attr("data-value");
        var tag = tags[id];
        var measures = tag.measures;
        var subitems = [];
        $.each(measures, function( _, val ) {
          if (val) {
            var $link = $("<a href='#'></a>");
            $link.text(val.name);
            $link.data(val);
            subitems.push($("<li />").append($link));
          }
        });

        $( ".js-result-category" ).empty();
        $( ".box-result" ).empty();
        var $ul = $( "<ul/>", {
          "class": "box-resultList js-result-category"
        });
        for (var i = 0; i < subitems.length; i += 1) {
          $ul.append(subitems[i]);
        }
        $ul.appendTo(".box-result");
        maxHeightList();
      };

      var clickSubitem = function(){
        $( ".js-result-category li a" ).on( "click", function() {
          selection = $(this).data();
          $(".js-result-category li a").removeClass( "is-selected" );
          $(this).toggleClass( "is-selected" );
          $('.box-container').toggleClass( "is-hidden" );
          $(".js-box-selectTitle").text($(this).text());

          measureSql =
            'WITH stats AS(SELECT MAX(' + selection.dataDataColname + '),   ' +
            '                     MIN(' + selection.dataDataColname + ')   ' +
            '              FROM '+ selection.dataTablename + ')   ' +
            'SELECT data.cartodb_id, geom.the_geom_webmercator,   ' +
            '       (data.'+ selection.dataDataColname + '-stats.min)/   ' +
            '       (stats.max-stats.min) AS val   ' +
            'FROM stats, ' + selection.dataTablename + ' data,   ' +
               selection.geomTablename + ' geom   ' +
            'WHERE data.' + selection.dataGeoidColname + ' = ' +
                  'geom.' + selection.geomGeoidColname;
          sublayer.setSQL(measureSql);
          var css = sublayer.getCartoCSS();
          sublayer.setCartoCSS(css);

          updateStats();
        });
      };

      var boundarySelect = function(availableBoundaries){
        var $boundarySelect = $('.box-boundarySelect');
        $boundarySelect.empty();
        $.each(availableBoundaries, function (_, boundary) {
          var $option = $('<option />');
          $option.data(boundary);
          $option.text(boundary.name);
          $boundarySelect.append($option);
        });
      };

      var scrollFunction = function(){
        $(".js-result-category").niceScroll({
          cursorcolor: "#ccc", // change cursor color in hex
          cursorwidth: "4px"
        });
      };

      var updateMenu = function() {
        var findAvailableGeoms =
          "SELECT geom_t.id AS geom_t_id, \
                  geom_t.tablename AS geom_tablename, \
                  geom_geoid_ct.colname AS geom_geoid_colname, \
                  geom_geom_ct.colname AS geom_geom_colname, \
                  geom_geom_c.weight, geom_t.timespan, \
                  geom_geom_c.name, \
                  geom_geoid_c.id AS geoid_col_id \
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
            selectedBoundary = availableBoundaries[0];
            boundarySelect(availableBoundaries);
            findMeasures =
              'SELECT name as label, \
                 (SELECT JSON_AGG(( \
                   \'{"name":"\' || replace(name, \'"\', \'\\"\') || \
                   \'","aggregate":"\' || data_c.aggregate || \
                   \'","dataTablename":"\' || data_t.tablename || \
                   \'","dataDataColname":"\' || data_data_ct.colname || \
                   \'","dataGeoidColname":"\' || data_geoid_ct.colname || \
                   \'","timespan":"\' || data_t.timespan || \
                   \'","geomTablename":"{{geomTablename}}" \
                      ,"geomGeoidColname":"{{geomGeoidColname}}" }\' \
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
              geoidColId: selectedBoundary.geoid_col_id,
              geomGeoidColname: selectedBoundary.geom_geoid_colname,
              geomTablename: selectedBoundary.geom_tablename
            })
              .done(function (rawdata) {
                var data = [];
                for (var i = 0; i < rawdata.rows.length; i += 1) {
                  var tag = rawdata.rows[i];
                  if (tag.measures) {
                    data.push(tag);
                  }
                }
                var items = [];
                $.each( data, function( key, val ) {
                  if (items.length === 0) {
                    items.push("<li><a class='is-selected' href='#' data-value='"+
                               key + "'>" + val.label + "</a></li>");
                  } else {
                    items.push( "<li><a href='#' data-value='" + key + "'>" +
                               val.label + "</a></li>" );
                  }
                });
                $('.box-nav').empty();
                $( "<ul/>", {
                  "class": "box-navNavigation",
                  html: items.join( "" )
                }).appendTo( ".box-nav" );
                subitemsMenu($( ".box-navNavigation a" ), data);
              })
              .done(function(rawdata){
                var data = [];
                for (var i = 0; i < rawdata.rows.length; i += 1) {
                  var tag = rawdata.rows[i];
                  if (tag.measures) {
                    data.push(tag);
                  }
                }
                $( ".box-navNavigation a" ).on("click", function() {
                  var txt = $(this).text();
                  $(".js-box-input").text(txt);
                  $(".box-navNavigation a").removeClass( "is-selected" );
                  $(this).toggleClass( "is-selected" );
                  subitemsMenu($(this), data);
                  clickSubitem();
                  scrollFunction();
                });
                clickSubitem();
                scrollFunction();
              });
          });
      };

      nativeMap.on('moveend', function(e) {
        updateMenu();
      });

      $( ".box-input" ).on( "click", function() {
        $(this).toggleClass( "is-open" );
        maxHeightList();
        $(".box-container").toggleClass( "is-hidden" );
      });
      updateMenu();
    });
});
