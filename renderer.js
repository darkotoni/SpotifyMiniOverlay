const { ipcRenderer } = require('electron');

const container = document.getElementById('container');
const player = document.getElementById('player');
const albumCover = document.getElementById('album-cover');
const controls = document.getElementById('controls');
const playPauseButton = document.getElementById('play-pause');
const loginButton = document.getElementById('login-button');
const progressBar = document.getElementById('progress');
const volumeControl = document.getElementById('volume-control');

let isExpanded = false;
let isPlaying = false;
let currentTrackId = null;

console.log('Script loaded. Adding click event listener to album cover.');

// Create error message element
const errorMessageElement = document.createElement('div');
errorMessageElement.id = 'error-message';
errorMessageElement.style.cssText = `
  position: absolute;
  bottom: 5px;
  left: 5px;
  right: 5px;
  background-color: rgba(255, 0, 0, 0.7);
  color: white;
  padding: 5px;
  border-radius: 4px;
  font-size: 12px;
  text-align: center;
  display: none;
  z-index: 100;
`;
document.body.appendChild(errorMessageElement);

function showError(message, duration = 3000) {
  errorMessageElement.textContent = message;
  errorMessageElement.style.display = 'block';
  setTimeout(() => {
    errorMessageElement.style.display = 'none';
  }, duration);
}

// Function to update the volume indicator
function updateVolumeIndicator(value) {
    // Set the CSS variable to control the colored part of the slider
    volumeControl.style.setProperty('--volume-percent', `${value}%`);
}

albumCover.addEventListener('click', (event) => {
    console.log('Album cover clicked!');
    toggleExpansion();
});

function toggleExpansion() {
    isExpanded = !isExpanded;
    if (isExpanded) {
        controls.classList.add('expanded');
        ipcRenderer.send('resize-window', 350, 120); 
    } else {
        controls.classList.remove('expanded');
        ipcRenderer.send('resize-window', 100, 100); 
    }
}

playPauseButton.addEventListener('click', async () => {
    try {
        const response = await ipcRenderer.invoke('spotify-api', isPlaying ? 'pause' : 'play');
        if (response.error) {
            showError(response.error);
            return;
        }
        isPlaying = !isPlaying;
        updatePlayPauseButton();
    } catch (error) {
        console.error('Error with play/pause:', error);
        showError('Failed to control playback');
    }
});

document.getElementById('previous').addEventListener('click', async () => {
    try {
        const response = await ipcRenderer.invoke('spotify-api', 'previous');
        if (response.error) {
            showError(response.error);
        }
    } catch (error) {
        showError('Failed to skip to previous track');
    }
});

document.getElementById('next').addEventListener('click', async () => {
    try {
        const response = await ipcRenderer.invoke('spotify-api', 'next');
        if (response.error) {
            showError(response.error);
        }
    } catch (error) {
        showError('Failed to skip to next track');
    }
});

document.getElementById('shuffle').addEventListener('click', async () => {
    try {
        const response = await ipcRenderer.invoke('spotify-api', 'toggleShuffle');
        if (response.error) {
            showError(response.error);
        }
    } catch (error) {
        showError('Failed to toggle shuffle');
    }
});

document.getElementById('repeat').addEventListener('click', async () => {
    try {
        const response = await ipcRenderer.invoke('spotify-api', 'toggleRepeat');
        if (response.error) {
            showError(response.error);
        }
    } catch (error) {
        showError('Failed to toggle repeat');
    }
});

loginButton.addEventListener('click', () => {
    ipcRenderer.invoke('authenticate');
});

progressBar.parentElement.addEventListener('click', async (event) => {
    const rect = progressBar.parentElement.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    try {
        const response = await ipcRenderer.invoke('spotify-api', 'seek', percent);
        if (response.error) {
            showError(response.error);
        }
    } catch (error) {
        showError('Failed to seek');
    }
});

volumeControl.addEventListener('input', async (event) => {
    const volumeValue = event.target.value;
    
    // Update the visual indicator
    updateVolumeIndicator(volumeValue);
    
    try {
        const response = await ipcRenderer.invoke('spotify-api', 'setVolume', volumeValue);
        if (response.error) {
            showError(response.error);
        }
    } catch (error) {
        showError('Failed to change volume');
    }
});

function updatePlayPauseButton() {
    playPauseButton.textContent = isPlaying ? '⏸' : '▶';
}

// In your renderer.js file, modify the updateCurrentTrack function like this:

async function updateCurrentTrack() {
    try {
        const response = await ipcRenderer.invoke('spotify-api', 'getCurrentTrack');
        
        if (response.error) {
            if (response.code === 404) {
                showError('No active Spotify device found. Please start Spotify on any device.');
                return;
            } else if (response.code === 401) {
                showError('Authentication expired. Please login again.');
                loginButton.style.display = 'block';
                return;
            } else {
                showError(response.error);
                return;
            }
        }
        
        // This is the important change - check if response.body exists, 
        // regardless of whether item exists or not
        if (response.body) {
            // If there's an item, update the UI with track info
            if (response.body.item) {
                if (response.body.item.id !== currentTrackId) {
                    albumCover.src = response.body.item.album.images[0].url;
                    currentTrackId = response.body.item.id;
                }
                
                isPlaying = response.body.is_playing;
                updatePlayPauseButton();
                updateProgress(response.body.progress_ms, response.body.item.duration_ms);
                albumCover.style.display = 'block';
                loginButton.style.display = 'none';

                // Update track information
                document.getElementById('track-name').textContent = response.body.item.name;
                document.getElementById('artist-name').textContent = response.body.item.artists[0].name;
            } 
            // Don't show error for paused state with no item - this is normal behavior
            // Just keep showing the previous track info
            
            // Get and update the volume level from Spotify
            try {
                const playbackState = await ipcRenderer.invoke('spotify-api', 'getMyCurrentPlaybackState');
                if (playbackState.body && typeof playbackState.body.device.volume_percent === 'number') {
                    const spotifyVolume = playbackState.body.device.volume_percent;
                    volumeControl.value = spotifyVolume;
                    updateVolumeIndicator(spotifyVolume);
                }
            } catch (e) {
                // Silent fail for this extra feature
                console.log('Could not get volume from Spotify');
            }
        } else {
            // Only show this error if we have no body at all
            showError('Failed to get playback state from Spotify');
        }
    } catch (error) {
        console.error('Error updating current track:', error);
        showError('Failed to connect to Spotify');
    }
}
function updateProgress(progress, duration) {
    const percent = (progress / duration) * 100;
    progressBar.style.width = `${percent}%`;
}

ipcRenderer.on('authenticated', () => {
    showError('Successfully connected to Spotify!', 2000);
    updateCurrentTrack();
    setInterval(updateCurrentTrack, 1000);
});

ipcRenderer.on('auth-error', (event, message) => {
    showError(`Authentication error: ${message}`);
    loginButton.style.display = 'block';
});

// Initial state
console.log('Setting initial state');
albumCover.style.display = 'block';
loginButton.style.display = 'block';

// Set initial volume indicator
updateVolumeIndicator(volumeControl.value);

console.log('renderer.js fully loaded');

// Handle window resizing
window.addEventListener('resize', () => {
    const aspectRatio = 1; // Square aspect ratio
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    if (containerWidth / containerHeight > aspectRatio) {
        player.style.width = `${containerHeight * aspectRatio}px`;
        player.style.height = '100%';
    } else {
        player.style.width = '100%';
        player.style.height = `${containerWidth / aspectRatio}px`;
    }
});

// Trigger initial resize
window.dispatchEvent(new Event('resize'));