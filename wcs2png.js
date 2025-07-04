import express from 'express';
import cors from 'cors';
import {fromArrayBuffer} from 'geotiff';
import {PNG} from 'pngjs'
import fetch from 'node-fetch';
 
const app = express();

app.use(cors());

const port = process.env.WCS2PNG_PORT || process.env.PORT || 3110;

app.listen(port, () =>
  console.log(`wcs2png listening on port ${port}`),
);

function epsg3857To4326(x, y) {
  const lon = (x / 20037508.34) * 180;
  
  let lat = (y / 20037508.34) * 180;
  lat = 180 / Math.PI * (2 * Math.atan(Math.exp(lat * Math.PI / 180)) - Math.PI / 2);
  
  return {
    lon: lon,
    lat: lat
  };
}

function tileToBbox(z, x, y) {
    let zp = 2 << z-1;
    let size = 40075016.6855784 / zp;
    let gx = (size * x) - (40075016.6855784/2);
    let gy = (40075016.6855784/2) - (size * y);
    return `${gx},${gy-size},${gx+size},${gy}`
}


app.get("/tile/:z/:x/:y", async (req, res)=>{
    try {
        let bbox = tileToBbox(parseInt(req.params.z), parseInt(req.params.x), parseInt(req.params.y));
        //let coverage = parseInt(req.params.z) < 14 ? 'ahn3_5m_dsm': 'ahn3_05m_dsm';
        //let coverage = parseInt(req.params.z) < 14 ? 'ahn3_5m_dtm': 'ahn3_05m_dtm';
        //let url = `https://service.pdok.nl/rws/ahn3/wcs/v1_0?service=WCS&REQUEST=GETCOVERAGE&version=1.0.0&COVERAGE=${coverage}&FORMAT=image%2Ftiff&CRS=EPSG%3A3857&BBOX=${bbox}&WIDTH=512&HEIGHT=512`

        const bounds = bbox.split(',').map(Number);
        if (bounds.length !== 4 || bounds.some(isNaN)) {
            res.status(400).json({error: 'Invalid bbox format'});
            return;
        }
        
        let coverage = 'dsm_05m';
        let url = `https://service.pdok.nl/rws/ahn/wcs/v1_0?service=WCS&REQUEST=GETCOVERAGE&version=1.0.0&COVERAGE=${coverage}&FORMAT=image%2Ftiff&CRS=EPSG%3A3857&BBOX=${bbox}&WIDTH=256&HEIGHT=256`;

        const {lon: minLon, lat: minLat} = epsg3857To4326(bounds[0], bounds[1]);
        const {lon: maxLon, lat: maxLat} = epsg3857To4326(bounds[2], bounds[3]);
        if (minLon < -62.8 && maxLon > -63.0 && minLat < 17.5 && maxLat > 17.4) {
            // St. Eustatius
            coverage = '4bcdf945-b148-41d6-a15f-ad0e2729ac4f';
            url = `https://api.ellipsis-drive.com/v3/ogc/wcs/c3773c58-2031-4ca1-a8aa-00a4c306e502?service=WCS&REQUEST=GETCOVERAGE&version=1.0.0&COVERAGE=${coverage}&FORMAT=geotiff&CRS=EPSG%3A3857&BBOX=${bbox}&WIDTH=256&HEIGHT=256`
        } else if (minLon < -63.1 && maxLon > -63.4 && minLat < 17.7 && maxLat > 17.5) {
            // Saba
            coverage = 'dc6de6b1-57a4-4c2c-a0f0-25adeaece2e0';
            url = `https://api.ellipsis-drive.com/v3/ogc/wcs/6b004937-0ce2-406e-b2a0-5f4792797a7f?service=WCS&REQUEST=GETCOVERAGE&version=1.0.0&COVERAGE=${coverage}&FORMAT=geotiff&CRS=EPSG%3A3857&BBOX=${bbox}&WIDTH=256&HEIGHT=256`
        } else if ( minLon < -67.7 && maxLon > -68.6 && minLat < 12.5 && maxLat > 11.8 ) { // Bonaire
            coverage = '147dab35-4919-48a1-8380-71d80bb195b1';
            url = `https://api.ellipsis-drive.com/v3/ogc/wcs/18f36a1e-ce05-4449-8fcc-2f74238e489b?service=WCS&REQUEST=GETCOVERAGE&version=1.0.0&COVERAGE=${coverage}&FORMAT=geotiff&CRS=EPSG%3A3857&BBOX=${bbox}&WIDTH=256&HEIGHT=256`;
        }
        
        const response = await fetch(url);
        if (!response.ok) {
            res.status(500).json({error: 'fetch response not ok'});
            return;
        }
        const contentType = response.headers.get('content-type');
        console.log(contentType);
        if (contentType && contentType.includes('xml')) {
            // return not found
            return res.status(404).end();
        }
        const arrayBuffer = await response.arrayBuffer();
        const tiff = await fromArrayBuffer(arrayBuffer);    
        
        const image = await tiff.getImage();
        const width = image.getWidth();
        const height = image.getHeight();
        
        const data = await image.readRasters();

        let png = new PNG({
            width: width,
            height: height,
            colorType: 2 // color, no alpha. Alpha is not used
        })

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let floatval = data[0][y * width + x];
                if (floatval > 10000 || floatval < -9998) {
                    // Both MAX_FLOAT4 and -9999 mean no data 
                    floatval = -7;
                }
                let idx = (y * width + x) * 4;
                let rgb = Math.round((10000 + floatval) * 10);
                png.data[idx] = (rgb >> 16) & 255; // red
                png.data[idx+1] = (rgb >> 8) & 255; // green
                png.data[idx+2] = (rgb) & 255; // blue
                png.data[idx+3] = 255; // alpha
            }
        }
        png.pack().pipe(res);
    } catch(err) {
        res.status(500).json({error: err.message});
    }  
})