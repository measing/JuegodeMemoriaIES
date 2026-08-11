const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const root = __dirname;
const ports = [4173, 5173, 5174, 5175, 5176];
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.mp3': 'audio/mpeg'
};

function send(res, status, body, type = 'text/plain; charset=utf-8'){
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const cleanUrl = decodeURIComponent(req.url.split('?')[0]);
  const target = cleanUrl === '/' ? 'index.html' : cleanUrl.replace(/^\/+/, '');
  const file = path.resolve(root, target);

  if(!file.startsWith(root)){
    send(res, 403, 'Forbidden');
    return;
  }

  fs.readFile(file, (error, data) => {
    if(error){
      send(res, 404, 'Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
});

function openGame(url){
  if(process.env.MEMORABET_NO_OPEN === '1') return;
  exec(`start "" "${url}"`, () => {});
}

function listenOnAvailablePort(index = 0){
  const port = ports[index];
  if(!port){
    console.error('No se encontro un puerto libre para abrir MemoraBet.');
    return;
  }

  server.once('error', error => {
    if(error.code === 'EADDRINUSE'){
      console.log(`El puerto ${port} esta en uso. Probando otro...`);
      listenOnAvailablePort(index + 1);
    }else{
      console.error(error);
    }
  });

  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${port}/index.html`;
    console.log(`MemoraBet listo en ${url}`);
    openGame(url);
  });
}

listenOnAvailablePort();

server.on('listening', () => {
  console.log('Deja esta ventana abierta mientras juegas.');
});
