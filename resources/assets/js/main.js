var $ = require('jquery');
var L = require('leaflet');

(function () {
    'use strict';

    L.Icon.Default.imagePath = '/images';

    var app = {
        run: function () {
            var map, _this = this;
            map = $('#ushahidimap').html('<span class="loading"></span>');

            //Pull project data
            $.getJSON('https://www.opendata.go.ke/api/views/5mtp-qs2h/rows.json?accessType=DOWNLOAD', function (data) {
                _this.initMap(map, data);
            });
        },
        initMap: function ($map, data) {
            var map_id, map;

            map_id = $map.empty().attr('id');
            if (!map_id) return; //if no id on the map element, quit.

            //Set up the map for Kenya
            map = L.map(map_id).setView([-1.2667, 36.8], 7);

            //Add Open Street Map map tile
            L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 18,
                attribution: '© OpenStreetMap'
            }).addTo(map);

            this.populateMarkers(map, this.parseJsonForProjects(data));
        },
        parseJsonForProjects: function (data) {
            var columns = data['meta']['view']['columns'],
                projectData = data['data'],
                columnHeaders, locationSubColumns,
                i, parsedData = [];

            //prepare the desired columns
            columnHeaders = {
                'location2_secondary': null,
                'project_title': null,
                'project_description': null,
                'project_objectives': null
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
                        columnFieldName == 'location2_secondary' && helpers.isArray(locationSubColumns) && locationSubColumns.length
                            ? helpers.arrayCombine(locationSubColumns, project[columnNumber])
                            : project[columnNumber];
                });
                parsedData.push(parsedProjectData);
            });

            return parsedData;
        },
        buildPopup: function (project) {
            return L.popup({
                className: 'map-popup',
                minWidth: 100
            }).setContent('<h4>' + (project['project_title'] ? project['project_title'] : 'Untitled Project') + '</h4>' +
                '<div class="scrollable-content">' +
                '<label>Description:</label>' + (project['project_description'] ? '<p>' + project['project_description'] + '</p>' : 'N/A') +
                '<label>Objectives:</label>' + (project['project_objectives'] ? '<p>' + project['project_objectives'] + '</p>' : 'N/A') +
                '</div>'
            );
        },
        populateMarkers: function (map, data) {
            var _this = this;
            $.each(data, function (i, project) {
                if (!project['location2_secondary']['latitude'] || !project['location2_secondary']['longitude']) return true;

                L.marker([project['location2_secondary']['latitude'], project['location2_secondary']['longitude']])
                    .bindPopup(_this.buildPopup(project))
                    .addTo(map);
            });
        }
    };

    var helpers = {
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
        }
    };

    $(document).ready(function () {
        app.run();
    });
})();