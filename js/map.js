/* Map Class */
function RestaurantMap() {
    // CEBU
    this.defaultLocation = {
        lat: 10.318667,
        lng: 123.906937
    };

    this.googleMap = new google.maps.Map(document.getElementById('map'), {
        zoom: 16,
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

    this.infoWindow = new google.maps.InfoWindow();
}

RestaurantMap.prototype.getZoom = function () {
    return this.googleMap.getZoom();
};

RestaurantMap.prototype.getCenter = function () {
    return this.googleMap.getCenter();
};

RestaurantMap.prototype.getBounds = function () {
    return this.googleMap.getBounds();
};

RestaurantMap.prototype.showMarkersMatchingFilters = function() {
	var keywords = filterListener.getFilters();
    this.markers.forEach(function (marker) {
		if (keywords.indexOf(marker.keyword) > -1) {
			marker.gMarker.setVisible(true);
		} else {
			marker.gMarker.setVisible(false);
		}
    });
}

RestaurantMap.prototype.addMarker = function (marker) {
    this.markers.push(marker);
    marker.gMarker.setMap(this.googleMap);
};

RestaurantMap.prototype.clearMarkers = function () {
    this.markers.forEach(function (marker) {
        marker.gMarker.setMap(null);
    });
    this.markers = [];
};

RestaurantMap.prototype.getDirections = function(from, to, onResult) {
    var directionsRequest = {
        destination:  {placeId: to},
        origin: from,
        travelMode: google.maps.TravelMode.DRIVING
    };

    var d = new google.maps.DirectionsService();
    d.route(directionsRequest, onResult);
};

RestaurantMap.prototype.showInfoWindow = function(content, marker) {
    this.infoWindow.setContent(content);
    this.infoWindow.open(this.googleMap, marker);
}

/** END OF Map Class **/


function Marker(p, map, customerCounter, keyword) {

    this.id = p.place_id;
	this.customerCounter = customerCounter;
	this.keyword = keyword;

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
    var instance = this;
    google.maps.event.addListener(this.gMarker, 'click', function(){

		p.visitors = customerCounter.getCustomerCount(p.place_id);

        var template = document.querySelector("li.template").cloneNode(true);
        template.classList.remove('template');
        template.setAttribute('id', this.id);

        html = Mustache.render(template.innerHTML, p);
        map.showInfoWindow(html, instance.gMarker);
    });

	// when a visitor is added
	this.customerCounter.addListener(function(placeId) {
		if (placeId === p.place_id) {
			new google.maps.event.trigger( instance.gMarker, 'click' );
		}
	});

};

/** PlacesProvider Class */

function PlacesProvider(map, customerCounter, filterListener) {
    this.map = map;
	this.customerCounter = customerCounter;
	this.filtersArray = filterListener.getFilters();;
	var instance = this;

	filterListener.onFilterChangeListener = function(f) {
		instance.setFilters(f);
	}

    this.placesLib = new google.maps.places.PlacesService(map.googleMap);
    this.bindToMap();
}

PlacesProvider.prototype.getRequest = function (filterKeyword) {
    return {
		bounds: this.map.getBounds(),
		keyword: filterKeyword,
        type: 'restaurant',
        rankBy: google.maps.places.RankBy.PROMINENCE
    };
};

PlacesProvider.prototype.setFilters = function(filtersArray) {
	this.filtersArray = filtersArray;
	this,map.clearMarkers();
	this.search();
	this.customerCounter.removeListeners();
};

PlacesProvider.prototype.search = function () {
	var instance = this;
	this.searchWithinBounds(this.map.getBounds(), this.onSearchResult);
};

PlacesProvider.prototype.searchWithinBounds = function (bounds, onResult) {
	var instance = this;
	this.filtersArray.forEach(function(keyword){
		var request = instance.getRequest(keyword);
		request.bounds = bounds;
    	instance.placesLib.nearbySearch(request, function(results, status, pagination){
			onResult(results, status, pagination, keyword);
		});

	});

};

PlacesProvider.prototype.onSearchResult = function (results, status, pagination, keyword) {
    if (status == google.maps.places.PlacesServiceStatus.OK) {

        for (var i = 0; i < results.length; i++) {
            var place = results[i];
            var marker = new Marker(place, this.map, this.customerTracker, keyword);
            map.addMarker(marker);
			map.showMarkersMatchingFilters();
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
    template.setAttribute('id', place.place_id);
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

function CustomerTracker(selector) {
	this.table = new Map();
	this.listeners = [];

	var instance = this;
    document.getElementById("page").addEventListener("click",function(e) {

      if (e.target && e.target.matches(selector + "> a > *")) {
        e.target.parentElement.click();
      }

      if (e.target && e.target.matches(selector + "> a")) {
		  var placeId = e.target.dataset.placeId;
		  instance.incrementCustomerCount(placeId);
      }
	});
}

CustomerTracker.prototype.addListener = function(listener) {
	this.listeners.push(listener);
}

CustomerTracker.prototype.removeListeners = function() {
	this.listeners = [];
}

CustomerTracker.prototype.incrementCustomerCount = function(placeId) {
	if (this.table.get(placeId) === undefined) {
		this.table.set(placeId, 0);
	}
	var counter = this.table.get(placeId);
	this.table.set(placeId, ++counter);
	this.listeners.forEach(function(listener, index) {
		listener(placeId);
	});
}

CustomerTracker.prototype.getCustomerCount = function (placeId) {
	if (this.table.get(placeId) === undefined) {
		this.table.set(placeId, 0);
	}
	return this.table.get(placeId);
}

function FilterListener (filterSelector) {
	this.filterSelector = filterSelector;
	this.filterFields = document.querySelectorAll(filterSelector);
	this.onFilterChangeListener;

	var instance = this;

	document.getElementById("page").addEventListener("click",function(e) {
		if (instance.onFilterChangeListener !== undefined) {
			if (e.target && e.target.matches(filterSelector)) {
				instance.onFilterChangeListener(instance.getFilters());
			}
		}
	});
}

FilterListener.prototype.getFilters = function() {
	var filters = [];
	this.filterFields.forEach(function(f){
		if (f.checked) {
			filters.push(f.value);
		}
	});
	return filters;
}
