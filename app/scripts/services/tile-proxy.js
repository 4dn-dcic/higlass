import { range } from 'd3-array';
import {
  json as d3Json,
  text as d3Text
} from 'd3-request';
import slugid from 'slugid';

import {
  workerFetchTiles,
  workerFetchMultiRequestTiles,
  workerGetTilesetInfo,
  workerSetPix,
} from '../worker';

// Config
import { TILE_FETCH_DEBOUNCE } from '../configs';

const sessionId = slugid.nice();
export let requestsInFlight = 0;

const debounce = (func, wait) => {
  let timeout;
  let bundledRequest = [];
  let requestMapper = {};

  const bundleRequests = (request) => {
    const requestId = requestMapper[request.id];

    if (requestId && bundledRequest[requestId]) {
      bundledRequest[requestId].ids = bundledRequest[requestId].ids.concat(request.ids);
    } else {
      requestMapper[request.id] = bundledRequest.length;
      bundledRequest.push(request);
    }
  };

  const reset = () => {
    timeout = null;
    bundledRequest = [];
    requestMapper = {};
  };

  const debounced = (request) => {
    bundleRequests(request);

    const later = () => {
      func({
        sessionId,
        requests: bundledRequest,
      });
      reset();
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };

  debounced.cancel = () => {
    clearTimeout(timeout);
    reset();
  };

  debounced.immediate = () => {
    func({
      sessionId,
      requests: bundledRequest,
    });
  };

  return debounced;
};

const workerFetchTilesDebounced = debounce(workerFetchMultiRequestTiles, TILE_FETCH_DEBOUNCE);

/**
 * Retrieve a set of tiles from the server
 *
 * Plenty of room for optimization and caching here.
 *
 * @param server: A string with the server's url (e.g. "http://127.0.0.1")
 * @param tileIds: The ids of the tiles to fetch (e.g. asdf-sdfs-sdfs.0.0.0)
 */
export const fetchTilesDebounced = request =>
  workerFetchTilesDebounced(request);

/**
 * Retrieve a set of tiles from the server
 *
 * Plenty of room for optimization and caching here.
 *
 * @param server: A string with the server's url (e.g. "http://127.0.0.1")
 * @param tileIds: The ids of the tiles to fetch (e.g. asdf-sdfs-sdfs.0.0.0)
 */
export const fetchTiles = (tilesetServer, tilesetIds, done) =>
  workerFetchTiles(tilesetServer, tilesetIds, this.sessionId, (results) => {
    done(results);
  });

/**
 * Calculate the zoom level from a list of available resolutions
 */
export const calculateZoomLevelFromResolutions = (resolutions, scale, minX, maxX) => {
  const sortedResolutions = resolutions.map(x => +x).sort((a,b) => b-a)

  const trackWidth = scale.range()[1] - scale.range()[0];
  //console.log('trackWidth:', trackWidth, 'scale:', this._xScale.domain()[1] - this._xScale.domain()[0]);

  let binsDisplayed = sortedResolutions.map(r => (scale.domain()[1] - scale.domain()[0]) / r)
  let binsPerPixel = binsDisplayed.map(b => b / trackWidth);

  /*
      console.log('trackWidth:', trackWidth);
      console.log('resolutions:', sortedResolutions);
      console.log('binsDisplayed:', binsDisplayed);
      console.log('binsPerPixel:', binsPerPixel);
      */

  // we're going to show the highest resolution that requires more than one pixel per bin
  let displayableBinsPerPixel = binsPerPixel.filter(b => b < 1);

  if (displayableBinsPerPixel.length == 0)
    return 0;

  let zoomIndex = binsPerPixel.indexOf(displayableBinsPerPixel[displayableBinsPerPixel.length-1]);
  /*
      console.log('displayableBinsPerPixel', displayableBinsPerPixel);
      console.log('zoomIndex:', zoomIndex);
      */

  return zoomIndex;
}

/**
 * Calculate the current zoom level.
 */
export const calculateZoomLevel = (scale, minX, maxX) => {
  const rangeWidth = scale.range()[1] - scale.range()[0];
  const zoomScale = Math.max(
    (maxX - minX) / (scale.domain()[1] - scale.domain()[0]),
    1,
  );

  // fun fact: the number 384 is halfway between 256 and 512
  const addedZoom = Math.max(
    0,
    Math.ceil(Math.log(rangeWidth / 384) / Math.LN2),
  );
  const zoomLevel = Math.round(Math.log(zoomScale) / Math.LN2) + addedZoom;

  return zoomLevel;
};

/**
 * Calculate the tiles that should be visible get a data domain
 * and a tileset info
 *
 * All the parameters except the first should be present in the
 * tileset_info returned by the server.
 *
 * @param zoomLevel: The zoom level at which to find the tiles (can be calculated using
 *                   this.calcaulteZoomLevel, but needs to synchronized across both x
 *                   and y scales so should be calculated externally)
 * @param scale: A d3 scale mapping data domain to visible values
 * @param minX: The minimum possible value in the dataset
 * @param maxX: The maximum possible value in the dataset
 * @param maxZoom: The maximum zoom value in this dataset
 * @param maxWidth: The width of the largest
 *   (roughlty equal to 2 ** maxZoom * tileSize * tileResolution)
 */
export const calculateTiles = (
  zoomLevel, scale, minX, maxX, maxZoom, maxWidth,
) => {
  const zoomLevelFinal = zoomLevel > maxZoom ? maxZoom : zoomLevel;

  // the ski areas are positioned according to their
  // cumulative widths, which means the tiles need to also
  // be calculated according to cumulative width

  const tileWidth = maxWidth / (2 ** zoomLevelFinal);

  const epsilon = 0.0000001;

  return range(
    Math.max(0, Math.floor((scale.domain()[0] - minX) / tileWidth)),
    Math.min(
      2 ** zoomLevelFinal,
      Math.ceil(((scale.domain()[1] - minX) - epsilon) / tileWidth),
    ),
  );
};

/**
 * Calculate the tiles that sould be visisble given the resolution and
 * the minX and maxX values for the region
 *
 * @param resolution: The number of base pairs per bin
 * @param scale: The scale to use to calculate the currently visible tiles
 * @param minX: The minimum x position of the tileset
 * @param maxX: The maximum x position of the tileset
 */
export const calculateTilesFromResolution = (resolution, scale, minX, maxX) => {
  const epsilon = 0.0000001;
  const PIXELS_PER_TILE = 256;
  const tileWidth = resolution * PIXELS_PER_TILE;

  return range(
    Math.max(0, Math.floor((scale.domain()[0] - minX) / tileWidth)),
    Math.ceil(Math.min(
      maxX,
      ((scale.domain()[1] - minX) - epsilon)) / tileWidth),
  );
};

export const trackInfo = (server, tilesetUid, done) => {
  const outUrl = `${server}/tileset_info/?d=${tilesetUid}&s=${sessionId}`;

  workerGetTilesetInfo(outUrl, done);
};

/**
 * Render 2D tile data. Convert the raw values to an array of
 * color values
 *
 * @param finished: A callback to let the caller know that the worker thread
 *                  has converted tileData to pixData
 * @param minVisibleValue: The minimum visible value (used for setting the color scale)
 * @param maxVisibleValue: The maximum visible value
 * @param colorScale: a 255 x 4 rgba array used as a color scale
 */
export const tileDataToPixData = (
  tile, valueScale, pseudocount, colorScale, finished,
) => {
  const tileData = tile.tileData;

  // clone the tileData so that the original array doesn't get neutered
  // when being passed to the worker script
  const newTileData = new Float32Array(tileData.dense.length);
  newTileData.set(tileData.dense);

  // comment this and uncomment the code afterwards to enable threading
  const pixData = workerSetPix(
    newTileData.length,
    newTileData,
    valueScale,
    pseudocount,
    colorScale,
  );

  finished(pixData);

  /*
    this.threadPool.run(function(input, done) {
          let tileData = input.tileData;
          importScripts(input.scriptPath + '/scripts/worker.js');
          let pixData = worker.workerSetPix(tileData.length, tileData,
                            input.minVisibleValue,
                            input.maxVisibleValue);
          done.transfer({'pixData': pixData}, [pixData.buffer]);

         })
       .on('done', function(job, message) {
         //console.log('done...', job);
         finished(message.pixData);
       })
       .on('error', function(job, error) {
        //console.log('error', error);
       })
    .send({
      scriptPath: scriptPath,
      tileData: newTileData,
      minVisibleValue: minVisibleValue,
      maxVisibleValue: maxVisibleValue},
      [newTileData.buffer]
    );
    */
};

function text(url, callback) {
  /**
   * Send a JSON request mark it so that we can tell how many are in flight
   */
  requestsInFlight += 1;
  d3Text(url, (error, done) => {
    callback(error, done);
    requestsInFlight -= 1;
  });
}

function json(url, callback) {
  /**
   * Send a JSON request mark it so that we can tell how many are in flight
   */
  requestsInFlight += 1;
  d3Json(url, (error, done) => {
    callback(error, done);
    requestsInFlight -= 1;
  });
}


const api = {
  calculateTiles,
  calculateTilesFromResolution,
  calculateZoomLevel,
  calculateZoomLevelFromResolutions,
  fetchTiles,
  fetchTilesDebounced,
  json,
  text,
  tileDataToPixData,
  trackInfo,
};

export default api;
