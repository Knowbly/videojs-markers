"use strict";

var _typeof2 =
  typeof Symbol === "function" && typeof Symbol.iterator === "symbol"
    ? function(obj) {
        return typeof obj;
      }
    : function(obj) {
        return obj &&
          typeof Symbol === "function" &&
          obj.constructor === Symbol &&
          obj !== Symbol.prototype
          ? "symbol"
          : typeof obj;
      };

(function(global, factory) {
  if (typeof define === "function" && define.amd) {
    define(["video.js"], factory);
  } else if (typeof exports !== "undefined") {
    factory(require("video.js"));
  } else {
    var mod = {
      exports: {}
    };
    factory(global.videojs);
    global.videojsMarkers = mod.exports;
  }
})(this, function(_video) {
  /*! videojs-markers - v0.9.0 - 2017-08-05
    * Copyright (c) 2017 ; Licensed  */

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule
      ? obj
      : {
          default: obj
        };
  }
  var _video2 = _interopRequireDefault(_video);

  var _typeof =
    typeof Symbol === "function" && _typeof2(Symbol.iterator) === "symbol"
      ? function(obj) {
          return typeof obj === "undefined" ? "undefined" : _typeof2(obj);
        }
      : function(obj) {
          return obj &&
            typeof Symbol === "function" &&
            obj.constructor === Symbol &&
            obj !== Symbol.prototype
            ? "symbol"
            : typeof obj === "undefined"
              ? "undefined"
              : _typeof2(obj);
        };

  // default setting
  var defaultSetting = {
    markerStyle: {
      position: "absolute",
      width: "3px",
      "background-color": "white"
    },
    markerTip: {
      display: false,
      text: function text(marker) {
        return "Break: " + marker.text;
      },
      time: function time(marker) {
        return marker.time;
      }
    },
    breakOverlay: {
      display: false,
      displayTime: 3,
      text: function text(marker) {
        return "Break overlay: " + marker.overlayText;
      },
      style: {
        width: "100%",
        height: "20%",
        "background-color": "rgba(0,0,0,0.7)",
        color: "white",
        "font-size": "17px"
      }
    },
    onMarkerClick: function onMarkerClick() {},
    onMarkerReached: function onMarkerReached() {},
    onMarkerHover: function onMarkerHover() {},
    onMarkerOut: function onMarkerOut() {},
    markers: [],
    duration: 0
  };

  // create a non-colliding random number
  function generateUUID() {
    var d = new Date().getTime();
    var uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(
      c
    ) {
      var r = (d + Math.random() * 16) % 16 | 0;
      d = Math.floor(d / 16);
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
    return uuid;
  }

  var NULL_INDEX = -1;

  function registerVideoJsMarkersPlugin(options) {
    // copied from video.js/src/js/utils/merge-options.js since
    // videojs 4 doens't support it by defualt.
    if (!_video2.default.mergeOptions) {
      var isPlain = function isPlain(value) {
        return (
          !!value &&
          (typeof value === "undefined" ? "undefined" : _typeof(value)) ===
            "object" &&
          toString.call(value) === "[object Object]" &&
          value.constructor === Object
        );
      };

      var mergeOptions = function mergeOptions(source1, source2) {
        var result = {};
        var sources = [source1, source2];
        sources.forEach(function(source) {
          if (!source) {
            return;
          }
          Object.keys(source).forEach(function(key) {
            var value = source[key];
            if (!isPlain(value)) {
              result[key] = value;
              return;
            }
            if (!isPlain(result[key])) {
              result[key] = {};
            }
            result[key] = mergeOptions(result[key], value);
          });
        });
        return result;
      };

      _video2.default.mergeOptions = mergeOptions;
    }

    if (!_video2.default.dom.createEl) {
      _video2.default.dom.createEl = function(tagName, props, attrs) {
        var el = _video2.default.Player.prototype.createEl(tagName, props);
        if (attrs) {
          Object.keys(attrs).forEach(function(key) {
            el.setAttribute(key, attrs[key]);
          });
        }
        return el;
      };
    }

    /**
     * register the markers plugin (dependent on jquery)
     */
    var setting = _video2.default.mergeOptions(defaultSetting, options);
    var markersMap = {};
    var markersList = [];
    // list of markers sorted by time
    var currentMarkerIndex = NULL_INDEX;
    var player = this;
    var markerTip = null;
    var breakOverlay = null;
    var overlayIndex = NULL_INDEX;

    function sortMarkersList() {
      // sort the list by time in asc order
      markersList.sort(function(a, b) {
        return setting.markerTip.time(a) - setting.markerTip.time(b);
      });
    }

    function getPosition(marker) {
      var rDuration = setting.realDuration || setting.duration;
      var result = (setting.markerTip.time(marker) / rDuration) * 100;
      return result > 100 ? 100 : result;
    }

    // attach hover event handler
    function registerMarkerTipHandler(markerDiv) {
      markerDiv.addEventListener("mouseover", function() {
        var marker = markersMap[markerDiv.getAttribute("data-marker-key")];
        if (markerTip) {
          markerTip.querySelector(
            ".vjs-tip-inner"
          ).innerText = setting.markerTip.text(marker);
          // margin-left needs to minus the padding length to align correctly with the marker
          markerTip.style.left = getPosition(marker) + "%";
          markerTip.style.marginLeft =
            -parseFloat(markerTip.getBoundingClientRect().width / 2) +
            parseFloat(markerDiv.getBoundingClientRect().width / 4) +
            "px";
          markerTip.style.visibility = "visible";
        }
        if (marker.type === "bookmark") {
          options.onMarkerHover(marker);
        }
      });

      markerDiv.addEventListener("mouseout", function() {
        var marker = markersMap[markerDiv.getAttribute("data-marker-key")];
        if (markerTip) {
          markerTip.style.visibility = "hidden";
        }
        if (marker.type === "bookmark") {
          options.onMarkerOut(marker);
        }
      });
    }

    function createMarkerDiv(marker) {
      var markerDiv = _video2.default.dom.createEl(
        "div",
        {
          className:
            "vjs-marker " +
            (marker.class || "") +
            " " +
            (options.markerClass || "")
        },
        {
          "data-marker-key": marker.key,
          "data-marker-time": setting.markerTip.time(marker)
        }
      );

      Object.keys(setting.markerStyle).forEach(function(key) {
        markerDiv.style[key] = setting.markerStyle[key];
      });
      markerDiv.style.left = getPosition(marker) + "%";
      var rect = { width: 0 };
      if (markerDiv.parentNode && markerDiv.getBoundingClientRect())
        rect = markerDiv.getBoundingClientRect();
      markerDiv.style.marginLeft = rect.width / 2 + "px";

      // bind click event to seek to marker time
      markerDiv.addEventListener("click", function() {
        var preventDefault = false;
        if (typeof setting.onMarkerClick === "function") {
          // if return false, prevent default behavior
          preventDefault = setting.onMarkerClick(marker) === false;
        }

        if (!preventDefault) {
          var key = this.getAttribute("data-marker-key");
          player.currentTime(setting.markerTip.time(markersMap[key]));
        }
      });

      if (setting.markerTip.display || marker.type === "bookmark") {
        registerMarkerTipHandler(markerDiv);
      }

      return markerDiv;
    }

    function addMarkers(newMarkers) {
      newMarkers.forEach(function(marker) {
        marker.key = generateUUID();

        player
          .el()
          .querySelector(".vjs-progress-holder")
          .appendChild(createMarkerDiv(marker));

        // store marker in an internal hash map
        markersMap[marker.key] = marker;
        markersList.push(marker);
      });

      sortMarkersList();
    }

    function updateMarkers() {
      // update UI for markers whose time changed
      markersList.forEach(function(marker) {
        var markerDiv = player
          .el()
          .querySelector(".vjs-marker[data-marker-key='" + marker.key + "']");
        var markerTime = setting.markerTip.time(marker);

        if (markerDiv.getAttribute("data-marker-time") !== markerTime) {
          markerDiv.style.left = getPosition(marker) + "%";
          markerDiv.setAttribute("data-marker-time", markerTime);
        }
      });
      sortMarkersList();
    }

    function removeMarkers(indexArray) {
      // reset overlay
      if (breakOverlay) {
        overlayIndex = NULL_INDEX;
        breakOverlay.style.visibility = "hidden";
      }
      currentMarkerIndex = NULL_INDEX;

      var deleteIndexList = [];
      indexArray.forEach(function(index) {
        var marker = markersList[index];
        if (marker) {
          // delete from memory
          delete markersMap[marker.key];
          deleteIndexList.push(index);

          // delete from dom
          var el = player
            .el()
            .querySelector(".vjs-marker[data-marker-key='" + marker.key + "']");
          el.parentNode.removeChild(el);
        }
      });

      // clean up markers array
      deleteIndexList.reverse();
      deleteIndexList.forEach(function(deleteIndex) {
        markersList.splice(deleteIndex, 1);
      });

      // sort again
      sortMarkersList();
    }

    function initializeMarkerTip() {
      markerTip = _video2.default.dom.createEl("div", {
        className: "vjs-tip",
        innerHTML:
          "<div class='vjs-tip-arrow'></div><div class='vjs-tip-inner'></div>"
      });
      player
        .el()
        .querySelector(".vjs-progress-holder")
        .appendChild(markerTip);
    }

    // show or hide break overlays
    function updateBreakOverlay() {
      if (!setting.breakOverlay.display || currentMarkerIndex < 0) {
        return;
      }

      var currentTime = player.currentTime();
      var marker = markersList[currentMarkerIndex];
      var markerTime = setting.markerTip.time(marker);

      if (
        currentTime >= markerTime &&
        currentTime <= markerTime + setting.breakOverlay.displayTime
      ) {
        if (overlayIndex !== currentMarkerIndex) {
          overlayIndex = currentMarkerIndex;
          if (breakOverlay) {
            breakOverlay.querySelector(
              ".vjs-break-overlay-text"
            ).innerHTML = setting.breakOverlay.text(marker);
          }
        }

        if (breakOverlay) {
          breakOverlay.style.visibility = "visible";
        }
      } else {
        overlayIndex = NULL_INDEX;
        if (breakOverlay) {
          breakOverlay.style.visibility = "hidden";
        }
      }
    }

    // problem when the next marker is within the overlay display time from the previous marker
    function initializeOverlay() {
      breakOverlay = _video2.default.dom.createEl("div", {
        className: "vjs-break-overlay",
        innerHTML: "<div class='vjs-break-overlay-text'></div>"
      });
      Object.keys(setting.breakOverlay.style).forEach(function(key) {
        if (breakOverlay) {
          breakOverlay.style[key] = setting.breakOverlay.style[key];
        }
      });
      player.el().appendChild(breakOverlay);
      overlayIndex = NULL_INDEX;
    }

    function onUpdateMarker() {
      /*
            check marker reached in between markers
            the logic here is that it triggers a new marker reached event only if the player
            enters a new marker range (e.g. from marker 1 to marker 2). Thus, if player is on marker 1 and user clicked on marker 1 again, no new reached event is triggered)
            */
      if (!markersList.length) {
        return;
      }

      var getNextMarkerTime = function getNextMarkerTime(index) {
        if (index < markersList.length - 1) {
          return setting.markerTip.time(markersList[index + 1]);
        }
        // next marker time of last marker would be end of video time
        return player.duration();
      };
      var currentTime = player.currentTime();
      var newMarkerIndex = NULL_INDEX;

      var nextMarkerTime = void 0;
      if (currentMarkerIndex !== NULL_INDEX) {
        // check if staying at same marker
        nextMarkerTime = getNextMarkerTime(currentMarkerIndex);
        if (
          currentTime >=
            setting.markerTip.time(markersList[currentMarkerIndex]) &&
          currentTime < nextMarkerTime
        ) {
          return;
        }

        // check for ending (at the end current time equals player duration)
        if (
          currentMarkerIndex === markersList.length - 1 &&
          currentTime === player.duration()
        ) {
          return;
        }
      }

      // check first marker, no marker is selected
      if (currentTime < setting.markerTip.time(markersList[0])) {
        newMarkerIndex = NULL_INDEX;
      } else {
        // look for new index
        for (var i = 0; i < markersList.length; i++) {
          nextMarkerTime = getNextMarkerTime(i);
          if (
            Math.floor(currentTime) === setting.markerTip.time(markersList[i])
          ) {
            newMarkerIndex = i;
            break;
          }
        }
      }

      // set new marker index
      if (newMarkerIndex !== currentMarkerIndex) {
        // trigger event if index is not null
        if (newMarkerIndex !== NULL_INDEX && options.onMarkerReached) {
          options.onMarkerReached(markersList[newMarkerIndex], newMarkerIndex);
        }
        currentMarkerIndex = newMarkerIndex;
      }
    }

    function onTimeUpdate() {
      onUpdateMarker();
      updateBreakOverlay();
      if (options.onTimeUpdateAfterMarkerUpdate)
        options.onTimeUpdateAfterMarkerUpdate();
    }

    // setup the whole thing
    function initialize(duration) {
      if (setting.markerTip.display) {
        initializeMarkerTip();
      }
      setting.realDuration = duration || setting.realDuration;

      // remove existing markers if already initialized
      player.markers.removeAll();
      addMarkers(options.markers);

      if (setting.breakOverlay.display) {
        initializeOverlay();
      }
      onTimeUpdate();
      player.on("timeupdate", onTimeUpdate);
      player.off("loadedmetadata");
    }

    // setup the plugin after we loaded video's meta data
    player.on("durationchange", function() {
      var duration = player.duration();
      if (duration > 0 && !setting.realDuration) {
        initialize(duration);
      }
    });

    // exposed plugin API
    player.markers = {
      getMarkers: function getMarkers() {
        return markersList;
      },
      next: function next() {
        // go to the next marker from current timestamp
        var currentTime = player.currentTime();
        for (var i = 0; i < markersList.length; i++) {
          var markerTime = setting.markerTip.time(markersList[i]);
          if (markerTime > currentTime) {
            player.currentTime(markerTime);
            break;
          }
        }
      },
      prev: function prev() {
        // go to previous marker
        var currentTime = player.currentTime();
        for (var i = markersList.length - 1; i >= 0; i--) {
          var markerTime = setting.markerTip.time(markersList[i]);
          // add a threshold
          if (markerTime + 0.5 < currentTime) {
            player.currentTime(markerTime);
            return;
          }
        }
      },
      add: function add(newMarkers) {
        // add new markers given an array of index
        addMarkers(newMarkers);
      },
      remove: function remove(indexArray) {
        // remove markers given an array of index
        removeMarkers(indexArray);
      },
      removeAll: function removeAll() {
        var indexArray = [];
        for (var i = 0; i < markersList.length; i++) {
          indexArray.push(i);
        }
        removeMarkers(indexArray);
      },
      updateTime: function updateTime() {
        // notify the plugin to update the UI for changes in marker times
        updateMarkers();
      },
      reset: function reset(newMarkers) {
        // remove all the existing markers and add new ones
        player.markers.removeAll();
        addMarkers(newMarkers);
      },
      destroy: function destroy() {
        // unregister the plugins and clean up even handlers
        player.markers.removeAll();
        if (breakOverlay) breakOverlay.remove();
        if (markerTip) markerTip.remove();
        player.off("timeupdate", updateBreakOverlay);
        delete player.markers;
      }
    };
  }

  _video2.default.registerPlugin("markers", registerVideoJsMarkersPlugin);
});
// # sourceMappingURL=videojs-markers.js.map
