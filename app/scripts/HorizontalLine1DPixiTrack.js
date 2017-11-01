import { scaleLinear, scaleLog } from 'd3-scale';

import HorizontalTiled1DPixiTrack from './HorizontalTiled1DPixiTrack';
import { AxisPixi } from './AxisPixi';

import { colorToHex } from './utils';

export class HorizontalLine1DPixiTrack extends HorizontalTiled1DPixiTrack {
  constructor(
    scene,
    server,
    uid,
    handleTilesetInfoReceived,
    option,
    animate,
    onValueScaleChanged,
  ) {
    super(
      scene,
      server,
      uid,
      handleTilesetInfoReceived,
      option,
      animate,
      onValueScaleChanged,
    );

    this.axis = new AxisPixi(this);
    this.pBase.addChild(this.axis.pAxis);
  }

  initTile(tile) {
    /**
     * Create whatever is needed to draw this tile.
     */
    super.initTile(tile);

    tile.lineXValues = new Array(tile.tileData.dense.length);
    tile.lineYValues = new Array(tile.tileData.dense.length);

    this.drawTile(tile);
  }

  // destroyTile(tile) {

  // }

  rerender(options) {
    this.options = options;

    super.draw();

    for (const tile of this.visibleAndFetchedTiles()) {
      this.renderTile(tile);
    }
  }

  drawAxis(valueScale) {
    // either no axis position is specified
    if (!this.options.axisPositionVertical && !this.options.axisPositionHorizontal) {
      this.axis.clearAxis();
      return;
    }

    if (this.options.axisPositionVertical && this.options.axisPositionVertical === 'hidden') {
      this.axis.clearAxis();
      return;
    }

    if (this.options.axisPositionHorizontal && this.options.axisPositionHorizontal === 'hidden') {
      this.axis.clearAxis();
      return;
    }


    if (this.options.axisPositionHorizontal === 'left'
            || this.options.axisPositionVertical === 'top') {
      // left axis are shown at the beginning of the plot

      this.axis.pAxis.position.x = this.position[0];
      this.axis.pAxis.position.y = this.position[1];

      this.axis.drawAxisRight(valueScale, this.dimensions[1]);
    } else if (this.options.axisPositionHorizontal === 'outsideLeft'
            || this.options.axisPositionVertical === 'outsideTop') {
      // left axis are shown at the beginning of the plot

      this.axis.pAxis.position.x = this.position[0];
      this.axis.pAxis.position.y = this.position[1];

      this.axis.drawAxisLeft(valueScale, this.dimensions[1]);
    } else if (this.options.axisPositionHorizontal === 'right'
            || this.options.axisPositionVertical === 'bottom') {
      this.axis.pAxis.position.x = this.position[0] + this.dimensions[0];
      this.axis.pAxis.position.y = this.position[1];
      this.axis.drawAxisLeft(valueScale, this.dimensions[1]);
    } else if (this.options.axisPositionHorizontal === 'outsideRight'
            || this.options.axisPositionVertical === 'outsideBottom') {
      this.axis.pAxis.position.x = this.position[0] + this.dimensions[0];
      this.axis.pAxis.position.y = this.position[1];
      this.axis.drawAxisRight(valueScale, this.dimensions[1]);
    }
  }

  renderTile(tile) {
    // this function is just so that we follow the same pattern as
    // HeatmapTiledPixiTrack.js
    this.drawTile(tile);
  }

