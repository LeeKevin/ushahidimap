#Ushahidi Map

A map of donor and government-funded projects in Kenya.

##Set-up

Copy the project folder onto your server and set public access to the `public/` folder.

You can use the following to download a copy:

```
git clone https://github.com/LeeKevin/ushahidimap.git
```

Run in terminal within the project root directory:
```
./build.sh
```

### But, I want to build my own page with this map!
Alternatively, if you want to just use this specific Ushahidi map-building code within your own web app (for some crazy reason), you can simply require the file `resources/assets/js/ushahidimap.js` using Browserify or RequireJS. 

The constructor for the map can be called using:

```
UshahidiMap.init(element, projects, counties)
```

`element` is the jQuery element within which you'd like to create the map,
`projects` is an Object created from the [Open Kenya project data JSON](https://www.opendata.go.ke/api/views/5mtp-qs2h/rows.json?accessType=DOWNLOAD), and
`counties` is an Object created from the [Kenya GeoJSON county boundaries data](https://github.com/mikelmaron/kenya-election-data/blob/master/data/counties.geojson)

You'll also need [jQuery](https://jquery.com/download/), [Leaflet](http://leafletjs.com/download.html), and [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster). Versions can be viewed in `package.json`.

##What this code does

The project JSON and county GeoJSON data are downloaded loaded in JS and are passed to the `UshahidiMap` namespace, along with the target jQuery element within which to render the Leaflet map. From there, an instance of `UshahidiMap.Map` is created for these parameters.

First, we search for and save the array locations of the desired column headers (like location, project title, etc.). As we loop through the each project's data, we merge the column header field names with the project values into an associative array (i.e. just another object in JS). Now we have an array of project objects, with each of its values nicely labeled for easy future access.

Example:
```javascript
[
    {
        'location2_secondary': {
            "human_address": null,
            "latitude": "-1.12603004099",
            "longitude": "35.82922720520",
            "machine_address": null,
            "needs_recoding": false
        },
        'project_title': 'Some title',
        'project_description': 'Description',
        'project_objectives': 'These are the objectives.',
        'county': 'MSAMBWENI'
    }
    ...
]
```

Now that's sorted, we move along and create the map markers. A marker cluster group is created (via our markercluster plugin). We loop through our parsed project data to create individual markers at the project coordinates and bind a popup containing other project data. We skip any projects that don't have complete coordinates.

Hey! Why are you looping through all the projects a second time? Isn't that inefficient? 

Maybe. But it makes it a lot easier to code, read, and manage. Given the number of projects that we have, the difference in performance is nearly negligible.

Next, we want to process the counties data object to create a new layer for the choropleth. We loop through the project again to count the number of projects belonging to each unique county. With this, we can shade in each county with a different color that corresponds to its project density. For good measure, we include a legend and an info box that will display the county name and information when the mouse hovers over a given county.

That's pretty much it.

## My approach

Because the project JSON data was formatted unintuitively, my first priority was to create a method to parse it into an intuitive object. With the goal to create working code for each step of the challenge, the `parseJsonForProjects` method was structured so I could easily add columns to retrieve. For example, I added the County and Project Total columns in the later steps.

I used a pseudo-classical pattern for `UshahidiMap.Map` because it's easy to manage and looks clean. I'm able to easily define private and public methods/variables for the "class" and easily build upon the code. 

## Misc

I heavily relied upon the Leaflet documentation. My first time using the library (or any for map data). It's really well done!

I spent a little over 6 hours on this project from start to finish.