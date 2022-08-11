/*
 * Copyright 2021 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
import {
  createTag,
} from '../../scripts/scripts.js';

function nodeIsBefore(node, otherNode) {
  // eslint-disable-next-line no-bitwise
  const forward = node.compareDocumentPosition(otherNode)
    & Node.DOCUMENT_POSITION_FOLLOWING;
  return (!!forward);
}

// eslint-disable-next-line import/prefer-default-export
export class Masonry {
  constructor($block, cells) {
    this.$block = $block;
    this.cells = cells;
    this.columns = [];
    this.nextColumn = null;
    this.startResizing = 0;
    this.columnWidth = 0;
    this.debug = false;
    this.fillToHeight = 0;
  }

  // set up fresh grid if necessary
  setupColumns() {
    let result = 1;
    const colWidth = this.$block.classList.contains('sixcols') || this.$block.classList.contains('fullwidth') ? 175 : 264;
    const width = this.$block.offsetWidth;
    if (!width) {
      return 0;
    }
    const usp = new URLSearchParams(window.location.search);
    if (usp.has('debug-template-list')) {
      this.debug = true;
    }
    this.columnWidth = colWidth - (colWidth === 175 ? 10 : 4); // padding/margin adjustment
    let numCols = Math.floor(width / colWidth);
    if (numCols < 1) numCols = 1;
    if (numCols !== this.$block.querySelectorAll('.masonry-col').length) {
      this.$block.innerHTML = '';
      this.columns = [];
      for (let i = 0; i < numCols; i += 1) {
        const $column = createTag('div', { class: 'masonry-col' });
        this.columns.push({
          outerHeight: 0,
          $column,
        });
        this.$block.appendChild($column);
      }
      result = 2;
    }
    this.nextColumn = null;
    return result;
  }

  // calculate least tallest column to add next cell to
  getNextColumn(height) {
    const columnIndex = this.columns.indexOf(this.nextColumn);
    const nextColumnIndex = (columnIndex + 1) % this.columns.length;
    const minOuterHeight = Math.min(...this.columns.map((col) => col.outerHeight));
    this.nextColumn = this.columns[nextColumnIndex];
    if (!nextColumnIndex) {
      const maxOuterHeight = Math.max(...this.columns.map((col) => col.outerHeight));
      if (!this.fillToHeight) {
        if (maxOuterHeight - minOuterHeight >= height - 50) {
          this.fillToHeight = maxOuterHeight;
          // console.log('entering fill mode');
        }
      }
    }

    if (this.fillToHeight) {
      if (this.fillToHeight - minOuterHeight >= height - 50) {
        // console.log(this.fillToHeight, minOuterHeight, height, $cell);
        this.nextColumn = this.columns.find((col) => col.outerHeight === minOuterHeight);
      } else {
        // console.log(this.fillToHeight, minOuterHeight, height, $cell);
        this.fillToHeight = 0;
        [this.nextColumn] = this.columns;
        // console.log('no more fill mode');
      }
    }
    return this.nextColumn || this.columns[0];
  }

  // add cell to next column
  addCell($cell) {
    let mediaHeight = 0;
    let mediaWidth = 0;
    let calculatedHeight = 0;

    const img = $cell.querySelector('picture > img');
    if (img) {
      mediaHeight = img.naturalHeight;
      mediaWidth = img.naturalWidth;
      calculatedHeight = ((this.columnWidth) / mediaWidth) * mediaHeight;
    }
    const video = $cell.querySelector('video');
    if (video) {
      mediaHeight = video.videoHeight;
      mediaWidth = video.videoWidth;
      calculatedHeight = ((this.columnWidth) / mediaWidth) * mediaHeight;
    }
    if (this.debug) {
      // eslint-disable-next-line no-console
      console.log($cell.offsetHeight, calculatedHeight, $cell);
    }

    const column = this.getNextColumn(calculatedHeight);
    column.$column.append($cell);
    $cell.classList.add('appear');

    column.outerHeight += calculatedHeight;

    if (!calculatedHeight && $cell.classList.contains('placeholder') && $cell.style.height) {
      column.outerHeight += +$cell.style.height.split('px')[0] + 20;
    }

    const $btnC = $cell.querySelector(':scope > div:nth-of-type(2)');
    if ($btnC) $btnC.classList.add('button-container');

    /* set tab index and event listeners */
    if (this.cells[0] === $cell) {
      /* first cell focus handler */
      $cell.addEventListener('focus', (event) => {
        if (event.relatedTarget) {
          const backward = nodeIsBefore(event.target, event.relatedTarget);
          if (backward) this.cells[this.cells.length - 1].focus();
        }
      });
      /* first cell blur handler */
      $cell.addEventListener('blur', (event) => {
        if (!event.relatedTarget.classList.contains('template')) {
          const forward = nodeIsBefore(event.target, event.relatedTarget);
          if (forward) {
            if (this.cells.length > 1) {
              this.cells[1].focus();
            }
          }
        }
      });
    } else {
      /* all other cells get custom blur handler and no tabindex */
      $cell.setAttribute('tabindex', '-1');
      $cell.addEventListener('blur', (event) => {
        if (event.relatedTarget) {
          const forward = nodeIsBefore(event.target, event.relatedTarget);
          const backward = !forward;
          const index = this.cells.indexOf($cell);
          if (forward) {
            if (index < this.cells.length - 1) {
              this.cells[index + 1].focus();
            }
          }
          if (backward) {
            if (index > 0) {
              this.cells[index - 1].focus();
            }
          }
        }
      });
    }
  }

  // distribute cells to columns
  draw(cells) {
    if (!cells) {
      const setup = this.setupColumns();
      if (setup === 1) {
        // no redrawing needed
        return;
      } else if (setup === 0) {
        // setup incomplete, try again
        window.setTimeout(() => {
          this.draw(cells);
        }, 200);
        return;
      }
    }
    const workList = [...(cells || this.cells)];

    while (workList.length > 0) {
      for (let i = 0; i < 5 && i < workList.length; i += 1) {
        const $cell = workList[i];
        const $image = $cell.querySelector(':scope picture > img');
        if ($image) $image.setAttribute('loading', 'eager');
      }
      const $cell = workList[0];
      const $image = $cell.querySelector(':scope picture > img');
      if ($image && !$image.complete) {
        // continue when image is loaded
        $image.addEventListener('load', () => {
          this.draw(workList);
        });

        return;
      }
      const $video = $cell.querySelector('video');
      if ($video && $video.readyState === 0) {
        // continue when video is loaded
        $video.addEventListener('loadedmetadata', () => {
          this.draw(workList);
        });
        return;
      }
      this.addCell($cell);
      // remove already processed cell
      workList.shift();
    }
    if (workList.length > 0) {
      // draw rest
      this.draw(workList);
    } else {
      this.$block.classList.add('template-list-complete');
    }
  }
}
