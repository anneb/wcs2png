import express from 'express';
import geotiff, {fromArrayBuffer, fromUrl} from 'geotiff';
import {PNG} from 'pngjs'
import fetch from 'node-fetch';
 
const app = express();
 
app.listen(3000, () =>
  console.log('Example app listening on port 3000!'),
);

app.get("/tile/:z/:x/:y", async (req, res)=>{
    let url = "https://geodata.nationaalgeoregister.nl/ahn3/wcs?service=WCS&REQUEST=GETCOVERAGE&version=1.0.0&COVERAGE=ahn3_5m_dsm&FORMAT=image%2Ftiff&CRS=EPSG%3A3857&BBOX=546677.6262955815,6865879.628687672,547900.6187481433,6867102.621140234&WIDTH=512&HEIGHT=512";
    try {
        //const tiff = await fromUrl(url); // error server sent full file
        const response = await fetch(url);
        if (!response.ok) {
            res.json({error: 'fetch response not ok'});
            return;
        }
        const arrayBuffer = await response.arrayBuffer();
        const tiff = await fromArrayBuffer(arrayBuffer);    
        
        const image = await tiff.getImage();
        const width = image.getWidth();
        const height = image.getHeight();
        const tileWidth = image.getTileWidth();
        const tileHeight = image.getTileHeight();
        const samplesPerPixel = image.getSamplesPerPixel();
    
        // when we are actually dealing with geo-data the following methods return
        // meaningful results:
        const origin = image.getOrigin();
        const resolution = image.getResolution();
        const bbox = image.getBoundingBox();

        const data = await image.readRasters();

        let png = new PNG({
            width: width,
            height: height,
            colorType: 2 // color, no alpha. Alpha is not used
        })

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let idx = (y * width + x) * 4;
                let rgb = Math.round(10000 + (data[0][y * width + x]) * 10);
                png.data[idx] = (rgb >> 16) & 255; // red
                png.data[idx+1] = (rgb >> 8) & 255; // green
                png.data[idx+2] = (rgb) & 255; // blue
                png.data[idx+3] = 255; // alpha
            }
        }
       png.pack().pipe(res);
        return;
        res.json({
            width: width, 
            height: height, 
            tileWidth: tileWidth, 
            tileHeight: tileHeight, 
            samplesPerPixel: samplesPerPixel,
            origin: origin,
            resolution: resolution,
            bbox: bbox,
            data: data
        });
    } catch(err) {
        res.json({error: err.message});
    }  
})