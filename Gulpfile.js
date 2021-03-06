var gulp = require('gulp');
var elixir = require('laravel-elixir');

var public_styles_folder = './public/css';
var public_scripts_folder = './public/js';

var style_file = public_styles_folder + '/app.css';
var script_file = public_scripts_folder + '/app.js';
var main_style = public_styles_folder + '/main.css'

elixir(function (mix) {

    mix.sass('main.scss', main_style)
        .styles([
            './node_modules/leaflet/dist/leaflet.css',
            './node_modules/leaflet.markercluster/dist/MarkerCluster.css',
            './node_modules/leaflet.markercluster/dist/MarkerCluster.Default.css',
            main_style,
        ], style_file)
        .browserify('main.js', script_file, null, {
            paths: ['./node_modules', './resources/assets/js'],
            cache: {},
            packageCache: {}
        })
        .version([style_file, script_file])
        .copy('./node_modules/font-awesome/fonts', './public/build/fonts')
        .copy('./node_modules/leaflet/dist/images', './public/images');
});
