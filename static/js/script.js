var map;
var showingClouds;
var showingWater;
var tileNEX;
var geocoder;
var overlays = [];

// const bounds = new google.maps.LatLngBounds(
//   new google.maps.LatLng(62.281819, -150.287132),
//   new google.maps.LatLng(62.400471, -150.005608)
// );
// // The photograph is courtesy of the U.S. Geological Survey.
// let image = "https://developers.google.com/maps/documentation/javascript/";
// image += "examples/full/images/talkeetna.png";


function initialize() {
    var mapOptions = {
        zoom: 11,
        center: new google.maps.LatLng(30.502872, -86.450075),
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        fullscreenControl: false
    };
    map = new google.maps.Map(document.getElementById('map_canvas'),
        mapOptions);
    geocoder = new google.maps.Geocoder()
    tileNEX = new google.maps.ImageMapType({
        getTileUrl: function(tile, zoom) {
            return "https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/" + zoom + "/" + tile.x + "/" + tile.y +".png?"+ (new Date()).getTime(); 
        },
        tileSize: new google.maps.Size(256, 256),
        opacity:0.60,
        name : 'NEXRAD',
        isPng: true
    });
    // Nice weather overlay
    map.overlayMapTypes.push(null); // create empty overlay entry
    // map.overlayMapTypes.setAt("0",tileNEX);
    showingClouds = false;
    showingWater = false;

    // Goes is the sucky overlay
    // var goes = new google.maps.ImageMapType({
    //     getTileUrl: function(tile, zoom) {
    //         return "https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/goes-east-vis-1km-900913/" + zoom + "/" + tile.x + "/" + tile.y +".png?"+ (new Date()).getTime(); 
    //     },
    //     tileSize: new google.maps.Size(256, 256),
    //     opacity:0.60,
    //     name : 'GOES East Vis',
    //     isPng: true
    // });
    // map.overlayMapTypes.push(null); // create empty overlay entry
    // map.overlayMapTypes.setAt("0",goes);
}

function toggleCloudOverlay() {
  if (showingClouds) {
      map.overlayMapTypes.removeAt(0);
      showingClouds = false
      document.getElementById("toggleCloud").innerText = "cloud_queue";
  } else {
      map.overlayMapTypes.setAt(0, tileNEX);
      showingClouds = true;
      document.getElementById("toggleCloud").innerText = "cloud_off";
  }
}

function toggleWaterOverlay(reset) {
  if (reset) {
    for (let i = 0; i < overlays.length; i++) {
      overlays[i].setMap(null);
    }
    overlays = []
    showingWater = false
    document.getElementById("toggleWater").innerText = "invert_colors";
  } else if (overlays.length>0) {
    for (let i = 0; i < overlays.length; i++) {
      overlays[i].toggle();
    }
  }
  if (showingWater) {
      if (overlays.length>0) {
        for (let i = 0; i < overlays.length; i++) {
          overlays[i].setMap(null);
        }
        overlays = []
      }
      showingWater = false
      document.getElementById("toggleWater").innerText = "invert_colors";
  } else {
      var latLng = map.getCenter();
      var lat = latLng.lat();
      var lng = latLng.lng();
      const latShift = (0.85/69.1)*2;
      const lngShift = (0.84/69.1)*2;
      for (let i = -1; i<2; i++) {
        for (let j = -1; j<2; j++) {
          getFloodMap(lat+latShift*i, lng+lngShift*j);
        }
      }
      // console.log("LAt, lng:" + lat + ", " +lng)
      // call neural network here to get the image. 
      map.setZoom(15);
      showingWater = true;
      document.getElementById("toggleWater").innerText = "invert_colors_off";
  }
}

function getFloodMap(lat, lng) {
  fetch("/getFloodMap?lat="+lat+"&lng="+lng).then(response => response.blob()).then(image => {
    var imageUrl = URL.createObjectURL(image);
    // document.getElementById("test").src = imageUrl
    var topLeft = new google.maps.LatLng(lat-(0.85/69.1), lng-(0.84/69.1))
    var bottomRight = new google.maps.LatLng(lat+(0.85/69.1), lng+(0.84/69.1))
    var bounds = new google.maps.LatLngBounds(topLeft, bottomRight);
    var overlay = new USGSOverlay(bounds, imageUrl);
    overlay.setMap(map);
    overlays.push(overlay);
  });
}

