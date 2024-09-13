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
    isPlaying = !isPlaying;
    await ipcRenderer.invoke('spotify-api', isPlaying ? 'play' : 'pause');
    updatePlayPauseButton();
});

document.getElementById('previous').addEventListener('click', () => {
    ipcRenderer.invoke('spotify-api', 'previous');
});

document.getElementById('next').addEventListener('click', () => {
    ipcRenderer.invoke('spotify-api', 'next');
});

document.getElementById('shuffle').addEventListener('click', () => {
    ipcRenderer.invoke('spotify-api', 'toggleShuffle');
});

document.getElementById('repeat').addEventListener('click', () => {
    ipcRenderer.invoke('spotify-api', 'toggleRepeat');
});

loginButton.addEventListener('click', () => {
    ipcRenderer.invoke('authenticate');
});

progressBar.parentElement.addEventListener('click', async (event) => {
    const rect = progressBar.parentElement.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    await ipcRenderer.invoke('spotify-api', 'seek', percent);
});

volumeControl.addEventListener('input', (event) => {
    ipcRenderer.invoke('spotify-api', 'setVolume', event.target.value);
});

function updatePlayPauseButton() {
    playPauseButton.textContent = isPlaying ? '⏸' : '▶';
}

async function updateCurrentTrack() {
    try {
        const response = await ipcRenderer.invoke('spotify-api', 'getCurrentTrack');
        if (response.body && response.body.item) {
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
    } catch (error) {
        console.error('Error updating current track:', error);
    }
}

function updateProgress(progress, duration) {
    const percent = (progress / duration) * 100;
    progressBar.style.width = `${percent}%`;
}

ipcRenderer.on('authenticated', () => {
    updateCurrentTrack();
    setInterval(updateCurrentTrack, 1000);
});

// Initial state
console.log('Setting initial state');
albumCover.style.display = 'block';
loginButton.style.display = 'block';

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