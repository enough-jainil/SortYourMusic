/**
 * Spotify API Utilities Module Roll back
 */

class SpotifyAPI {
  constructor(auth) {
    this.auth = auth;
  }

  callSpotify(type, url, json, callback) {
    $.ajax(url, {
      type: type,
      data: JSON.stringify(json),
      dataType: "json",
      headers: {
        Authorization: "Bearer " + this.auth.getAccessToken(),
        "Content-Type": "application/json",
      },
      success: function (r) {
        callback(true, r);
      },
      error: function (r) {
        // 2XX status codes are good, but some have no
        // response data which triggers the error handler
        // convert it to goodness.
        if (r.status >= 200 && r.status < 300) {
          callback(true, r);
        } else {
          callback(false, r);
        }
      },
    });
  }

  callSpotifyQ(type, url, json) {
    return Q.Promise((resolve, reject, notify) => {
      $.ajax(url, {
        type: type,
        data: JSON.stringify(json),
        dataType: "json",
        headers: {
          Authorization: "Bearer " + this.auth.getAccessToken(),
          "Content-Type": "application/json",
        },
        beforeSend: function () {
          console.log(type + ": " + this.url);
        },
        success: function (data) {
          resolve(data);
        },
        error: function (jqXHR, textStatus) {
          // 2XX status codes are good, but some have no
          // response data which triggers the error handler
          // convert it to goodness.
          if (jqXHR.status >= 200 && jqXHR.status < 300) {
            resolve(undefined);
          } else {
            reject(textStatus);
          }
        },
      });
    });
  }

  getSpotify(url, data, callback) {
    $.ajax(url, {
      dataType: "json",
      data: data,
      headers: {
        Authorization: "Bearer " + this.auth.getAccessToken(),
      },
      success: function (r) {
        callback(r);
      },
      error: function (r) {
        callback(null);
      },
    });
  }

  getSpotifyQ(url, data) {
    return Q.Promise((resolve, reject, notify) => {
      $.ajax(url, {
        dataType: "json",
        data: data,
        headers: {
          Authorization: "Bearer " + this.auth.getAccessToken(),
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

  fetchCurrentUserProfile(callback) {
    var url = "https://api.spotify.com/v1/me";
    this.getSpotify(url, null, callback);
  }

  fetchPlaylists(uid, callback) {
    var url = "https://api.spotify.com/v1/users/" + uid + "/playlists";
    var data = {
      limit: 50,
      offset: 0,
    };
    this.getSpotify(url, data, callback);
  }

  fetchAudioFeatures(ids) {
    var cids = ids.join(",");
    var url = "https://api.spotify.com/v1/audio-features";
    return this.getSpotifyQ(url, { ids: cids });
  }

  fetchAlbums(ids) {
    var cids = ids.join(",");
    var url = "https://api.spotify.com/v1/albums";
    return this.getSpotifyQ(url, { ids: cids });
  }

  fetchAllAlbums(ids) {
    var maxAlbumsPerCall = 20;
    var qs = [];
    for (var i = 0; i < ids.length; i += maxAlbumsPerCall) {
      var aids = ids.slice(i, i + maxAlbumsPerCall);
      qs.push(this.fetchAlbums(aids));
    }
    return Q.all(qs);
  }

  createPlaylist(owner, name, isPublic) {
    var url = "https://api.spotify.com/v1/users/" + owner + "/playlists";
    var json = { name: name, public: isPublic };
    return this.callSpotifyQ("POST", url, json).catch(function () {
      return Q.reject("Cannot create the new playlist");
    });
  }

  saveTidsToPlaylist(playlist, tids, replace) {
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

    return this.callSpotifyQ(type, url, json)
      .then(() => {
        if (remaining.length > 0) {
          return this.saveTidsToPlaylist(playlist, remaining, false);
        }
      })
      .catch(() => {
        console.log("reject");
        return Q.reject("Trouble saving tracks to the playlist");
      });
  }
}

// Export as global for backward compatibility
window.SpotifyAPI = SpotifyAPI;
