import express from 'express';
import cors from 'cors';
import {fromArrayBuffer} from 'geotiff';
import {PNG} from 'pngjs'
import fetch from 'node-fetch';
 
const app = express();

app.use(cors());

let port = 3110;

app.listen(port, () =>
  console.log(`listening on port ${port}`),
);

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
        let coverage = parseInt(req.params.z) < 14 ? 'ahn3_5m_dsm': 'ahn3_05m_dsm';
        let url = `https://geodata.nationaalgeoregister.nl/ahn3/wcs?service=WCS&REQUEST=GETCOVERAGE&version=1.0.0&COVERAGE=${coverage}&FORMAT=image%2Ftiff&CRS=EPSG%3A3857&BBOX=${bbox}&WIDTH=512&HEIGHT=512`;
    
        //const tiff = await fromUrl(url); // error server sent full file
        
        const response = await fetch(url);
        if (!response.ok) {
            res.status(500).json({error: 'fetch response not ok'});
            return;
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
                if (floatval > 10000) {
                    // no data
                    floatval = -7;
                }
                let idx = (y * width + x) * 4;
                let rgb = Math.round(10000 + (floatval) * 10);
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