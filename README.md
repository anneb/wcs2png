# AHN WCS to Mapbox terrain

Service to transform the Dutch AHN digital surface model (DSM) WCS service to mapbox-gl compatible terrain DEM tiles

The Dutch AHN serves a DSM as a float32 geotiff raster through a Web Coverage Service (WCS). These rasters cannot be directly handled in mapbox-gl. Mapbox-gl has support for digital terrain models encoded as RGB in PNG images. This service translates the float32 raster values into mapbox compatible PNG RGB values.

## Prerequisites
* git
* node 14+

## Installation
```bash
git clone this_repository
cd this_repository
npm install
node wcs2png.js
```

## usage
Point your browser to http://localhost:3110/tile/13/4208/2691 for an example PNG mapbox-gl compatible terrain tile

The mapbox-gl layer definition looks like this:
```json
{
    "id": "ahnhillshading",
    "type": "hillshade",
    "source": {
        "id": "ahnhillshading",
        "type": "raster-dem",
        "tileSize": 512,
        "tiles": [
        "http://localhost:3110/tile/{z}/{x}/{y}"
        ],
        "maxzoom": 20,
        "bounds": [3.20009, 50.7167, 7.27283, 53.5571],
        "attribution": "AHN"
    },
    "paint": {
        "hillshade-exaggeration": 1
    }
}
```


