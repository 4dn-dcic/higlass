import { Tiled1DPixiTrack } from './Tiled1DPixiTrack';
import { tileProxy } from './services';
import { AxisPixi } from './AxisPixi';

class HorizontalTiled1DPixiTrack extends Tiled1DPixiTrack {
  constructor(
      scene,
      dataConfig,
      handleTilesetInfoReceived,
      option,
      animate,
      onValueScaleChanged,
  ) {
    super(
      scene,
      dataConfig,
      handleTilesetInfoReceived,
      option,
      animate,
      onValueScaleChanged);
    this.axis = new AxisPixi(this);
    this.pBase.addChild(this.axis.pAxis);
  }
  calculateZoomLevel() {
    // offset by 2 because 1D tiles are more dense than 2D tiles
    // 1024 points per tile vs 256 for 2D tiles
    const xZoomLevel = tileProxy.calculateZoomLevel(this._xScale,
      this.tilesetInfo.min_pos[0],
      this.tilesetInfo.max_pos[0]) - 2;

    let zoomLevel = Math.min(xZoomLevel, this.maxZoom);
    zoomLevel = Math.max(zoomLevel, 0);

    return zoomLevel;
  }

  /**
   * Which scale should we use for calculating tile positions?
   *
   * Horizontal tracks should use the xScale and vertical tracks
   * should use the yScale
   *
   * This function should be overwritten by HorizontalTiled1DPixiTrack.js
   * and VerticalTiled1DPixiTrack.js
   */
  relevantScale() {
    return this._xScale;
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
}

export default HorizontalTiled1DPixiTrack;
