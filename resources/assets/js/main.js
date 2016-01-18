var $ = require('jquery');
var UshahidiMap = require('ushahidimap');

(function () {
    'use strict';

    var app = {
        run: function () {
            var _this = this;
            var element = $('#ushahidimap').html('<span class="loading"></span>');

            //Pull project data
            $.getJSON('https://www.opendata.go.ke/api/views/5mtp-qs2h/rows.json?accessType=DOWNLOAD', function (data) {
                //Get counties data:
                $.getJSON('https://raw.githubusercontent.com/mikelmaron/kenya-election-data/master/data/counties.geojson', function (counties) {
                    _this.map = UshahidiMap.init(element, data, counties);
                });
            });
        }
    };

    $(document).ready(function () {
        app.run();
    });
})();