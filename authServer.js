const http = require('http');
const url = require('url');

function startAuthServer(spotifyApi, mainWindow) {
  const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    if (parsedUrl.pathname === '/callback') {
      const code = parsedUrl.query.code;
      spotifyApi.authorizationCodeGrant(code).then(
        function(data) {
          console.log('The token expires in ' + data.body['expires_in']);
          console.log('The access token is ' + data.body['access_token']);
          console.log('The refresh token is ' + data.body['refresh_token']);

          spotifyApi.setAccessToken(data.body['access_token']);
          spotifyApi.setRefreshToken(data.body['refresh_token']);

          mainWindow.webContents.send('authenticated');

          res.writeHead(200, {'Content-Type': 'text/html'});
          res.end('<h1>Authentication successful!</h1><p>You can close this window now.</p>');

          server.close();
        },
        function(err) {
          console.log('Something went wrong!', err);
          res.writeHead(500, {'Content-Type': 'text/html'});
          res.end('<h1>Authentication failed</h1><p>Error: ' + err + '</p>');
        }
      );
    }
  });

  server.listen(8888, () => {
    console.log('Listening on http://localhost:8888');
  });
}

module.exports = startAuthServer;