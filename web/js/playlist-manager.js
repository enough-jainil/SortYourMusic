/**
 * Playlist Management Module
 */

class PlaylistManager {
  constructor(auth, api) {
    this.auth = auth;
    this.api = api;
    this.curPlaylist = null;
    this.albumDates = {};
    this.audio = $("<audio>");
    this.songTable = null;
    this.cols = [
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
    this.forceDisableSave = false;
    this.savedState = {};
  }

  // Utility functions
  error(msg) {
    this.info(msg);
    if (msg != "") {
      alert(msg);
    }
  }

  info(msg) {
    $("#info").text(msg);
  }

  getCurSortName() {
    let currentState = this.getPlaylistState();
    let col = currentState.order[0];
    if (this.directionMatters(col)) {
      let prefix =
        currentState.order[1] == "asc" ? "increasing " : "decreasing ";
      return prefix + this.cols[col];
    } else {
      return this.cols[col];
    }
  }

  directionMatters(col) {
    let cname = this.cols[col];
    if (cname === "rnd" || cname === "artist separation") {
      return false;
    }
    return true;
  }

  formatDuration(dur) {
    var mins = Math.floor(dur / 60);
    var secs = Math.floor(dur - mins * 60);
    var ssecs = secs.toString();
    if (secs < 10) {
      ssecs = "0" + ssecs;
    }
    return mins + ":" + ssecs;
  }

  goodPlaylist(playlist) {
    return playlist.tracks.total > 0;
  }

  formatOwner(owner) {
    if (owner.id == this.auth.getCurrentUser()) {
      return "";
    } else {
      return owner.id;
    }
  }

  get_tiny_image(playlist) {
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

  inRange(val, min, max) {
    return (
      (isNaN(min) && isNaN(max)) ||
      (isNaN(min) && val <= max) ||
      (min <= val && isNaN(max)) ||
      (min <= val && val <= max)
    );
  }

  playlistFilter(settings, data, dataIndex) {
    var minBpm = parseInt($("#min-bpm").val(), 10);
    var maxBpm = parseInt($("#max-bpm").val(), 10);
    var includeDouble = $("#include-double").is(":checked");
    var bpm = parseFloat(data[4]) || 0;

    return (
      this.inRange(bpm, minBpm, maxBpm) ||
      (includeDouble && this.inRange(bpm * 2, minBpm, maxBpm))
    );
  }

  playTrack(track) {
    this.audio.attr("src", track.preview_url);
    this.audio.get(0).play();
  }

  stopTrack() {
    this.audio.get(0).pause();
  }

  // Smart ordering algorithm
  smartOrder(items) {
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

  // UI Management
  showPlaylists() {
    $(".worker").hide();
    $("#playlists").show();
  }

  clearTable() {
    this.songTable.clear();
  }

  updateTable(items) {
    $("#single-playlist-contents").show();
    _.each(items, (item, i) => {
      if (item.track) {
        var track = item.track;
        track.rnd = Math.random() * 10000;
        this.addTrack(this.songTable, track);
      }
    });
    this.songTable.draw();
    $(".spinner2").hide();
  }

  addTrack(table, track) {
    if (track && track.enInfo && "tempo" in track.enInfo) {
      var relDate = "";
      if (track.album.id in this.albumDates) {
        relDate = this.albumDates[track.album.id];
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
        this.formatDuration(Math.round(track.enInfo.duration_ms / 1000.0)),
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

  // State management
  resetState() {
    this.songTable.order([0, "asc"]);
    $("#min-bpm").val("");
    $("#max-bpm").val("");
    $("#include-double").prop("checked", true);
    this.saveState();
  }

  getPlaylistState() {
    var firstOrder = [];
    var selectedTableOrder = this.songTable.order();
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

  saveState() {
    this.savedState = this.getPlaylistState();
  }

  isSavable() {
    return !_.isEqual(this.savedState, this.getPlaylistState());
  }

  setNeedsSave(state) {
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

  updateSaveButtonState() {
    this.setNeedsSave(!this.forceDisableSave && this.isSavable());
  }

  disableSaveButton() {
    this.forceDisableSave = true;
    this.updateSaveButtonState();
  }

  enableSaveButtonWhenNeeded() {
    this.forceDisableSave = false;
    this.updateSaveButtonState();
  }

  showSaveSpinner(showSpinner) {
    if (showSpinner) {
      $("#save .spinner-icon").removeClass("hidden");
      $("#save .save-icon").addClass("hidden");
      $("#save").addClass("active");
    } else {
      $("#save .spinner-icon").addClass("hidden");
      $("#save .save-icon").removeClass("hidden");
      $("#save").removeClass("active");
    }
  }

  getSortedUrisFromTable(tracks, table) {
    return _.chain(table.rows({ filter: "applied" }).data())
      .select(function (rowdata) {
        return rowdata[14].uri.startsWith("spotify:track:");
      })
      .map(function (rowdata) {
        return rowdata[14].uri;
      })
      .value();
  }
}

// Export as global for backward compatibility
window.PlaylistManager = PlaylistManager;
