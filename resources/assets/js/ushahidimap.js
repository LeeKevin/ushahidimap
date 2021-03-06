var $ = require('jquery');
var L = require('leaflet');
require('leaflet.markercluster');
L.Icon.Default.imagePath = '/images';

(function (window, $, L) {
    var UshahidiMap = {
        init: function (element, projectData, countyData) {
            return new UshahidiMap.Map(element, projectData, countyData);
        }
    };

    UshahidiMap.Map = (function ($, L) {
        var DEFAULT_CHOROPLETH = 'PROJECTS_COUNT';
        var grades = {
            PROJECTS_COUNT: {
                title: 'Number of projects',
                values: [0, 10, 20, 50, 100],
                colors: [
                    "#ffffcc",
                    "#c2e699",
                    "#78c679",
                    "#31a354",
                    "#006837"
                ]
            },
            PROJECT_COST: {
                title: 'Average project cost',
                values: [0, 500000000, 1000000000, 2000000000, 5000000000],
                colors: [
                    "#ffffcc",
                    "#c2e699",
                    "#78c679",
                    "#31a354",
                    "#006837"
                ]
            }
        };

        function Map(element, projectData, countyData) {
            var map_id, map;

            map_id = element.empty().attr('id');
            if (!map_id) return; //if no id on the map element, quit.

            //Set up the map for Kenya
            map = L.map(map_id).setView([-1.2667, 36.8], 7);

            //Add Open Street Map map tile
            L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 18,
                attribution: '© OpenStreetMap'
            }).addTo(map);

            this.map = map;
            this.projects = parseJsonForProjects(projectData);
            populateMarkers.call(this);
            defineCounties.call(this, countyData);

            return this;
        }

        function parseJsonForProjects(data) {
            var columns = data['meta']['view']['columns'],
                projectData = data['data'],
                columnHeaders, locationSubColumns,
                i, parsedData = [];

            //prepare the desired columns
            columnHeaders = {
                'location2_secondary': null,
                'project_title': null,
                'project_description': null,
                'project_objectives': null,
                'county': null,
                'total_project_cost_kes': null
            };

            //Find the position of the desired columns
            for (i = 0; i < columns.length; i++) {
                if (columnHeaders.hasOwnProperty(columns[i]['fieldName'])) {
                    columnHeaders[columns[i]['fieldName']] = i;
                    if (columns[i]['fieldName'] == 'location2_secondary' && 'subColumnTypes' in columns[i]) {
                        locationSubColumns = columns[i]['subColumnTypes']; //get the array of subcolumns for location
                    }
                }
            }

            //parse the json for the desired data, using the columns above
            $.each(projectData, function (j, project) {
                var parsedProjectData = {};
                $.each(columnHeaders, function (columnFieldName, columnNumber) {
                    if (!columnNumber) {
                        delete columnHeaders['columnFieldName'];
                        return true;
                    }
                    //for location, merge the array with the array of subcolumn headers
                    parsedProjectData[columnFieldName] =
                        columnFieldName == 'location2_secondary' && UshahidiMap.Util.isArray(locationSubColumns) && locationSubColumns.length
                            ? UshahidiMap.Util.arrayCombine(locationSubColumns, project[columnNumber])
                            : project[columnNumber];
                });
                parsedData.push(parsedProjectData);
            });

            return parsedData;
        }

        function populateMarkers() {
            var _this = this;

            var markers = L.markerClusterGroup({
                showCoverageOnHover: false
            });
            $.each(_this.projects, function (i, project) {
                if (!project['location2_secondary']['latitude'] || !project['location2_secondary']['longitude']) return true;

                markers.addLayer(L.marker([project['location2_secondary']['latitude'], project['location2_secondary']['longitude']])
                    .bindPopup(_this.buildProjectPopup(project)));

            });
            _this.map.addLayer(markers);
        }

        function defineCounties(data) {
            var _this = this, countyDensities = {};

            //clear any existing geojson layer
            if (_this.geojson) _this.map.removeLayer(_this.geojson);

            //calculate county density
            $.each(_this.projects, function (i, project) {
                if (!project['county'] || !project['location2_secondary']['latitude'] || !project['location2_secondary']['longitude']) return true;

                //check if county name exists in our object and increment the property
                if (!countyDensities.hasOwnProperty(project['county'])) countyDensities[project['county']] = {};
                countyDensities[project['county']]['PROJECTS_COUNT'] = (
                        UshahidiMap.Util.isNumeric(countyDensities[project['county']]['PROJECTS_COUNT'])
                            ? countyDensities[project['county']]['PROJECTS_COUNT'] : 0
                    ) + 1;

                if (!countyDensities[project['county']].hasOwnProperty('PROJECT_COST')) countyDensities[project['county']]['PROJECT_COST'] = {};
                //sum of all total for a county
                countyDensities[project['county']]['PROJECT_COST']['total'] = (
                        UshahidiMap.Util.isNumeric(countyDensities[project['county']]['PROJECT_COST']['total'])
                            ? countyDensities[project['county']]['PROJECT_COST']['total'] : 0
                    ) + (UshahidiMap.Util.isNumeric(project['total_project_cost_kes']) ? parseInt(project['total_project_cost_kes']) : 0);

                //count of projects with reported project costs (we'll ignore the other ones)
                countyDensities[project['county']]['PROJECT_COST']['count'] = (
                        UshahidiMap.Util.isNumeric(countyDensities[project['county']]['PROJECT_COST']['count'])
                            ? countyDensities[project['county']]['PROJECT_COST']['count'] : 0
                    ) + (UshahidiMap.Util.isNumeric(project['total_project_cost_kes']) ? 1 : 0);
            });

            //build the county boundaries layer
            _this.geojson = L.geoJson(data, {
                onEachFeature: function (feature, layer) {
                    layer.on({
                        mouseover: function (e) {
                            _this.highlightLayer(e.target);
                        },
                        mouseout: function (e) {
                            _this.resetLayerStyle(e.target);
                        },
                        click: function (e) {
                            _this.zoomToLayer(e.target);
                        }
                    });
                }
            }).addTo(_this.map);

            _this.countyDensities = countyDensities;

            //build toggle
            buildToggle.call(_this).addTo(_this.map);
            _this.toggleChoropleth(_this.type = DEFAULT_CHOROPLETH);
            //build the info box
            _this.infobox = buildInfoBox().addTo(_this.map);
        }

        function buildToggle() {
            var _this = this;
            var toggle = L.control({position: 'topleft'});

            toggle.onAdd = function () {
                var toggleElement = $(L.DomUtil.create('div', 'toggle info'));

                $.each(grades, function (type, data) {
                    var radioButton = $('<input type="radio" name="choropleth" data-type="'
                        + type + '" id="' + type.toLowerCase() + '" ' +
                        (type == 'PROJECTS_COUNT' ? 'checked' : '')
                        + ' />');
                    toggleElement
                        .append(radioButton)
                        .append('<label for="' + type.toLowerCase() + '">' + data['title'] + '</label>');
                    radioButton.bind('click', function () {
                        _this.toggleChoropleth(_this.type = $(this).attr('data-type'));
                    });
                });

                return toggleElement[0];
            };

            return toggle;
        }

        function buildLegend(type) {
            var legend = L.control({position: 'bottomright'});

            legend.onAdd = function () {
                var div = L.DomUtil.create('div', 'legend');

                div.innerHTML = '<h4>' + grades[type].title + '</h4>';
                // loop through our density intervals and generate a label with a colored square for each interval
                for (var i = 0; i < grades[type].values.length; i++) {
                    div.innerHTML +=
                        '<i style="background:' + grades[type].colors[i] + '"></i> ' +
                        '<span class="legend-digit">' +
                        UshahidiMap.Util.largeNumber(grades[type].values[i]) + (grades[type].values[i + 1] ? '' : '+') +
                        '</span>' +
                        (grades[type].values[i + 1] ? '&ndash;' + '<span class="legend-digit">' + UshahidiMap.Util.largeNumber(grades[type].values[i + 1]) + '</span>' + '<br />' : '');
                }

                return div;
            };

            return legend;
        }

        function buildInfoBox() {
            var infobox = L.control();

            infobox.onAdd = function () {
                this._div = L.DomUtil.create('div', 'info');
                this.resetContent();
                return this._div;
            };

            infobox.resetContent = function () {
                this._div.innerHTML = '<h4>' + 'County Information' + '</h4>' + 'Hover over a county';

            };

            infobox.update = function (countyName, data) {
                this._div.innerHTML = '<h4>' + UshahidiMap.Util.toTitleCase(countyName) + '</h4>' +
                    '<label>Number of projects:</label> ' + data['PROJECTS_COUNT'] + '<br />' +
                    '<label>Projects with reported cost:</label> ' + data['PROJECT_COST']['count'] + '<br />' +
                    '<label>Total cost:</label> $' + UshahidiMap.Util.numberWithCommas(data['PROJECT_COST']['total'])
                ;
            };

            return infobox;
        }

        function getCountyColor(density, type) {
            var fillColor = "#ffffff";
            if (!grades.hasOwnProperty(type) || !UshahidiMap.Util.isNumeric(density)) return fillColor;

            for (var i = 0; i < grades[type].values.length; i++) {
                if (density > grades[type].values[i]) fillColor = grades[type].colors[i];
            }

            return fillColor;
        }

        Map.prototype.toggleChoropleth = function (type) {
            if (this.legend) this.map.removeControl(this.legend);

            //build the corresponding legend
            this.legend = buildLegend(type).addTo(this.map);
            this.setCountyLayerStyle(type);
        };

        Map.prototype.buildProjectPopup = function (project) {
            return L.popup({
                className: 'map-popup',
                minWidth: 100
            }).setContent('<h4>' + (project['project_title'] ? project['project_title'] : 'Untitled Project') + '</h4>' +
                '<div class="scrollable-content">' +
                '<label>Description:</label>' + (project['project_description'] ? '<p>' + project['project_description'] + '</p>' : 'N/A') +
                '<label>Objectives:</label>' + (project['project_objectives'] ? '<p>' + project['project_objectives'] + '</p>' : 'N/A') +
                '<label>Total Cost:</label>' + (UshahidiMap.Util.isNumeric(project['total_project_cost_kes']) ? '<p>$' + UshahidiMap.Util.numberWithCommas(project['total_project_cost_kes']) + '</p>' : 'N/A') +
                '</div>'
            );
        };

        Map.prototype.highlightLayer = function (layer) {
            layer.setStyle({
                weight: 4,
                color: '#666',
                dashArray: '',
                fillOpacity: .75
            });

            if (!L.Browser.ie && !L.Browser.opera) {
                layer.bringToFront();
            }

            this.infobox.update(layer.feature.properties['COUNTY_NAM'], this.countyDensities.hasOwnProperty(layer.feature.properties['COUNTY_NAM'])
                ? this.countyDensities[layer.feature.properties['COUNTY_NAM']]
                : null);
        };

        Map.prototype.resetLayerStyle = function (layer) {
            layer.setStyle(this.generateCountyStyle(layer.feature, this.type));
            this.infobox.resetContent();
        };

        Map.prototype.zoomToLayer = function (layer) {
            this.map.fitBounds(layer.getBounds());
        };

        Map.prototype.setCountyLayerStyle = function (type) {
            if (Object.keys(grades).indexOf(type) == -1) return;
            var _this = this;

            _this.geojson.setStyle(function (feature) {
                return _this.generateCountyStyle(feature, type);
            });
        };

        Map.prototype.generateCountyStyle = function (feature, type) {
            var _this = this;

            var densityValue = 0;
            if (_this.countyDensities.hasOwnProperty(feature.properties['COUNTY_NAM'])) {
                if (type == 'PROJECTS_COUNT') {
                    densityValue = _this.countyDensities[feature.properties['COUNTY_NAM']]['PROJECTS_COUNT'];
                } else if (type == 'PROJECT_COST') {
                    var total = _this.countyDensities[feature.properties['COUNTY_NAM']]['PROJECT_COST']['total'];
                    var count = _this.countyDensities[feature.properties['COUNTY_NAM']]['PROJECT_COST']['count'];
                    densityValue =
                        parseFloat(total / count);
                }
            }

            return {
                color: "#fff",
                dashArray: '3',
                weight: 2,
                fillOpacity: .75,
                fillColor: getCountyColor(densityValue, type)
            };
        };

        return Map;
    })($, L);
    UshahidiMap.Util = {
        arrayCombine: function (keys, values) {
            if (!this.isArray(keys) || !this.isArray(values)) return false;

            var obj = {};
            for (var i = 0; i < keys.length; i++) {
                obj[keys[i]] = values[i];
            }

            return obj;
        },
        isArray: function (obj) {
            return Object.prototype.toString.call(obj) === '[object Array]';
        },
        isNumeric: function (num) {
            return !isNaN(parseFloat(num)) && isFinite(num);
        },
        toTitleCase: function (str) {
            return str.replace(/\w\S*/g, function (txt) {
                return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
            });
        },
        numberWithCommas: function (num) {
            return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        },
        largeNumber: function (num) {
            // Nine Zeroes for Billions
            return Math.abs(Number(num)) >= 1.0e+9
                ? Math.abs(Number(num)) / 1.0e+9 + "B"
                : Math.abs(Number(num)) >= 1.0e+6
                ? Math.abs(Number(num)) / 1.0e+6 + "M"
                : Math.abs(Number(num)) >= 1.0e+3
                ? Math.abs(Number(num)) / 1.0e+3 + "K"
                : Math.abs(Number(num));

        }
    };

    if (typeof module === 'object' && typeof module.exports === 'object') {
        module.exports = UshahidiMap;
    }
    window.UshahidiMap = UshahidiMap;
})(window, $, L);

