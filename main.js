const { app, BrowserWindow, ipcMain } = require('electron');
const { shell } = require('electron');
const path = require('path');
const SpotifyWebApi = require('spotify-web-api-node');
const startAuthServer = require('./authServer');
const config = require('./config');

// Spotify API credentials from config
const spotifyApi = new SpotifyWebApi({
  clientId: config.clientId,
  clientSecret: config.clientSecret,
  redirectUri: config.redirectUri
});

let mainWindow;
let refreshTokenInterval;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 300,
    height: 300,
    minWidth: 100,
    minHeight: 100,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true, 
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.setAlwaysOnTop(true, 'floating');
  mainWindow.setVisibleOnAllWorkspaces(true);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Handle Spotify API requests with improved error handling
ipcMain.handle('spotify-api', async (event, action, value) => {
  try {
    switch (action) {
      case 'getCurrentTrack':
        return await spotifyApi.getMyCurrentPlayingTrack();
      case 'getMyCurrentPlaybackState':
        return await spotifyApi.getMyCurrentPlaybackState();
      case 'next':
        return await spotifyApi.skipToNext();
      case 'previous':
        return await spotifyApi.skipToPrevious();
      case 'pause':
        return await spotifyApi.pause();
      case 'play':
        return await spotifyApi.play();
      case 'toggleShuffle':
        const state = await spotifyApi.getMyCurrentPlaybackState();
        return await spotifyApi.setShuffle(!state.body.shuffle_state);
      case 'toggleRepeat':
        const repeatState = await spotifyApi.getMyCurrentPlaybackState();
        const newState = repeatState.body.repeat_state === 'off' ? 'track' : 'off';
        return await spotifyApi.setRepeat(newState);
      case 'seek':
        const track = await spotifyApi.getMyCurrentPlayingTrack();
        const position = Math.floor(value * track.body.item.duration_ms);
        return await spotifyApi.seek(position);
      case 'setVolume':
        return await spotifyApi.setVolume(parseInt(value));
      default:
        return { error: 'Unknown action' };
    }
  } catch (error) {
    console.error('Error in Spotify API request:', error);
    
    // More descriptive error handling
    if (error.statusCode === 401) {
      return { error: 'Authentication error. Please login again.', code: 401 };
    } else if (error.statusCode === 404) {
      return { error: 'No active Spotify device found. Please start Spotify on any device.', code: 404 };
    } else if (error.statusCode === 403) {
      return { error: 'Premium account required for this action.', code: 403 };
    } else {
      return { error: error.message || 'Unknown error occurred', code: error.statusCode };
    }
  }
});

// Handle authentication
ipcMain.handle('authenticate', async () => {
  const scopes = ['user-read-private', 'user-read-email', 'user-read-playback-state', 'user-modify-playback-state'];
  const authorizeURL = spotifyApi.createAuthorizeURL(scopes);
  startAuthServer(spotifyApi, mainWindow);
  shell.openExternal(authorizeURL);
});

// Set up protocol for handling callback
app.setAsDefaultProtocolClient('spotify-mini-player');

// Extract the function for handling the callback
function handleCallback(url) {
  if (!url) return;
  
  // Extract the code parameter from the URL
  const urlObj = new URL(url);
  const code = urlObj.searchParams.get('code');
  
  if (code) {
    spotifyApi.authorizationCodeGrant(code).then(
      function(data) {
        console.log('The token expires in ' + data.body['expires_in']);
        spotifyApi.setAccessToken(data.body['access_token']);
        spotifyApi.setRefreshToken(data.body['refresh_token']);
        mainWindow.webContents.send('authenticated');
        
        // Start token refresh interval
        startTokenRefreshInterval();
      },
      function(err) {
        console.error('Something went wrong with the callback:', err);
        mainWindow.webContents.send('auth-error', err.message);
      }
    );
  }
}

// Handle the callback from Spotify
app.on('open-url', async (event, url) => {
  event.preventDefault();
  handleCallback(url);
});

// Handle deep linking for when the app is already running
app.on('second-instance', (event, commandLine, workingDirectory) => {
  // Someone tried to run a second instance, focus our window instead
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    
    // Check if there's a URL in the arguments
    const url = commandLine.find(arg => arg.startsWith('spotify-mini-player://'));
    if (url) {
      handleCallback(url);
    }
  }
});

// If we're on macOS, we need to wait for the 'open-url' event which is fired when
// your app is opened with a URL
if (process.platform === 'darwin') {
  app.on('will-finish-launching', () => {
    app.on('open-url', (event, url) => {
      event.preventDefault();
      handleCallback(url);
    });
  });
}

// Token refresh function
function startTokenRefreshInterval() {
  if (refreshTokenInterval) {
    clearInterval(refreshTokenInterval);
  }
  
  // Refresh token every 50 minutes (3000000 ms)
  refreshTokenInterval = setInterval(async () => {
    try {
      const data = await spotifyApi.refreshAccessToken();
      spotifyApi.setAccessToken(data.body['access_token']);
      console.log('Access token has been refreshed');
    } catch (error) {
      console.error('Could not refresh access token', error);
      mainWindow.webContents.send('auth-error', 'Session expired. Please login again.');
    }
  }, 3000000);
}

// Handle window resizing
ipcMain.on('resize-window', (event, width, height) => {
  mainWindow.setSize(width, height);
});