  drawTile(tile) {
    super.drawTile(tile);

    if (!tile.graphics) { return; }

    const graphics = tile.graphics;

    const { tileX, tileWidth } = this.getTilePosAndDimensions(
      tile.tileData.zoomLevel,
      tile.tileData.tilePos,
    );
    const tileValues = tile.tileData.dense;

    if (tileValues.length === 0) { return; }

    let pseudocount = 0; // if we use a log scale, then we'll set a pseudocount
    // equal to the smallest non-zero value
    this.valueScale = null;

    // console.log('valueScaling:', this.options.valueScaling);
    if (this.options.valueScaling === 'log') {
      let offsetValue = this.medianVisibleValue;

      if (!this.medianVisibleValue) { offsetValue = this.minVisibleValue(); }

      const PLOT_MARGIN = 6;
      // console.log('offsetValue:', offsetValue);

      this.valueScale = scaleLog()
        // .base(Math.E)
        .domain([offsetValue, this.maxValue() + offsetValue])
        // .domain([offsetValue, this.maxValue()])
        .range([this.dimensions[1] - PLOT_MARGIN, PLOT_MARGIN]);
      pseudocount = offsetValue;
    } else {
      // linear scale
      this.valueScale = scaleLinear()
        .domain([this.minValue(), this.maxValue()])
        .range([this.dimensions[1], 0]);
    }

    graphics.clear();

    this.drawAxis(this.valueScale);

    if (this.options.valueScaling === 'log' && this.valueScale.domain()[1] < 0) {
      console.warn('Negative values present when using a log scale', this.valueScale.domain());
      return;
    }

    const stroke = colorToHex(this.options.lineStrokeColor ? this.options.lineStrokeColor : 'blue');
    // this scale should go from an index in the data array to
    // a position in the genome coordinates
    const tileXScale = scaleLinear().domain([0, this.tilesetInfo.tile_size])
      .range([tileX, tileX + tileWidth]);

    const strokeWidth = this.options.lineStrokeWidth ? this.options.lineStrokeWidth : 1;
    graphics.lineStyle(strokeWidth, stroke, 1);

    const logScaling = this.options.valueScaling === 'log';

    for (let i = 0; i < tileValues.length; i++) {
      const xPos = this._xScale(tileXScale(i));
      const yPos = this.valueScale(tileValues[i] + pseudocount);

      tile.lineXValues[i] = xPos;
      tile.lineYValues[i] = yPos;

      if (i === 0) {
        graphics.moveTo(xPos, yPos);
        continue;
      }

      if (tileXScale(i) > this.tilesetInfo.max_pos[0]) {
        // this data is in the last tile and extends beyond the length
        // of the coordinate system
        break;
      }


      if (logScaling && tileValues[i] === 0)
      // if we're using log scaling and there's a 0 value, we shouldn't draw it
      // because it's invalid
      { graphics.moveTo(xPos, yPos); } else { graphics.lineTo(xPos, yPos); }
    }
  }

  setPosition(newPosition) {
    super.setPosition(newPosition);

    this.pMain.position.y = this.position[1];
    this.pMain.position.x = this.position[0];
  }

  zoomed(newXScale, newYScale) {
    this.xScale(newXScale);
    this.yScale(newYScale);

    this.refreshTiles();

    this.draw();
  }

  superSVG() {
    /*
     * Bypass this track's exportSVG and call its parent's directly.
     */
    return super.exportSVG();
  }

  /**
   * Export an SVG representation of this track
   *
   * @returns {[DOMNode,DOMNode]} The two returned DOM nodes are both SVG
   * elements [base,track]. Base is a parent which contains track as a
   * child. Track is clipped with a clipping rectangle contained in base.
   *
   */
  exportSVG() {
    let track = null;
    let base = null;

    if (super.exportSVG) {
      [base, track] = super.exportSVG();
    } else {
      base = document.createElement('g');
      track = base;
    }

    base.setAttribute('class', 'exported-line-track');
    const output = document.createElement('g');

    track.appendChild(output);
    output.setAttribute('transform',
      `translate(${this.position[0]},${this.position[1]})`);

    const stroke = this.options.lineStrokeColor ? this.options.lineStrokeColor : 'blue';

    for (const tile of this.visibleAndFetchedTiles()) {
      const g = document.createElement('path');
      g.setAttribute('fill', 'transparent');
      g.setAttribute('stroke', stroke);
      let d = `M${tile.lineXValues[0]} ${tile.lineYValues[0]}`;
      for (let i = 0; i < tile.lineXValues.length; i++) {
        d += `L${tile.lineXValues[i]} ${tile.lineYValues[i]}`;
      }
      g.setAttribute('d', d);
      output.appendChild(g);
    }

    const gAxis = document.createElement('g');
    gAxis.setAttribute('id', 'axis');

    // append the axis to base so that it's not clipped
    base.appendChild(gAxis);
    gAxis.setAttribute('transform',
      `translate(${this.axis.pAxis.position.x}, ${this.axis.pAxis.position.y})`);

    // add the axis to the export
    if (
      this.options.axisPositionHorizontal === 'left' ||
      this.options.axisPositionVertical === 'top'
    ) {
      // left axis are shown at the beginning of the plot
      const gDrawnAxis = this.axis.exportAxisLeftSVG(this.valueScale, this.dimensions[1]);
      gAxis.appendChild(gDrawnAxis);
    } else if (
      this.options.axisPositionHorizontal === 'right' ||
      this.options.axisPositionVertical === 'bottom'
    ) {
      const gDrawnAxis = this.axis.exportAxisRightSVG(this.valueScale, this.dimensions[1]);
      gAxis.appendChild(gDrawnAxis);
    }

    return [base, track];
  }
}

export default HorizontalLine1DPixiTrack;
