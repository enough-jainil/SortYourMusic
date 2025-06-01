// ================================
// SORT YOUR MUSIC - MAIN SCRIPT
// ================================

"use strict";

// Global Variables
var accessToken = null;
var curUserID = null;
var curPlaylist = null;
var albumDates = {};
var audio = $("<audio>");
var songTable;
var cols = [
  "order",
  "title",
  "artist",
  "Date",
  "BPM",
  "energy",
  "danceability",
  "loudness",
  "valence",
  "duration",
  "acousticness",
  "popularity",
  "artist separation",
  "rnd",
];

// State tracking for save functionality
var forceDisableSave = false;
var savedState = {};

// ================================
// UTILITY FUNCTIONS
// ================================

function error(msg) {
  info(msg);
  if (msg != "") {
    alert(msg);
  }
}

function info(msg) {
  $("#info").text(msg);
}

function getCurSortName() {
  let currentState = getPlaylistState();
  let col = currentState.order[0];
  if (directionMatters(col)) {
    let prefix = currentState.order[1] == "asc" ? "increasing " : "decreasing ";
    return prefix + cols[col];
  } else {
    return cols[col];
  }
}

function directionMatters(col) {
  let cname = cols[col];
  if (cname === "rnd" || cname === "artist separation") {
    return false;
  }
  return true;
}

function formatDuration(dur) {
  var mins = Math.floor(dur / 60);
  var secs = Math.floor(dur - mins * 60);
  var ssecs = secs.toString();
  if (secs < 10) {
    ssecs = "0" + ssecs;
  }
  return mins + ":" + ssecs;
}

function inRange(val, min, max) {
  return (
    (isNaN(min) && isNaN(max)) ||
    (isNaN(min) && val <= max) ||
    (min <= val && isNaN(max)) ||
    (min <= val && val <= max)
  );
}

// ================================
// SPOTIFY AUTHENTICATION (PKCE)
// ================================

// Generate cryptographically secure random string for PKCE
function generateRandomString(length) {
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

// SHA256 hash function
async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest("SHA-256", data);
}

