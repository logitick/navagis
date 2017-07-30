/* Map Class */
function Map() {
    // CEBU
    this.defaultLocation = {
        lat: 10.318667,
        lng: 123.906937
    };

    this.googleMap = new google.maps.Map(document.getElementById('map'), {
        zoom: 18,
        center: this.defaultLocation,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        styles: [{
            featureType: "poi",
            elementType: "labels",
            stylers: [{
                visibility: "off"
            }]
        }]
    });

    this.markers = Array();
}

Map.prototype.getZoom = function () {
    return this.googleMap.getZoom();
};

Map.prototype.getCenter = function () {
    return this.googleMap.getCenter();
};

Map.prototype.getBounds = function () {
    return this.googleMap.getBounds();
};

Map.prototype.addMarker = function (marker) {
    this.markers.push(marker);
    marker.gMarker.setMap(this.googleMap);
};

Map.prototype.clearMarkers = function () {
    this.markers.forEach(function (marker) {
        marker.gMarker.setMap(null);
    });
    this.markers = [];
};
/** END OF Map Class **/


function Marker(p) {
    this.id = p.place_id;

    this.place = p;
    this.markerConfig = {
        title: this.place.name,
        position: this.place.geometry.location,
        icon: {
            url: this.place.icon,
            scaledSize: new google.maps.Size(18, 18)
        }
    };

    this.gMarker = new google.maps.Marker(this.markerConfig);
};

/** PlacesProvider Class */

function PlacesProvider(map) {
    this.map = map;
    this.placesLib = new google.maps.places.PlacesService(map.googleMap);
    this.bindToMap();
}

PlacesProvider.prototype.getRequest = function () {
    return {
        bounds: this.map.getBounds(),
        type: 'restaurant',
        rankBy: google.maps.places.RankBy.PROMINENCE
    };
};

PlacesProvider.prototype.search = function () {
    this.placesLib.nearbySearch(this.getRequest(), this.onSearchResult);
};

PlacesProvider.prototype.searchWithinBounds = function (bounds, onResult) {
    var request = this.getRequest();
    request.bounds = bounds;
    this.placesLib.nearbySearch(request, onResult);
};

PlacesProvider.prototype.onSearchResult = function (results, status, pagination) {
    if (status == google.maps.places.PlacesServiceStatus.OK) {
        for (var i = 0; i < results.length; i++) {
            var place = results[i];
            var marker = new Marker(place);
            map.addMarker(marker);
        }

        if (pagination.hasNextPage) {
            pagination.nextPage();
        }
    }
};

PlacesProvider.prototype.bindToMap = function () {
    google.maps.event.addListener(this.map.googleMap, 'bounds_changed', function () {
        service.search();
    });
};
/** END PlacesProvider */

/** MapDrawer **/
function MapDrawer(map, activatorSelector, listSelector, placesProvider) {
    var instance = this;
    this.map = map;
    this.rectangle;
    this.activator = document.querySelector(activatorSelector);

    this.listElement = document.querySelector(listSelector);

    this.placesProvider = placesProvider;

    this.activator.addEventListener("click", function () {
        instance.bindToMap();
    });
}

MapDrawer.prototype.undraw = function () {
    // remove previous rectangle from map
    if (this.rectangle !== undefined) {
        this.rectangle.setMap(null);
    }
}

MapDrawer.prototype.clearList = function (place) {
    var template = document.querySelector("li.template").cloneNode(true);
    this.listElement.innerHTML = '';
    this.listElement.appendChild(template);
    document.querySelector('#restaurantsCount').innerHTML = '';
};

MapDrawer.prototype.addPlaceToList = function (place) {
    var template = document.querySelector("li.template").cloneNode(true);
    template.classList.remove('template');
    template.setAttribute('id', place.id);
    html = Mustache.render(template.innerHTML, place);
    template.innerHTML = html;
    this.listElement.appendChild(template);
};

MapDrawer.prototype.draw = function (shapeBounds) {
    this.undraw();

    this.rectangle = new google.maps.Rectangle({
        bounds: shapeBounds,
        editable: true,
        draggable: true
    });

    this.rectangle.setMap(map.googleMap);

    var instance = this;

    google.maps.event.addListener(this.rectangle, 'bounds_changed', function (event) {
        instance.clearList();
        var placesCount = 0;
        instance.placesProvider.searchWithinBounds(instance.rectangle.getBounds(), function (results, status, pagination) {

            if (status == google.maps.places.PlacesServiceStatus.OK) {

                placesCount += results.length;

                if (pagination.hasNextPage) {
                    pagination.nextPage();
                    document.querySelector('#restaurantsCount').innerHTML = 'loading..';
                } else {
                    document.querySelector('#restaurantsCount').innerHTML = placesCount;
                }

                for (var i = 0; i < results.length; i++) {
                    var place = results[i];
                    instance.addPlaceToList(place);
                }


            }
        });
    });

};

MapDrawer.prototype.bindToMap = function (e) {
    mapDrawer = this;
    google.maps.event.addListenerOnce(this.map.googleMap, 'click', function (event) {
        mapDrawer.draw(new google.maps.LatLngBounds(event.latLng, event.latLng));
    });
};

/** END MapDrawer **/