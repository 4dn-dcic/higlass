import PropTypes from 'prop-types';
import React from 'react';
import { brushX } from 'd3-brush';
import { select, event } from 'd3-selection';
import slugid from 'slugid';

import ListWrapper from './ListWrapper';
import HorizontalItem from './HorizontalItem';
import SortableList from './SortableList';

// Utils
import { genomeLociToPixels, or, sum } from './utils';

// Configs
import { IS_TRACK_RANGE_SELECTABLE } from './configs';

// Styles
import styles from '../styles/HorizontalTiledPlot.module.scss'; // eslint-disable-line no-unused-vars
import stylesPlot from '../styles/TiledPlot.module.scss'; // eslint-disable-line no-unused-vars
import stylesTrack from '../styles/Track.module.scss'; // eslint-disable-line no-unused-vars


export class HorizontalTiledPlot extends React.Component {
  constructor(props) {
    super(props);

    this.brushBehavior = brushX(true)
      .on('start', this.brushStarted.bind(this))
      .on('brush', this.brushed.bind(this))
      .on('end', this.brushedEnded.bind(this));
  }

  /* -------------------------- Life Cycle Methods -------------------------- */

  componentDidMount() {
    if (this.props.isRangeSelectionActive) {
      this.addBrush();
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    if (this.rangeSelectionTriggered) {
      this.rangeSelectionTriggered = false;
      return this.state !== nextState;
    } else if (this.props.rangeSelection !== nextProps.rangeSelection) {
      if (this.props.chromInfo) {
        this.moveBrush(
          nextProps.rangeSelection[0] ?
            genomeLociToPixels(
              nextProps.rangeSelection[0], this.props.chromInfo,
            ) :
            null,
        );
      }
      return this.state !== nextState;
    }
    return true;
  }

  componentDidUpdate() {
    if (this.props.isRangeSelectionActive) {
      this.addBrush();
    } else {
      this.removeBrush();
    }
  }

  /* ---------------------------- Custom Methods ---------------------------- */

  addBrush() {
    if (!this.brushEl || this.brushElAddedBefore === this.brushEl) { return; }

    if (this.brushElAddedBefore) {
      // Remove event listener on old element to avoid memory leaks
      this.brushElAddedBefore.on('.brush', null);
    }

    this.brushEl.call(this.brushBehavior);
    this.brushElAddedBefore = this.brushEl;
  }

  brushed() {
    // Need to reassign variable to check after reset
    const rangeSelectionMoved = this.rangeSelectionMoved;
    this.rangeSelectionMoved = false;

    if (
      !event.sourceEvent ||
      !this.props.onRangeSelection ||
      rangeSelectionMoved
    ) return;

    this.rangeSelectionTriggered = true;
    this.props.onRangeSelection(event.selection);
  }

  brushStarted() {
    if (!event.sourceEvent || !event.selection) return;

    this.props.onRangeSelectionStart();
  }

  brushedEnded() {
    if (!event.selection && this.props.is1dRangeSelection) {
      this.rangeSelectionTriggered = true;
      this.props.onRangeSelectionEnd();
    }
  }

  moveBrush(rangeSelection) {
    if (!this.brushEl) { return; }

    const relRange = rangeSelection ? [
      this.props.scale(rangeSelection[0]),
      this.props.scale(rangeSelection[1]),
    ] : null;

    this.rangeSelectionMoved = true;
    this.brushEl.call(this.brushBehavior.move, relRange);
  }

  removeBrush() {
    if (this.brushElAddedBefore) {
      // Reset brush selection
      this.brushElAddedBefore.call(
        this.brushBehavior.move,
        null,
      );

      // Remove brush behavior
      this.brushElAddedBefore.on('.brush', null);
      this.brushElAddedBefore = undefined;

      this.props.onRangeSelectionEnd();
    }
  }

  /* ------------------------------ Rendering ------------------------------- */

  render() {
    const height = this.props.tracks.map(x => x.height).reduce(sum, 0);

    const isBrushable = this.props.tracks
      .map(track => IS_TRACK_RANGE_SELECTABLE(track))
      .reduce(or, false);

    const rangeSelectorClass = this.props.isRangeSelectionActive ?
      'stylesTrack.track-range-selection-active' :
      'stylesTrack.track-range-selection';

    return (
      <div styleName="styles.horizontal-tiled-plot">
        {isBrushable &&
          <svg
            ref={el => this.brushEl = select(el)}
            style={{
              height,
              width: this.props.width,
            }}
            styleName={rangeSelectorClass}
            xmlns="http://www.w3.org/2000/svg"
          />
        }
        <ListWrapper
          className={`${stylesPlot.list} ${stylesPlot.stylizedList}`}
          component={SortableList}
          editable={this.props.editable}
          handleConfigTrack={this.props.handleConfigTrack}
          handleResizeTrack={this.props.handleResizeTrack}
          height={height}
          helperClass={stylesPlot.stylizedHelper}
          itemClass={stylesPlot.stylizedItem}
          itemReactClass={HorizontalItem}
          items={this.props.tracks.map(d => ({
            configMenuVisible: d.uid === this.props.configTrackMenuId,
            uid: d.uid || slugid.nice(),
            width: this.props.width,
            height: d.height,
            value: d.value,
          }))}
          onAddSeries={this.props.onAddSeries}
          onCloseTrack={this.props.onCloseTrack}
          onCloseTrackMenuOpened={this.props.onCloseTrackMenuOpened}
          onConfigTrackMenuOpened={this.props.onConfigTrackMenuOpened}
          onSortEnd={this.props.handleSortEnd}
          referenceAncestor={this.props.referenceAncestor}
          resizeHandles={this.props.resizeHandles}
          useDragHandle={true}
          width={this.props.width}
        />
      </div>
    );
  }
}

HorizontalTiledPlot.propTypes = {
  configTrackMenuId: PropTypes.string,
  chromInfo: PropTypes.object,
  editable: PropTypes.bool,
  handleConfigTrack: PropTypes.func,
  handleResizeTrack: PropTypes.func,
  handleSortEnd: PropTypes.func,
  is1dRangeSelection: PropTypes.bool,
  isRangeSelectionActive: PropTypes.bool,
  onAddSeries: PropTypes.func,
  onCloseTrack: PropTypes.func,
  onCloseTrackMenuOpened: PropTypes.func,
  onConfigTrackMenuOpened: PropTypes.func,
  onRangeSelection: PropTypes.func,
  onRangeSelectionEnd: PropTypes.func,
  onRangeSelectionStart: PropTypes.func,
  rangeSelection: PropTypes.array,
  referenceAncestor: PropTypes.func,
  resizeHandles: PropTypes.object,
  scale: PropTypes.func,
  tracks: PropTypes.array,
  width: PropTypes.number,
};

export default HorizontalTiledPlot;