// Base64 encode for PKCE
function base64encode(input) {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

// PKCE Authorization with modern flow
async function authorizeUser() {
  var scopes =
    "playlist-read-private playlist-modify-private playlist-modify-public";

  // Generate PKCE code verifier and challenge
  const codeVerifier = generateRandomString(64);
  const hashed = await sha256(codeVerifier);
  const codeChallenge = base64encode(hashed);

  // Store code verifier for token exchange
  window.localStorage.setItem("code_verifier", codeVerifier);

  // Build authorization URL with PKCE parameters
  const authUrl = new URL("https://accounts.spotify.com/authorize");
  const params = {
    response_type: "code",
    client_id: SPOTIFY_CLIENT_ID,
    scope: scopes,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    state: generateRandomString(16), // CSRF protection
  };

  authUrl.search = new URLSearchParams(params).toString();
  window.location.href = authUrl.toString();
}

// Exchange authorization code for access token
async function exchangeCodeForToken(code) {
  const codeVerifier = localStorage.getItem("code_verifier");

  if (!codeVerifier) {
    throw new Error("Code verifier not found");
  }

  const url = "https://accounts.spotify.com/api/token";
  const payload = {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      grant_type: "authorization_code",
      code: code,
      redirect_uri: SPOTIFY_REDIRECT_URI,
      code_verifier: codeVerifier,
    }),
  };

  const response = await fetch(url, payload);

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status}`);
  }

  const data = await response.json();

  // Store tokens
  localStorage.setItem("access_token", data.access_token);
  localStorage.setItem("refresh_token", data.refresh_token);
  localStorage.setItem("token_expires_at", Date.now() + data.expires_in * 1000);

  // Clean up
  localStorage.removeItem("code_verifier");

  return data.access_token;
}

// Parse URL parameters for PKCE flow
function parseArgs() {
  // Check if we have URL query parameters (PKCE flow)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("code")) {
    return {
      code: urlParams.get("code"),
      state: urlParams.get("state"),
      error: urlParams.get("error"),
    };
  }

  // Fallback to old hash parsing for backward compatibility
  var hash = location.hash.replace(/#/g, "");
  var all = hash.split("&");
  var args = {};
  _.each(all, function (keyvalue) {
    var kv = keyvalue.split("=");
    var key = kv[0];
    var val = kv[1];
    args[key] = val;
  });
  return args;
}

// ================================
// SPOTIFY API CALLS
// ================================

function callSpotify(type, url, json, callback) {
  $.ajax(url, {
    type: type,
    data: JSON.stringify(json),
    dataType: "json",
    headers: {
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json",
    },
    success: function (r) {
      callback(true, r);
    },
    error: function (r) {
      if (r.status >= 200 && r.status < 300) {
        callback(true, r);
      } else {
        callback(false, r);
      }
    },
  });
}

function callSpotifyQ(type, url, json) {
  return Q.Promise(function (resolve, reject, notify) {
    $.ajax(url, {
      type: type,
      data: JSON.stringify(json),
      dataType: "json",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
      beforeSend: function () {
        console.log(type + ": " + this.url);
      },
      success: function (data) {
        resolve(data);
      },
      error: function (jqXHR, textStatus) {
        if (jqXHR.status >= 200 && jqXHR.status < 300) {
          resolve(undefined);
        } else {
          reject(textStatus);
        }
      },
    });
  });
}

function getSpotify(url, data, callback) {
  $.ajax(url, {
    dataType: "json",
    data: data,
    headers: {
      Authorization: "Bearer " + accessToken,
    },
    success: function (r) {
      callback(r);
    },
    error: function (r) {
      callback(null);
    },
  });
}

function getSpotifyQ(url, data) {
  return Q.Promise(function (resolve, reject, notify) {
    $.ajax(url, {
      dataType: "json",
      data: data,
      headers: {
        Authorization: "Bearer " + accessToken,
      },
      beforeSend: function () {
        // console.log("GET: " + this.url);
      },
      success: function (data) {
        resolve(data);
      },
      error: function (jqXHR, textStatus) {
        if (jqXHR.status >= 200 && jqXHR.status < 300) {
          resolve(undefined);
        } else {
          reject(textStatus);
        }
      },
    });
  });
}

// ================================
// PLAYLIST MANAGEMENT
// ================================

function showPlaylists() {
  $(".worker").hide();
  $("#playlists").show();
}

function fetchCurrentUserProfile(callback) {
  var url = "https://api.spotify.com/v1/me";
  getSpotify(url, null, callback);
}

function goodPlaylist(playlist) {
  return playlist.tracks.total > 0;
}

function formatOwner(owner) {
  if (owner.id == curUserID) {
    return "";
  } else {
    return owner.id;
  }
}

function get_tiny_image(playlist) {
  if (playlist.images) {
    var len = playlist.images.length;
    if (len > 0) {
      return playlist.images[len - 1]["url"];
    } else {
      return null;
    }
  } else {
    return null;
  }
}

function loadPlaylists(uid) {
  $("#playlists").show();
  fetchPlaylists(uid, playlistLoaded);
}

function fetchPlaylists(uid, callback) {
  $("#playlist-list tbody").empty();
  $(".prompt").hide();
  $(".spinner").show();

  info("Getting your playlists");
  var url = "https://api.spotify.com/v1/users/" + uid + "/playlists";
  var data = {
    limit: 50,
    offset: 0,
  };
  getSpotify(url, data, callback);
}

function playlistLoaded(playlists) {
  var pl = $("#playlist-list tbody");
  $(".prompt").show();
  $(".spinner").hide();
  if (playlists) {
    info("");
    _.each(playlists.items, function (playlist) {
      if (goodPlaylist(playlist)) {
        var tr = $("<tr>").addClass(
          "hover:bg-gray-50 cursor-pointer transition-colors duration-200"
        );

        // Image cell with modern styling
        var tiny_image_url = get_tiny_image(playlist);
        var imageCell = $("<td>").addClass("px-6 py-4");
        if (tiny_image_url) {
          var imageContainer = $("<div>").addClass(
            "w-16 h-16 rounded-xl overflow-hidden shadow-lg group-hover:scale-110 transition-transform duration-200"
          );
          var image = $("<img>")
            .attr("src", tiny_image_url)
            .addClass("w-full h-full object-cover")
            .attr("alt", playlist.name + " cover");
          imageContainer.append(image);
          imageCell.append(imageContainer);
        } else {
          var placeholderContainer = $("<div>").addClass(
            "w-16 h-16 rounded-xl bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center shadow-lg"
          );
          var placeholderIcon = $("<i>").addClass(
            "fas fa-music text-gray-500 text-xl"
          );
          placeholderContainer.append(placeholderIcon);
          imageCell.append(placeholderContainer);
        }
        tr.append(imageCell);

        // Name cell with modern styling
        var tdName = $("<td>").addClass("px-6 py-4");
        var aName = $("<a>")
          .text(playlist.name)
          .addClass(
            "text-lg font-semibold text-gray-900 hover:text-spotify-600 transition-colors duration-200 cursor-pointer"
          )
          .on("click", function () {
            fetchSinglePlaylist(playlist);
          });
        tdName.append(aName);

        // Track count with badge styling
        var tdTrackCount = $("<td>").addClass("px-6 py-4");
        var trackBadge = $("<span>")
          .text(playlist.tracks.total)
          .addClass(
            "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-spotify-100 text-spotify-800"
          );
        tdTrackCount.append(trackBadge);

        // Owner cell with modern styling
        var tdOwner = $("<td>").addClass("px-6 py-4 text-gray-600 font-medium");
        var ownerText = formatOwner(playlist.owner);
        if (ownerText) {
          tdOwner.text(ownerText);
        } else {
          var youBadge = $("<span>")
            .text("You")
            .addClass(
              "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"
            );
          tdOwner.append(youBadge);
        }

        tr.append(tdName);
        tr.append(tdTrackCount);
        tr.append(tdOwner);

        // Add click handler to entire row
        tr.on("click", function () {
          fetchSinglePlaylist(playlist);
        });

        pl.append(tr);
      }
    });
    if (playlists.next) {
      getSpotify(playlists.next, null, playlistLoaded);
    }
  } else {
    error("Sorry, I couldn't find your playlists");
  }
}

// ================================
// SINGLE PLAYLIST MANAGEMENT
// ================================

function fetchSinglePlaylist(playlist) {
  $(".worker").hide();
  $("#single-playlist").show();
  $("#single-playlist-contents").hide();
  $(".spinner2").show();
  $("#song-table tbody").empty();
  window.scrollTo(0, 0);
  disableSaveButton();
  songTable.clear();
  resetState();

  curPlaylist = playlist;
  curPlaylist.tracks.items = [];

  $("#playlist-title").text(playlist.name);
  $("#playlist-title").attr("href", playlist.uri);

  info("");

  fetchPlaylistTracks(playlist)
    .then(function () {
      saveState();
      enableSaveButtonWhenNeeded();
    })
    .catch(function (msg) {
      console.log("msg", msg);
      error("Error while loading playlist: " + msg);
    });
}

// ================================
// AUDIO FEATURES & ANALYSIS
// ================================

function fetchAudioFeatures(ids) {
  var cids = ids.join(",");
  var url = "https://api.spotify.com/v1/audio-features";
  return getSpotifyQ(url, { ids: cids });
}

function fetchAlbums(ids) {
  var cids = ids.join(",");
  var url = "https://api.spotify.com/v1/albums";
  return getSpotifyQ(url, { ids: cids });
}

function fetchAllAlbums(ids) {
  var maxAlbumsPerCall = 20;
  var qs = [];
  for (var i = 0; i < ids.length; i += maxAlbumsPerCall) {
    var aids = ids.slice(i, i + maxAlbumsPerCall);
    qs.push(fetchAlbums(aids));
  }
  return Q.all(qs);
}

// ================================
// TRACK TABLE MANAGEMENT
// ================================

function clearTable() {
  songTable.clear();
}

function updateTable(items) {
  $("#single-playlist-contents").show();
  _.each(items, function (item, i) {
    if (item.track) {
      var track = item.track;
      track.rnd = Math.random() * 10000;
      addTrack(songTable, track);
    }
  });
  songTable.draw();
  $(".spinner2").hide();
}

function addTrack(table, track) {
  if (track && track.enInfo && "tempo" in track.enInfo) {
    var relDate = "";
    if (track.album.id in albumDates) {
      relDate = albumDates[track.album.id];
    }
    table.row.add([
      track.which + 1,
      track.name,
      track.artists[0].name,
      relDate,
      Math.round(track.enInfo.tempo),
      Math.round(track.enInfo.energy * 100),
      Math.round(track.enInfo.danceability * 100),
      Math.round(track.enInfo.loudness),
      Math.round(track.enInfo.valence * 100),
      formatDuration(Math.round(track.enInfo.duration_ms / 1000.0)),
      Math.round(track.enInfo.acousticness * 100),
      Math.round(track.popularity),
      Math.round(track.smart),
      Math.round(track.rnd),
      track,
    ]);
  } else {
    table.row.add([
      track.which + 1,
      track.name,
      track.artists[0].name,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      track,
    ]);
  }
}

// ================================
// SMART ORDERING & ALGORITHM
// ================================

function smartOrder(items) {
  let length = items.length;
  let artist_counts = new Proxy(
    {},
    { get: (target, name) => (name in target ? target[name] : 0) }
  );
  _.each(items, function (item, i) {
    if (item.track) {
      var track = item.track;
      var artist = track.artists[0].name;
      artist_counts[artist]++;
    }
  });

  let artist_counts_so_far = new Proxy(
    {},
    { get: (target, name) => (name in target ? target[name] : 0) }
  );
  let out = [];
  let all_items = items.slice();

  while (all_items.length > 0) {
    let best_delta = 1000;
    let best_item = all_items[0];
    _.each(all_items, function (item, i) {
      if (item.track) {
        var track = item.track;
        let artist = track.artists[0].name;
        let desired_percentage = artist_counts[artist] / length;
        let next_percentage =
          (artist_counts_so_far[artist] + 1) / (out.length + 1);
        let delta_percentage = Math.abs(next_percentage - desired_percentage);
        if (delta_percentage < best_delta) {
          best_delta = delta_percentage;
          best_item = item;
        }
      } else {
        console.log("nope", item);
      }
    });
    all_items = all_items.filter((item) => item != best_item);
    best_item.track.smart = out.length;
    out.push(best_item);
    artist_counts_so_far[best_item.track.artists[0].name] += 1;
  }
}

// ================================
// PLAYLIST TRACKS FETCHING
// ================================

function fetchPlaylistTracks(playlist) {
  let all_items = [];

  function fetchLoop(url) {
    var tracks;

    return getSpotifyQ(url)
      .then(function (data) {
        var ids = [];
        var aids = [];

        tracks = data.tracks ? data.tracks : data;
        _.each(tracks.items, function (item, i) {
          all_items.push(item);
          if (item.track) {
            item.track.which = curPlaylist.tracks.items.length;
            curPlaylist.tracks.items.push(item);
            if (!item.is_local) {
              if (item.track && item.track.id) {
                ids.push(item.track.id);
              }
              if (!_.contains(aids, item.track.album.id)) {
                if (!(item.track.album.id in albumDates)) {
                  aids.push(item.track.album.id);
                }
              }
            }
          } else {
            console.log("no track at", i);
          }
        });
        return Q.all([fetchAllAlbums(aids), fetchAudioFeatures(ids)]);
      })
      .then(function (results) {
        var allAlbums = results[0];
        var trackFeatures = results[1];

        _.each(allAlbums, function (albums) {
          _.each(albums.albums, function (album) {
            if (album != null && "id" in album) {
              albumDates[album.id] = album.release_date;
            }
          });
        });
        var fmap = {};
        if ("audio_attributes" in trackFeatures) {
          trackFeatures = trackFeatures["audio_attributes"];
        }
        if ("audio_features" in trackFeatures) {
          trackFeatures = trackFeatures["audio_features"];
        }
        _.each(trackFeatures, function (trackFeature, i) {
          if (trackFeature && trackFeature.id) {
            fmap[trackFeature.id] = trackFeature;
          }
        });

        _.each(tracks.items, function (item, i) {
          if (item.track && item.track.id) {
            var tid = item.track.id;
            if (tid in fmap) {
              item.track.enInfo = fmap[tid];
            } else {
              item.track.enInfo = {};
            }
          }
        });
        updateTable(tracks.items);

        if (tracks.next) {
          return fetchLoop(tracks.next);
        } else {
          console.log("tracks loaded");
          smartOrder(all_items);
          clearTable();
          updateTable(all_items);
        }
      });
  }

  var startUrl =
    "https://api.spotify.com/v1/users/" +
    playlist.owner.id +
    "/playlists/" +
    playlist.id +
    "/tracks?limit=50";
  return fetchLoop(startUrl);
}

// ================================
// AUDIO PLAYBACK
// ================================

function playTrack(track) {
  audio.attr("src", track.preview_url);
  audio.get(0).play();
}

function stopTrack() {
  audio.get(0).pause();
}

// ================================
// FILTERING FUNCTIONALITY
// ================================

function playlistFilter(settings, data, dataIndex) {
  var minBpm = parseInt($("#min-bpm").val(), 10);
  var maxBpm = parseInt($("#max-bpm").val(), 10);
  var includeDouble = $("#include-double").is(":checked");
  var bpm = parseFloat(data[4]) || 0;

  return (
    inRange(bpm, minBpm, maxBpm) ||
    (includeDouble && inRange(bpm * 2, minBpm, maxBpm))
  );
}

// ================================
// PLAYLIST SAVING FUNCTIONALITY
// ================================

function getSortedUrisFromTable(tracks, table) {
  return _.chain(table.rows({ filter: "applied" }).data())
    .select(function (rowdata) {
      return rowdata[14].uri.startsWith("spotify:track:");
    })
    .map(function (rowdata) {
      return rowdata[14].uri;
    })
    .value();
}

function savePlaylist(playlist, createNewPlaylist) {
  var tids = getSortedUrisFromTable(playlist.tracks.items, songTable);

  if (tids.length <= 0) {
    error(
      "Cannot save the playlist because there are no tracks left after filtering"
    );
    return;
  }

  disableSaveButton();
  showSaveSpinner(true);

  createOrReusePlaylist(playlist, createNewPlaylist)
    .then(function (playlistToModify) {
      return saveTidsToPlaylist(playlistToModify, tids, true);
    })
    .then(function () {
      saveState();
    })
    .catch(function (msg) {
      error(msg);
    })
    .finally(function () {
      showSaveSpinner(false);
      enableSaveButtonWhenNeeded();
      error("");
    });
}

function saveTidsToPlaylist(playlist, tids, replace) {
  var sliceLength = 100;
  var this_tids = tids.slice(0, sliceLength);
  var remaining = tids.slice(sliceLength);
  var url = "https://api.spotify.com/v1/playlists/" + playlist.id + "/tracks";
  var type;
  var json;

  if (replace) {
    type = "PUT";
    json = { uris: this_tids };
  } else {
    type = "POST";
    json = this_tids;
  }

  return callSpotifyQ(type, url, json)
    .then(function () {
      if (remaining.length > 0) {
        return saveTidsToPlaylist(playlist, remaining, false);
      }
    })
    .catch(function () {
      console.log("reject");
      return Q.reject("Trouble saving tracks to the playlist");
    });
}

function createPlaylist(owner, name, isPublic) {
  var url = "https://api.spotify.com/v1/users/" + owner + "/playlists";
  var json = { name: name, public: isPublic };
  return callSpotifyQ("POST", url, json).catch(function () {
    return Q.reject("Cannot create the new playlist");
  });
}

function createOrReusePlaylist(playlist, createNewPlaylist) {
  if (createNewPlaylist) {
    var sortName = getCurSortName();
    return createPlaylist(
      curUserID,
      playlist.name + " ordered by " + sortName,
      playlist.public
    );
  } else {
    return Q(playlist);
  }
}

// ================================
// STATE MANAGEMENT
// ================================

function resetState() {
  songTable.order([0, "asc"]);
  $("#min-bpm").val("");
  $("#max-bpm").val("");
  $("#include-double").prop("checked", true);
  saveState();
}

function getPlaylistState() {
  var firstOrder = [];
  var selectedTableOrder = songTable.order();
  if (selectedTableOrder.length >= 1) {
    firstOrder = _.clone(selectedTableOrder[0]);
  }

  return {
    minBpm: parseInt($("#min-bpm").val(), 10),
    maxBpm: parseInt($("#max-bpm").val(), 10),
    includeDouble: $("#include-double").is(":checked"),
    order: firstOrder,
  };
}

function saveState() {
  savedState = getPlaylistState();
}

function isSavable() {
  return !_.isEqual(savedState, getPlaylistState());
}

function setNeedsSave(state) {
  if (state) {
    $("#save,#saveDropdown").attr("disabled", false);
    $("#save,#saveDropdown").removeClass("btn-warning");
    $("#save,#saveDropdown").addClass("btn-primary");
  } else {
    $("#save,#saveDropdown").attr("disabled", true);
    $("#save,#saveDropdown").addClass("btn-warning");
    $("#save,#saveDropdown").removeClass("btn-primary");
  }
}

function updateSaveButtonState() {
  setNeedsSave(!forceDisableSave && isSavable());
}

function disableSaveButton() {
  forceDisableSave = true;
  updateSaveButtonState();
}

function enableSaveButtonWhenNeeded() {
  forceDisableSave = false;
  updateSaveButtonState();
}

function showSaveSpinner(show) {
  if (show) {
    $("#save .spinner-icon").removeClass("hidden");
    $("#save .save-icon").addClass("hidden");
    $("#save").addClass("active");
  } else {
    $("#save .spinner-icon").addClass("hidden");
    $("#save .save-icon").removeClass("hidden");
    $("#save").removeClass("active");
  }
}

// ================================
// TABLE INITIALIZATION
// ================================

function initTable() {
  var table = $("#song-table").DataTable({
    paging: false,
    searching: true,
    info: false,
    dom: "t",
    columnDefs: [{ type: "time-uni", targets: 9 }],
  });

  table.on("order.dt", function () {
    updateSaveButtonState();
  });

  $("#song-table tbody").on("click", "tr", function () {
    if ($(this).hasClass("selected")) {
      $(this).removeClass("selected bg-spotify-50 border-spotify-200");
      var row = songTable.row($(this));
      stopTrack();
    } else {
      table
        .$("tr.selected")
        .removeClass("selected bg-spotify-50 border-spotify-200");
      $(this).addClass("selected bg-spotify-50 border-spotify-200");
      var row = songTable.row($(this));
      var rowData = row.data();
      var track = rowData[rowData.length - 1];
      playTrack(track);
    }
  });

  // Style table rows after DataTable is initialized
  setTimeout(function () {
    $("#song-table tbody tr").addClass(
      "hover:bg-gray-50 cursor-pointer transition-all duration-200"
    );
    $("#song-table tbody td").addClass(
      "px-4 py-3 text-sm text-gray-700 font-medium border-b border-gray-100"
    );
  }, 100);

  return table;
}

// ================================
// NAVIGATION FUNCTIONS
// ================================

function toggleMobileMenu() {
  const menu = document.getElementById("mobile-menu");
  menu.classList.toggle("hidden");
}

function logout() {
  // Clear all stored authentication data
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("token_expires_at");
  localStorage.removeItem("code_verifier");

  // Reset global variables
  accessToken = null;
  curUserID = null;
  curPlaylist = null;

  // Hide user info and show login button
  $("#user-info").addClass("hidden");
  $("#user-info-mobile").addClass("hidden");
  $("#get-spotify-btn").removeClass("hidden");
  $("#get-spotify-btn-mobile").removeClass("hidden");

  // Reset UI to initial state
  $(".worker").hide();
  $("#intro").show();
  $("#go").show();

  // Clear any existing playlist data
  $("#playlist-list tbody").empty();
  $("#song-table tbody").empty();
  if (songTable) {
    songTable.clear();
  }

  // Clear info messages
  info("Logged out successfully");

  // Reset page title
  window.history.replaceState({}, document.title, window.location.pathname);
}

function showUserInfo(user) {
  // Update both desktop and mobile user displays
  $("#who").text(user.id);
  $("#who-mobile").text(user.id);

  // Show user info and hide login buttons
  $("#user-info").removeClass("hidden").addClass("flex");
  $("#user-info-mobile").removeClass("hidden").addClass("block");
  $("#get-spotify-btn").addClass("hidden");
  $("#get-spotify-btn-mobile").addClass("hidden");
}

// ================================
// MAIN INITIALIZATION
// ================================

$(document).ready(function () {
  songTable = initTable();
  var args = parseArgs();

  // Handle PKCE authorization code flow
  if ("code" in args) {
    info("Exchanging authorization code for access token...");
    exchangeCodeForToken(args.code)
      .then(function (token) {
        accessToken = token;
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );
        $(".worker").hide();
        fetchCurrentUserProfile(function (user) {
          if (user) {
            curUserID = user.id;
            showUserInfo(user);
            loadPlaylists(user.id);
          } else {
            error("Trouble getting the user profile");
          }
        });
      })
      .catch(function (error) {
        console.error("Token exchange failed:", error);
        error("Failed to complete authorization. Please try again.");
        $("#go").show();
        $("#go").on("click", function () {
          authorizeUser();
        });
      });
  } else if ("error" in args) {
    error(
      "Sorry, I can't read your playlists from Spotify without authorization"
    );
    $("#go").show();
    $("#go").on("click", function () {
      authorizeUser();
    });
  } else if ("access_token" in args) {
    // Legacy implicit grant flow support
    accessToken = args["access_token"];
    $(".worker").hide();
    fetchCurrentUserProfile(function (user) {
      if (user) {
        curUserID = user.id;
        showUserInfo(user);
        loadPlaylists(user.id);
      } else {
        error("Trouble getting the user profile");
      }
    });
  } else {
    // Check stored token
    const storedToken = localStorage.getItem("access_token");
    const tokenExpiry = localStorage.getItem("token_expires_at");

    if (storedToken && tokenExpiry && Date.now() < parseInt(tokenExpiry)) {
      accessToken = storedToken;
      $(".worker").hide();
      fetchCurrentUserProfile(function (user) {
        if (user) {
          curUserID = user.id;
          showUserInfo(user);
          loadPlaylists(user.id);
        } else {
          error("Stored token is invalid. Please re-authorize.");
          $("#go").show();
          $("#go").on("click", function () {
            authorizeUser();
          });
        }
      });
    } else {
      $("#go").show();
      $("#go").on("click", function () {
        authorizeUser();
      });
    }
  }

  // Event Handlers
  $("#dropSave").on("click", function (e) {
    e.preventDefault();
    $("#save-dropdown").addClass("hidden");
    info("saving new playlist...");
    savePlaylist(curPlaylist, true);
  });

  $("#dropOverwrite").on("click", function (e) {
    e.preventDefault();
    $("#save-dropdown").addClass("hidden");
    info("overwriting playlist...");
    savePlaylist(curPlaylist, false);
  });

  $("#pick").on("click", function () {
    showPlaylists();
  });

  $.fn.dataTable.ext.search.push(playlistFilter);
  $("#min-bpm,#max-bpm,#include-double").on("keyup change", function () {
    songTable.draw();
    updateSaveButtonState();
  });

  // Handle save dropdown properly
  $("#saveDropdown").on("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    $("#save-dropdown").toggleClass("hidden");
  });

  // Close dropdown when clicking outside
  $(document).on("click", function () {
    $("#save-dropdown").addClass("hidden");
  });

  $("#save-dropdown").on("click", function (e) {
    e.stopPropagation();
  });

  // Handle main save button (defaults to save new)
  $("#save").on("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    info("saving new playlist...");
    savePlaylist(curPlaylist, true);
  });

  // Logout button event handlers
  $("#logout-btn").on("click", function (e) {
    e.preventDefault();
    logout();
  });

  $("#logout-btn-mobile").on("click", function (e) {
    e.preventDefault();
    logout();
    // Close mobile menu after logout
    $("#mobile-menu").addClass("hidden");
  });
});
