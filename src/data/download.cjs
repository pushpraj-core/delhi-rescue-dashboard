const fs = require('fs');
const https = require('https');

const url = 'https://raw.githubusercontent.com/datameet/Municipal_Spatial_Data/master/Mumbai/mumbai_wards.geojson';
const path = 'd:\\Projects_study\\DELHI_project\\src\\data\\mumbai_wards.json';

https.get(url, (res) => {
  const filePath = fs.createWriteStream(path);
  res.pipe(filePath);
  filePath.on('finish', () => {
    filePath.close();
    console.log('Download Completed');
  });
}).on('error', (err) => {
  console.log('Error: ', err.message);
});
