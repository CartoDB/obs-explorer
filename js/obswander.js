/*jshint multistr: true, browser: true*/
/*globals $, cartodb*/
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
  var findMeasures;
  var measureSql ='';
  var mapCenter = [37.804444, -122.270833];
  //var circle = {
  //  size: 120,
  //  x: 200,
  //  y: 200
  //};

  //var canvas = document.getElementById('cover');
  //ctx = canvas.getContext('2d');

  //canvas.height = $(window).height();
  //canvas.width = $(window).width();
  //circle.y = canvas.height / 2;
  //circle.x = canvas.width / 2;

  //ctx.fillStyle = "rgba(255,0,0,0)";
  //ctx.fillRect(0, 0, canvas.width, canvas.height);
  //var mask = document.createElement('canvas');
  //mask.width = canvas.width;
  //mask.height = canvas.height;
  //var maskCtx = mask.getContext('2d');
  //maskCtx.fillStyle = "rgba(0,0,0,0.6)";
  //maskCtx.fillRect(0, 0, mask.width, mask.height);
  //maskCtx.globalCompositeOperation = 'destination-out';
  //maskCtx.arc(circle.x, circle.y, circle.size, 0, 2*Math.PI);
  //maskCtx.fill();
  //ctx.drawImage(mask,0,0);

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

      //var circle = L.circle(mapCenter, 7200,{
      //  fillColor: 'red',
      //  fillOpacity: 0,
      //  stroke: false,
      //  weight: 14,
      //  clickable: false
      //}).addTo(nativeMap);

      //nativeMap.on('moveend', function(e){
      //  circle.setLatLng(e.target.getCenter());
      //  updateStats();
      //});

      //var updateStats= function(){
      //  column_name = selected_column
      //  // bounds = nativeMap.getBounds()

      //  if (selected_agg_type=='sum'){
      //    query = "SELECT sum(data.{{column_name}}) AS total_value, \
      //                sum( CASE WHEN geom.the_geom && ST_Transform(ST_Buffer(ST_Transform(CDB_LatLng({{center}}),3857),{{radius}}),4326) THEN data.{{column_name}} ELSE 0 END )  AS value\
      //                FROM {{data_table}} data, {{geom_table}} geom \
      //                WHERE data.{{data_geoid}} = geom.{{geom_geoid}}"
      //  }
      //  else if (selected_agg_type=='avg'){
      //    query = "with avg_total as(\
      //              select avg({{column_name}}) as total from {{data_table}} \
      //            )\
      //            SELECT avg(data.{{column_name}}) AS value, \
      //                avg_total.total as total_value \
      //                FROM {{data_table}} data, {{geom_table}} geom avg_total \
      //                where \
      //              data.{{data_geoid}} = geom.{{geom_geoid}} \
      //              geom.the_geom && ST_Transform(ST_Buffer(ST_Transform(CDB_LatLng({{center}}),3857),{{radius}}),4326) \
      //              group by avg_total.total"
      //  }
      //  sql.execute(query, {
      //    column_name: column_name,
      //    data_table: data_table,
      //    geom_table: geom_table,
      //    data_geoid: data_geoid,
      //    geom_geoid: geom_geoid,
      //    agg_type: selected_agg_type,
      //    center: [circle.getLatLng().lat, circle.getLatLng().lng].join(','),
      //    radius: circle.getRadius()
      //  })
      //    .done(function(data) {
      //      $(".js-figure").text(Math.floor(data.rows[0].value));
      //  })
      //}
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
            var availableGeoms = rawdata.rows;
            var bestGeom = availableGeoms[0];
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
              geoidColId: bestGeom.geoid_col_id,
              geomGeoidColname: bestGeom.geom_geoid_colname,
              geomTablename: bestGeom.geom_tablename
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
