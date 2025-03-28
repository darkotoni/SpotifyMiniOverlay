// Save this as authServer.js in your project root

const http = require('http');
const url = require('url');

/**
 * Starts a local HTTP server to handle Spotify authentication callback
 * @param {Object} spotifyApi - The Spotify API instance
 * @param {Object} mainWindow - The Electron main window
 * @returns {Object} - The HTTP server instance
 */
function startAuthServer(spotifyApi, mainWindow) {
  // Create a server to handle the callback
  const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    
    if (parsedUrl.pathname === '/callback') {
      const code = parsedUrl.query.code;
      const state = parsedUrl.query.state;
      
      // Check for error
      if (parsedUrl.query.error) {
        console.error('Auth error:', parsedUrl.query.error);
        res.writeHead(400, {'Content-Type': 'text/html'});
        res.end(`
          <html>
            <head>
              <title>Authentication Failed</title>
              <style>
                body { 
                  font-family: Arial, sans-serif; 
                  text-align: center; 
                  padding-top: 50px;
                  background-color: #f5f5f5;
                }
                .container {
                  max-width: 600px;
                  margin: 0 auto;
                  background: white;
                  padding: 20px;
                  border-radius: 8px;
                  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                h1 { color: #e74c3c; }
                p { margin: 20px 0; }
                button {
                  background: #1DB954;
                  color: white;
                  border: none;
                  padding: 10px 20px;
                  border-radius: 20px;
                  cursor: pointer;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>Authentication Failed</h1>
                <p>Error: ${parsedUrl.query.error}</p>
                <p>Please try again.</p>
                <button onclick="window.close()">Close Window</button>
              </div>
            </body>
          </html>
        `);
        return;
      }
      
      // Exchange the code for access token
      spotifyApi.authorizationCodeGrant(code).then(
        function(data) {
          console.log('The token expires in ' + data.body['expires_in']);
          
          // Set the access and refresh tokens
          spotifyApi.setAccessToken(data.body['access_token']);
          spotifyApi.setRefreshToken(data.body['refresh_token']);
          
          // Notify the main window that authentication is complete
          mainWindow.webContents.send('authenticated');
          
          // Show success page
          res.writeHead(200, {'Content-Type': 'text/html'});
          res.end(`
            <html>
              <head>
                <title>Authentication Successful</title>
                <style>
                  body { 
                    font-family: Arial, sans-serif; 
                    text-align: center; 
                    padding-top: 50px;
                    background-color: #f5f5f5;
                  }
                  .container {
                    max-width: 600px;
                    margin: 0 auto;
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                  }
                  h1 { color: #1DB954; }
                  p { margin: 20px 0; }
                  button {
                    background: #1DB954;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 20px;
                    cursor: pointer;
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <h1>Authentication Successful!</h1>
                  <p>You can now return to the app.</p>
                  <button onclick="window.close()">Close Window</button>
                </div>
                <script>
                  // Close the window automatically after 3 seconds
                  setTimeout(() => window.close(), 3000);
                </script>
              </body>
            </html>
          `);
          
          // Close the server after handling the callback
          setTimeout(() => {
            try {
              server.close();
            } catch (e) {
              console.error('Error closing server:', e);
            }
          }, 1000);
        },
        function(err) {
          console.error('Something went wrong!', err);
          
          // Show error page
          res.writeHead(500, {'Content-Type': 'text/html'});
          res.end(`
            <html>
              <head>
                <title>Authentication Error</title>
                <style>
                  body { 
                    font-family: Arial, sans-serif; 
                    text-align: center; 
                    padding-top: 50px;
                    background-color: #f5f5f5;
                  }
                  .container {
                    max-width: 600px;
                    margin: 0 auto;
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                  }
                  h1 { color: #e74c3c; }
                  pre { 
                    text-align: left; 
                    background: #f8f8f8; 
                    padding: 10px; 
                    border-radius: 4px;
                    overflow: auto;
                  }
                  button {
                    background: #1DB954;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 20px;
                    cursor: pointer;
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <h1>Authentication Failed</h1>
                  <p>An error occurred during authentication.</p>
                  <pre>${err.toString()}</pre>
                  <button onclick="window.close()">Close Window</button>
                </div>
              </body>
            </html>
          `);
        }
      );
    } else {
      // Handle any other routes
      res.writeHead(404, {'Content-Type': 'text/plain'});
      res.end('Not Found');
    }
  });
  
  // Start the server
  server.listen(8888, () => {
    console.log('Authentication server listening on http://localhost:8888');
  });
  
  return server;
}

module.exports = startAuthServer;