function setLatLng() {
    const address = document.getElementById("addressSearch").value;

    function getLatLng(results, status) {
      if (status == 'OK') {
        var lat = results[0].geometry.location.lat();
        var lng = results[0].geometry.location.lng();
        // createMarker(results[0].geometry.location);
        map.setCenter(results[0].geometry.location);
        console.log("Lat/Long:" + lat + ", " + lng);
        toggleWaterOverlay(true);
      } else {
        alert('Geocode was not successful for the following reason: ' + status);
      }
    }
    geocoder.geocode( {'address': address}, getLatLng);
    return false;
}

function createMarker(coordinate) {
    var marker = new google.maps.Marker({position: coordinate, map: map});
}


/**
 * The custom USGSOverlay object contains the USGS image,
 * the bounds of the image, and a reference to the map.
 */
class USGSOverlay extends google.maps.OverlayView {
  constructor(bounds, image) {
    super();
    this.bounds = bounds;
    this.image = image;
  }
  /**
   * onAdd is called when the map's panes are ready and the overlay has been
   * added to the map.
   */
  onAdd() {
    // console.log("am i being created?")
    this.div = document.createElement("div");
    this.div.style.borderStyle = "none";
    this.div.style.borderWidth = "0px";
    this.div.style.position = "absolute";
    // Create the img element and attach it to the div.
    const img = document.createElement("img");
    img.src = this.image;
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.position = "absolute";
    this.div.appendChild(img);
    // Add the element to the "overlayLayer" pane.
    const panes = this.getPanes();
    panes.overlayLayer.appendChild(this.div);
  }
  draw() {
    // We use the south-west and north-east
    // coordinates of the overlay to peg it to the correct position and size.
    // To do this, we need to retrieve the projection from the overlay.
    const overlayProjection = this.getProjection();
    // Retrieve the south-west and north-east coordinates of this overlay
    // in LatLngs and convert them to pixel coordinates.
    // We'll use these coordinates to resize the div.
    const sw = overlayProjection.fromLatLngToDivPixel(
      this.bounds.getSouthWest()
    );
    const ne = overlayProjection.fromLatLngToDivPixel(
      this.bounds.getNorthEast()
    );

    // Resize the image's div to fit the indicated dimensions.
    if (this.div) {
      this.div.style.left = sw.x + "px";
      this.div.style.top = ne.y + "px";
      this.div.style.width = ne.x - sw.x + "px";
      this.div.style.height = sw.y - ne.y + "px";
    }
  }
  // The onRemove() method will be called automatically from the API if
  // we ever set the overlay's map property to 'null'.
  onRemove() {
    if (this.div) {
      this.div.parentNode.removeChild(this.div);
      delete this.div;
    }
  }
  /**
   *  Set the visibility to 'hidden' or 'visible'.
   */
  hide() {
    if (this.div) {
      this.div.style.visibility = "hidden";
    }
  }
  show() {
    if (this.div) {
      this.div.style.visibility = "visible";
    }
  }
  toggle() {
    // console.log("I am here boi");
    if (this.div) {
      // console.log("It got here in this if case")
      if (this.div.style.visibility === "hidden") {
        this.show();
      } else {
        this.hide();
      }
    }
  }
  toggleDOM(map) {
    if (this.getMap()) {
      this.setMap(null);
    } else {
      this.setMap(map);
    }
  }
}


// Run when page loads:
google.maps.event.addDomListener(window, 'load', initialize);
document.addEventListener('DOMContentLoaded', function() {
    var elems = document.querySelectorAll('.fixed-action-btn');
    var instances = M.FloatingActionButton.init(elems, {
      direction: 'bottom',
      hoverEnabled: false
    });
    document.getElementById("toggleCloud").innerText = "cloud_queue";
    document.getElementById("toggleWater").innerText = "invert_colors";

    var elemsDrop = document.querySelectorAll('.dropdown-trigger');
    var instancesDrop = M.Dropdown.init(elemsDrop, {});

    var elemsOverlay = document.querySelectorAll('.tooltipped');
    var instancesOverlay = M.Tooltip.init(elemsOverlay, {position: 'left'});
    
});
$("#addressForm").submit(function(e) {
    e.preventDefault();
});