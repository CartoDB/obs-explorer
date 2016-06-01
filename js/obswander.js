var sublayer;

var maxHeightList = function(){
  var heightScreen = $(window).height();
  var heightNavigation = 86;
  var heightHeader = $('.box-header').height();
  var maxHeightScroll = (heightScreen) - (40 + heightNavigation + heightHeader) - 64;
  $('.box-resultList').css('max-height', maxHeightScroll);
};

$( document ).ready(function() {
  var selected_column = 'housing_units';
  var selected_agg_type = 'sum';
  var mapCenter = [37.804444, -122.270833];
  var circle = {
    size: 120,
    x: 200,
    y: 200
  };

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

  cartodb.createVis('map', 'http://localhost:8000/viz.json', {
    zoom: 11, center: mapCenter
  })
    .done(function(map,layers){
      sublayer = layers[1].getSubLayer(0);

      var nativeMap = map.getNativeMap();

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

      var data_table = 'obs_1a098da56badf5f32e336002b0a81708c40d29cd'
      var geom_table = 'obs_6c1309a64d8f3e6986061f4d1ca7b57743e75e74'
      var geom_geoid = 'geoid'
      var data_geoid = 'geoid'
      var sql = new cartodb.SQL({ user: 'observatory', 'https': true });

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

      //updateStats();

      /* read json */
      var subitemsMenu = function(e,f){
        var id = $(e).attr("data-value");
        var obj = f[id];
        var j = obj.filter_1;
        var subitems = [];
        $.each( j, function( k, val ) {
          if (val) {
            subitems.push( "<li><a href='#' data-agg='" + val.type +
                          "' data-col='" + val.data_col + "' data-value='" +
                          val.value + "'>" + val.label_1 + "</a></li>" );
          }
        });

        $( ".js-result-category" ).empty();
        $( ".box-result" ).empty();
        $( "<ul/>", {
          "class": "box-resultList js-result-category",
          html: subitems.join( "" )
        }).appendTo(".box-result");
        maxHeightList();
      };

      var clickSubitem = function(){
        $( ".js-result-category li a" ).on( "click", function() {
          $(".js-result-category li a").removeClass( "is-selected" );
          $(this).toggleClass( "is-selected" );
          $('.box-container').toggleClass( "is-hidden" );
          $(".js-box-selectTitle").text($(this).text());

          var column_name = $(this).attr('data-col');

          sublayer.setSQL('with stats as( select max('+column_name+'), min('+column_name+') \
                            from '+data_table+')\
            select data.cartodb_id, geom.the_geom_webmercator, \
                   (data.'+column_name+'-stats.min)/(stats.max-stats.min) as val \
            from stats, ' + data_table + ' data, ' + geom_table + ' geom \
            where data.' + data_geoid + ' = geom.' + geom_geoid);
          var css = sublayer.getCartoCSS();
          sublayer.setCartoCSS(css);

          selected_column    = $(this).attr('data-col');
          selected_agg_type  = $(this).attr('data-agg');
          //updateStats();
        });
      };
      var scrollFunction = function(){
        $(".js-result-category").niceScroll({
          cursorcolor: "#ccc", // change cursor color in hex
          cursorwidth: "4px"
        });
      };

      query = 'SELECT name as label, \
                     (SELECT JSON_AGG(( \
                       \'{"label_1":"\' || replace(name, \'"\', \'\\"\') || \
                       \'","value":"2000","type":"\' || aggregate || \
                       \'","data_col":"\' || ctable.colname || \
                       \'"}\' \
                       )::json) \
                       FROM obs_column c, obs_column_tag ctag, \
                            obs_column_table ctable, obs_table tab \
                       WHERE c.id = ctag.column_id \
                         AND ctag.tag_id = t.id \
                         AND c.id = ctable.column_id \
                         AND ctable.table_id = tab.id \
                         and c.aggregate ILIKE \'SUM\' \
                         AND tab.tablename = \'' + data_table + '\' \
                     ) AS filter_1 \
                     FROM obs_tag t \
                     WHERE type ILIKE \'subsection\' and id LIKE \'tags.%\' \
                     GROUP BY id, name'

      $.getJSON( 'http://observatory.cartodb.com/api/v2/sql', {
        q: query
      }, function( rawdata ) {
        var data = [];
        for (var i = 0; i < rawdata.rows.length; i += 1) {
            row = rawdata.rows[i];
            if (row.filter_1) {
                data.push(row);
            }
        }
        var items = [];
        $.each( data, function( key, val ) {
            if (items.length == 0) {
              items.push( "<li><a class='is-selected' href='#'  data-value='" + key + "'>" + val.label + "</a></li>" );
            } else {
              items.push( "<li><a href='#' data-value='" + key + "'>" + val.label + "</a></li>" );
            }
        });
        $( "<ul/>", {
          "class": "box-navNavigation",
          html: items.join( "" )
        }).appendTo( ".box-nav" );
        subitemsMenu($( ".box-navNavigation a" ), data);
      })
        .done(function(rawdata){
          var data = [];
          for (var i = 0; i < rawdata.rows.length; i += 1) {
              row = rawdata.rows[i];
              if (row.filter_1) {
                  data.push(row);
              }
          }
          $( ".box-navNavigation a" ).on( "click", function() {
            var txt = $(this).text();
            $(".js-box-input").text(txt);
            $(".box-navNavigation a").removeClass( "is-selected" );
            $(this).toggleClass( "is-selected" );
            subitemsMenu(this, data);
            clickSubitem();
            scrollFunction();
            $( ".box-icon svg" ).hide();
              var txtDown = $(this).text();
              txtDown = txtDown.toLowerCase();
              var dest = txtDown;
              dest = dest.split(" ").join("");
              if($( ".box-icon svg" ).hasClass(dest)) {
                $( ".box-icon svg."+dest ).show();
              }
          });
          clickSubitem();
          scrollFunction();
        })

      $( ".box-input" ).on( "click", function() {
        $(this).toggleClass( "is-open" );
        maxHeightList();
        $(".box-container").toggleClass( "is-hidden" );
      });
    })
});
