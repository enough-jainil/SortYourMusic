/**
 * Sort Your Music - Main Application Script
 */

"use strict";

// Global application state
let app = {
  auth: null,
  api: null,
  playlistManager: null,
  albumDates: {},
  audio: null,
  songTable: null,
};

// Mobile menu toggle function
function toggleMobileMenu() {
  const menu = document.getElementById("mobile-menu");
  menu.classList.toggle("hidden");
}

// Initialize DataTable
function initTable() {
  var table = new DataTable("#song-table", {
    paging: false,
    searching: true,
    info: false,
    layout: {
      topStart: null,
      topEnd: null,
      bottomStart: null,
      bottomEnd: null,
    },
    columnDefs: [
      { type: "date", targets: 9 }, // Updated for DataTables 2.x built-in date sorting
    ],
  });

  table.on("order.dt", function () {
    app.playlistManager.updateSaveButtonState();
  });

  $("#song-table tbody").on("click", "tr", function () {
    if ($(this).hasClass("selected")) {
      $(this).removeClass("selected bg-spotify-50 border-spotify-200");
      app.playlistManager.stopTrack();
    } else {
      table
        .$("tr.selected")
        .removeClass("selected bg-spotify-50 border-spotify-200");
      $(this).addClass("selected bg-spotify-50 border-spotify-200");
      var row = table.row($(this));
      var rowData = row.data();
      var track = rowData[rowData.length - 1];
      app.playlistManager.playTrack(track);
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

// Playlist loading and management
function loadPlaylists(uid) {
  $("#playlists").show();
  fetchPlaylists(uid);
}

function fetchPlaylists(uid) {
  $("#playlist-list tbody").empty();
  $(".prompt").hide();
  $(".spinner").show();

  app.playlistManager.info("Getting your playlists");
  app.api.fetchPlaylists(uid, playlistLoaded);
}

function playlistLoaded(playlists) {
  var pl = $("#playlist-list tbody");
  $(".prompt").show();
  $(".spinner").hide();

  if (playlists) {
    app.playlistManager.info("");
    _.each(playlists.items, function (playlist) {
      if (app.playlistManager.goodPlaylist(playlist)) {
        var tr = $("<tr>").addClass(
          "hover:bg-gray-50 cursor-pointer transition-colors duration-200"
        );

        // Image cell with modern styling
        var tiny_image_url = app.playlistManager.get_tiny_image(playlist);
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

        // Name cell
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

        // Track count
        var tdTrackCount = $("<td>").addClass("px-6 py-4");
        var trackBadge = $("<span>")
          .text(playlist.tracks.total)
          .addClass(
            "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-spotify-100 text-spotify-800"
          );
        tdTrackCount.append(trackBadge);

        // Owner cell
        var tdOwner = $("<td>").addClass("px-6 py-4 text-gray-600 font-medium");
        var ownerText = app.playlistManager.formatOwner(playlist.owner);
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

        tr.on("click", function () {
          fetchSinglePlaylist(playlist);
        });

        pl.append(tr);
      }
    });

    if (playlists.next) {
      app.api.getSpotify(playlists.next, null, playlistLoaded);
    }
  } else {
    app.playlistManager.error("Sorry, I couldn't find your playlists");
  }
}

// Single playlist management
function fetchSinglePlaylist(playlist) {
  $(".worker").hide();
  $("#single-playlist").show();
  $("#single-playlist-contents").hide();
  $(".spinner2").show();
  $("#song-table tbody").empty();
  window.scrollTo(0, 0);

  app.playlistManager.disableSaveButton();
  app.songTable.clear();
  app.playlistManager.resetState();

  app.playlistManager.curPlaylist = playlist;
  app.playlistManager.curPlaylist.tracks.items = [];

  $("#playlist-title").text(playlist.name);
  $("#playlist-title").attr("href", playlist.uri);

  app.playlistManager.info("");

  fetchPlaylistTracks(playlist)
    .then(function () {
      app.playlistManager.saveState();
      app.playlistManager.enableSaveButtonWhenNeeded();
    })
    .catch(function (msg) {
      console.log("msg", msg);
      app.playlistManager.error("Error while loading playlist: " + msg);
    });
}

function fetchPlaylistTracks(playlist) {
  let all_items = [];

  function fetchLoop(url) {
    var tracks;

    return app.api
      .getSpotifyQ(url)
      .then(function (data) {
        var ids = [];
        var aids = [];

        tracks = data.tracks ? data.tracks : data;
        _.each(tracks.items, function (item, i) {
          all_items.push(item);
          if (item.track) {
            item.track.which =
              app.playlistManager.curPlaylist.tracks.items.length;
            app.playlistManager.curPlaylist.tracks.items.push(item);
            if (!item.is_local) {
              if (item.track && item.track.id) {
                ids.push(item.track.id);
              }
              if (!_.contains(aids, item.track.album.id)) {
                if (!(item.track.album.id in app.albumDates)) {
                  aids.push(item.track.album.id);
                }
              }
            }
          } else {
            console.log("no track at", i);
          }
        });
        return Q.all([
          app.api.fetchAllAlbums(aids),
          app.api.fetchAudioFeatures(ids),
        ]);
      })
      .then(function (results) {
        var allAlbums = results[0];
        var trackFeatures = results[1];

        _.each(allAlbums, function (albums) {
          _.each(albums.albums, function (album) {
            if (album != null && "id" in album) {
              app.albumDates[album.id] = album.release_date;
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

        app.playlistManager.updateTable(tracks.items);

        if (tracks.next) {
          return fetchLoop(tracks.next);
        } else {
          console.log("tracks loaded");
          app.playlistManager.smartOrder(all_items);
          app.playlistManager.clearTable();
          app.playlistManager.updateTable(all_items);
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

// Playlist saving functionality
function savePlaylist(playlist, createNewPlaylist) {
  var tids = app.playlistManager.getSortedUrisFromTable(
    playlist.tracks.items,
    app.songTable
  );

  if (tids.length <= 0) {
    app.playlistManager.error(
      "Cannot save the playlist because there are no tracks left after filtering"
    );
    return;
  }

  app.playlistManager.disableSaveButton();
  app.playlistManager.showSaveSpinner(true);

  createOrReusePlaylist(playlist, createNewPlaylist)
    .then(function (playlistToModify) {
      return app.api.saveTidsToPlaylist(playlistToModify, tids, true);
    })
    .then(function () {
      app.playlistManager.saveState();
    })
    .catch(function (msg) {
      app.playlistManager.error(msg);
    })
    .finally(function () {
      app.playlistManager.showSaveSpinner(false);
      app.playlistManager.enableSaveButtonWhenNeeded();
      app.playlistManager.error("");
    });
}

function createOrReusePlaylist(playlist, createNewPlaylist) {
  if (createNewPlaylist) {
    var sortName = app.playlistManager.getCurSortName();
    return app.api.createPlaylist(
      app.auth.getCurrentUser(),
      playlist.name + " ordered by " + sortName,
      playlist.public
    );
  } else {
    return Q(playlist);
  }
}

// Document ready initialization
$(document).ready(function () {
  // Initialize modules
  app.auth = new SpotifyAuth();
  app.api = new SpotifyAPI(app.auth);
  app.playlistManager = new PlaylistManager(app.auth, app.api);

  // Initialize table
  app.songTable = initTable();
  app.playlistManager.songTable = app.songTable;

  var args = app.auth.parseArgs();

  // Handle PKCE authorization code flow
  if ("code" in args) {
    app.playlistManager.info(
      "Exchanging authorization code for access token..."
    );
    app.auth
      .exchangeCodeForToken(args.code)
      .then(function (token) {
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );
        $(".worker").hide();
        app.api.fetchCurrentUserProfile(function (user) {
          if (user) {
            app.auth.setCurrentUser(user.id);
            $("#who").text(user.id);
            loadPlaylists(user.id);
          } else {
            app.playlistManager.error("Trouble getting the user profile");
          }
        });
      })
      .catch(function (error) {
        console.error("Token exchange failed:", error);
        app.playlistManager.error(
          "Failed to complete authorization. Please try again."
        );
        $("#go").show();
        $("#go").on("click", function () {
          app.auth.authorizeUser();
        });
      });
  } else if ("error" in args) {
    app.playlistManager.error(
      "Sorry, I can't read your playlists from Spotify without authorization"
    );
    $("#go").show();
    $("#go").on("click", function () {
      app.auth.authorizeUser();
    });
  } else if ("access_token" in args) {
    // Legacy implicit grant flow support
    app.auth.setAccessToken(args["access_token"]);
    $(".worker").hide();
    app.api.fetchCurrentUserProfile(function (user) {
      if (user) {
        app.auth.setCurrentUser(user.id);
        $("#who").text(user.id);
        loadPlaylists(user.id);
      } else {
        app.playlistManager.error("Trouble getting the user profile");
      }
    });
  } else {
    // Check for stored token
    if (app.auth.hasValidToken()) {
      $(".worker").hide();
      app.api.fetchCurrentUserProfile(function (user) {
        if (user) {
          app.auth.setCurrentUser(user.id);
          $("#who").text(user.id);
          loadPlaylists(user.id);
        } else {
          app.playlistManager.error(
            "Stored token is invalid. Please re-authorize."
          );
          $("#go").show();
          $("#go").on("click", function () {
            app.auth.authorizeUser();
          });
        }
      });
    } else {
      // No valid token, show login button
      $("#go").show();
      $("#go").on("click", function () {
        app.auth.authorizeUser();
      });
    }
  }

  // Event handlers
  $("#dropSave").on("click", function (e) {
    e.preventDefault();
    $("#save-dropdown").addClass("hidden");
    app.playlistManager.info("saving new playlist...");
    savePlaylist(app.playlistManager.curPlaylist, true);
  });

  $("#dropOverwrite").on("click", function (e) {
    e.preventDefault();
    $("#save-dropdown").addClass("hidden");
    app.playlistManager.info("overwriting playlist...");
    savePlaylist(app.playlistManager.curPlaylist, false);
  });

  $("#pick").on("click", function () {
    app.playlistManager.showPlaylists();
  });

  // Setup filtering (DataTables 2.x compatible)
  DataTable.ext.search.push(function (settings, data, dataIndex) {
    return app.playlistManager.playlistFilter(settings, data, dataIndex);
  });

  $("#min-bpm,#max-bpm,#include-double").on("keyup change", function () {
    app.songTable.draw();
    app.playlistManager.updateSaveButtonState();
  });

  // Handle save dropdown
  $("#saveDropdown").on("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    $("#save-dropdown").toggleClass("hidden");
  });

  $(document).on("click", function () {
    $("#save-dropdown").addClass("hidden");
  });

  $("#save-dropdown").on("click", function (e) {
    e.stopPropagation();
  });

  $("#save").on("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    app.playlistManager.info("saving ...");
    savePlaylist(app.playlistManager.curPlaylist, true);
  });
});

// New in DataTables 2.x - Custom duration type for mm:ss format
DataTable.type("duration", {
  detect: function (data) {
    return data && data.match(/^\d+:\d{2}$/) ? "duration" : null;
  },
  order: {
    pre: function (data) {
      if (!data || data === "") return 0;
      var parts = data.split(":");
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    },
  },
});
