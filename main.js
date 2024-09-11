const { app, BrowserWindow, ipcMain } = require('electron');
const { shell } = require('electron');
const path = require('path');
const SpotifyWebApi = require('spotify-web-api-node');
const startAuthServer = require('./authServer')

// Spotify API credentials
const spotifyApi = new SpotifyWebApi({
  clientId: '36a5b18c854343eea8304d945b271249',
  clientSecret: 'f53fdad81df64e8bb4ac926ce35c35b3',
  redirectUri: 'http://localhost:8888/callback'
});

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 300,
    height: 300,
    minWidth: 100,
    minHeight: 100,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true, // Allow resizing
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

// Handle Spotify API requests
ipcMain.handle('spotify-api', async (event, action, value) => {
  try {
    switch (action) {
      case 'getCurrentTrack':
        return await spotifyApi.getMyCurrentPlayingTrack();
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
    }
  } catch (error) {
    console.error('Error in Spotify API request:', error);
    return { error: error.message };
  }
});

// Handle authentication
ipcMain.handle('authenticate', async () => {
  const scopes = ['user-read-private', 'user-read-email', 'user-read-playback-state', 'user-modify-playback-state'];
  const authorizeURL = spotifyApi.createAuthorizeURL(scopes);
  startAuthServer(spotifyApi, mainWindow);
  shell.openExternal(authorizeURL);
});

// Handle the callback from Spotify
app.on('open-url', async (event, url) => {
  const code = new URL(url).searchParams.get('code');
  try {
    const data = await spotifyApi.authorizationCodeGrant(code);
    spotifyApi.setAccessToken(data.body['access_token']);
    spotifyApi.setRefreshToken(data.body['refresh_token']);
    mainWindow.webContents.send('authenticated');
  } catch (error) {
    console.error('Error during authentication:', error);
  }
  // Set up protocol for handling callback
app.setAsDefaultProtocolClient('spotify-mini-player');

// Handle deep linking
app.on('second-instance', (event, commandLine, workingDirectory) => {
  const url = commandLine.pop();
  handleCallback(url);
});
// Set up token refresh
let refreshTokenInterval;

function startTokenRefreshInterval() {
  // Refresh token every 50 minutes (3000000 ms)
  refreshTokenInterval = setInterval(async () => {
    try {
      const data = await spotifyApi.refreshAccessToken();
      spotifyApi.setAccessToken(data.body['access_token']);
      console.log('Access token has been refreshed');
    } catch (error) {
      console.error('Could not refresh access token', error);
    }
  }, 3000000);
}

// Start the token refresh interval after successful authentication
ipcMain.on('authentication-successful', () => {
  startTokenRefreshInterval();
});
});

ipcMain.on('resize-window', (event, width, height) => {
    mainWindow.setSize(width, height);
});