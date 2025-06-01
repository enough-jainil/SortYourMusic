# 🎵 Sort Your Music - Setup Guide

A web application that lets you sort your Spotify playlists by various musical attributes like tempo, energy, danceability, and more!

## 📋 Prerequisites

- Python 3.6 or higher
- A Spotify account
- A modern web browser

## 🚀 Quick Start

### Option 1: Using the Batch File (Windows)

1. Double-click `run.bat`
2. Your browser should automatically open to `http://localhost:8000`

### Option 2: Using the Shell Script (Mac/Linux)

```bash
./run.sh
```

### Option 3: Manual Start

```bash
python run_server.py
```

Then open your browser to: `http://localhost:8000`

## 🎯 How to Use

1. **Start the Server**: Use one of the methods above
2. **Open in Browser**: Navigate to `http://localhost:8000`
3. **Login with Spotify**: Click "Login with Spotify" and authorize the app
4. **Pick a Playlist**: Choose one of your Spotify playlists
5. **Sort**: Click on any column header to sort by that attribute:
   - **BPM**: Beats per minute (tempo)
   - **Energy**: How energetic the song feels
   - **Danceability**: How suitable for dancing
   - **Loudness**: Volume level
   - **Valence**: Musical positivity/happiness
   - **Length**: Song duration
   - **Acoustic**: How acoustic vs electric
   - **Popularity**: How popular on Spotify
   - **A.Sep**: Artist separation (distributes artists evenly)
   - **Rnd**: Random (for shuffling)
6. **Filter**: Use the BPM filter controls to narrow down results
7. **Save**: Click "Save New Playlist" to create a sorted copy

## 🔧 Features

- ✅ Sort by multiple musical attributes
- ✅ Filter by BPM range
- ✅ Preview tracks (30-second clips)
- ✅ Create new sorted playlists or overwrite existing ones
- ✅ Artist separation algorithm for better playlist flow
- ✅ No server required - runs entirely in your browser

## 🛠️ Technical Details

- **Frontend**: Pure HTML/CSS/JavaScript with jQuery and Bootstrap
- **API**: Spotify Web API
- **Authentication**: OAuth 2.0 with Spotify
- **Data**: Uses Spotify's audio feature analysis

## 🔐 Privacy & Security

- The app only requests permission to read and modify your playlists
- No data is stored on any server - everything runs locally
- Your Spotify credentials are handled directly by Spotify's secure OAuth system

## 🐛 Troubleshooting

### Port Already in Use

If you get an error about port 8000 being in use:

1. Close any other applications using port 8000
2. Or modify `PORT = 8000` in `run_server.py` to use a different port
3. Update the redirect URI in `web/config.js` accordingly

### Authorization Issues

If Spotify login fails:

1. Make sure you're accessing exactly `http://localhost:8000` (not 127.0.0.1)
2. Check that the port matches what's configured in `web/config.js`

### Playlist Not Loading

1. Try refreshing the page
2. Make sure your playlist isn't empty
3. Check browser console for any errors

## 🌐 Online Version

This app is also available online at: http://sortyourmusic.playlistmachinery.com/

## 📄 License

Open source - see the original GitHub repository for details.

---

Enjoy sorting your music! 🎶
