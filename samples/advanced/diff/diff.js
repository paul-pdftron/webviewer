// @link WebViewerInstance: https://www.pdftron.com/api/web/WebViewerInstance.html
// @link WebViewerInstance.loadDocument: https://www.pdftron.com/api/web/WebViewerInstance.html#loadDocument__anchor

// @link DocumentViewer: https://www.pdftron.com/api/web/CoreControls.DocumentViewer.html
// @link DocumentViewer.getViewportRegionRect: https://www.pdftron.com/api/web/CoreControls.DocumentViewer.html#getViewportRegionRect__anchor
// @link DocumentViewer.getCurrentPage: https://www.pdftron.com/api/web/CoreControls.DocumentViewer.html#getCurrentPage__anchor

// @link CoreControls: https://www.pdftron.com/api/web/CoreControls.html
// @link PartRetrievers: https://www.pdftron.com/api/web/PartRetrievers.html

// @link Document: https://www.pdftron.com/api/web/CoreControls.Document.html
// @link Document.loadAsync: https://www.pdftron.com/api/web/CoreControls.Document.html#loadAsync__anchor
// @link Document.cancelLoadCanvas: https://www.pdftron.com/api/web/CoreControls.Document.html#cancelLoadCanvas__anchor
/* global saveAs */
(function(exports) {
  CoreControls.setWorkerPath('../../../lib/core');

  let originalScroller = null;
  let scrollTimeout;

  let slider;

  let pdfWorkerTransportPromise;
  let officeWorkerTransportPromise;
  const currentLoadCanvas = {};
  const lastRenderRect = {};
  const viewers = [];
  const instances = {};

  const DEFAULT_TRANSFORMATION_MATRIX = {
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    e: 0,
    f: 0,
  };

  // Used to figure out smallest scale value > 0
  // so that canvase won't appear inverted
  let minScaleVal;

  const PANEL_IDS = {
    LEFT_PANEL: 'leftPanel',
    MID_PANEL: 'middlePanel',
    RIGHT_PANEL: 'rightPanel',
  };

  const VIEWER_IDS = [{ panel: PANEL_IDS.LEFT_PANEL }, { panel: PANEL_IDS.MID_PANEL }, { panel: PANEL_IDS.RIGHT_PANEL }];

  const TRANSFORMATION_DELTA = 1;

  // Keeps track of the original canvas for each page
  // so that it can be retrieved easily when applying a transformation via nudge tool
  let originalRightPanelCanvases = [];

  let initialRotation;

  let line1Start;
  let line1End;
  let line2Start;
  let line2End;
  let alignedCanvasDrawing;
  let firstDocIndex;
  let secondDocIndex;
  let shouldDiff = true;

  // Normally setTimout(...., 0) will work, however since IE can be slow, use a longer timeout to give more time for WebViewer to perform operations
  const timeoutForIE = 50;

  const hasPointsForAlignment = () => {
    return line1Start !== undefined && line1End !== undefined && line2Start !== undefined && line2End !== undefined;
  };

  const getDocumentOpacity = () => {
    let leftDocOpacity = 1;
    let rightDocOpacity = 1;

    if (exports.DiffOverlaySlider.isEnabled()) {
      const value = exports.DiffOverlaySlider.getValue();
      leftDocOpacity = 1 - value;
      rightDocOpacity = value;
    }

    return {
      leftDocOpacity,
      rightDocOpacity,
    };
  };

  const allowViewPortRendering = allow => {
    const midPanelInstance = instances[PANEL_IDS.MID_PANEL].instance;
    const docViewer = midPanelInstance.docViewer;
    if (allow) {
      docViewer.setViewportRenderMode(true);
      midPanelInstance.setMaxZoomLevel('9999%');
    } else {
      const wasInViewportRender = docViewer.isInViewportRenderMode();
      docViewer.setViewportRenderMode(false);
      const maxZoomLvl = 5;
      midPanelInstance.setMaxZoomLevel(maxZoomLvl);
      if (midPanelInstance.getZoomLevel() > maxZoomLvl) {
        midPanelInstance.setZoomLevel(maxZoomLvl);
      } else if (wasInViewportRender) {
        docViewer.updateView();
      }
    }
  };

  const nudgeCanvas = (pageIndex, canvasContext) => {
    const transformationToApply = exports.NudgeTool.getPageTransformationState(pageIndex);
    if (transformationToApply) {
      const instance = instances[PANEL_IDS.MID_PANEL].instance;
      const newScale = exports.DiffUtil.getScaleForCanvasFromNudgeTool(transformationToApply.scaling);
      if (newScale >= 0) {
        minScaleVal = newScale;
      }
      let pageMatrix = exports.DiffAlignment.retrievePageMatrix(instance, pageIndex);
      pageMatrix = exports.DiffUtil.decomposeMatrix(pageMatrix);
      // shift it if necessary so that we are always rotating around the point "(0,0)" of the rotated canvas
      canvasContext.translate(pageMatrix.translateX, pageMatrix.translateY);
      const transformedCoords = exports.DiffUtil.computeNewCoordsFromZoomRotation(
        instance.docViewer.getZoom(),
        instance.docViewer.getRotation(),
        transformationToApply.horizontalTranslation,
        transformationToApply.verticalTranslation
      );
      canvasContext.translate(transformedCoords[0], transformedCoords[1]);
      canvasContext.rotate((transformationToApply.rotation * Math.PI) / 180);
      canvasContext.scale(minScaleVal, minScaleVal);
      canvasContext.translate(-pageMatrix.translateX, -pageMatrix.translateY);
    }
    return canvasContext;
  };

  const nudgeAlignedCanvas = (pageIndex, canvasContext) => {
    const transformationToApply = exports.NudgeTool.getPageTransformationState(pageIndex);
    if (transformationToApply) {
      const newScale = exports.DiffUtil.getScaleForCanvasFromNudgeTool(transformationToApply.scaling);
      if (newScale >= 0) {
        minScaleVal = newScale;
      }
      canvasContext.translate(transformationToApply.horizontalTranslation, transformationToApply.verticalTranslation);
      canvasContext.rotate((transformationToApply.rotation * Math.PI) / 180);
      canvasContext.scale(minScaleVal, minScaleVal);
    }
    return canvasContext;
  };

  const renderMidPanelOverlay = (firstDocIndex, secondDocIndex, middleSecondDocToDraw, desiredWidth, desiredHeight, firstDocCanvasMatrix, secondDocCanvasMatrix, shouldDiff) => {
    if (!originalRightPanelCanvases[secondDocIndex]) {
      return;
    }

    const midPanelFirstDocCanvas = instances[PANEL_IDS.MID_PANEL].documentContainer.querySelector(`.canvas${firstDocIndex + 1}`);
    if (!midPanelFirstDocCanvas) {
      return;
    }

    const diffCanvas = firstDocCanvas => {
      const canvasMultiplier = instances[PANEL_IDS.MID_PANEL].instance.iframeWindow.utils.getCanvasMultiplier();

      const enlargedMidPanelSecondDocCanvas = exports.DiffUtil.createCanvas(desiredWidth, desiredHeight, canvasMultiplier);
      let enlargedMidPanelSecondDocCanvasCtx = enlargedMidPanelSecondDocCanvas.getContext('2d');
      enlargedMidPanelSecondDocCanvasCtx.setTransform(
        secondDocCanvasMatrix.a,
        secondDocCanvasMatrix.b,
        secondDocCanvasMatrix.c,
        secondDocCanvasMatrix.d,
        secondDocCanvasMatrix.e,
        secondDocCanvasMatrix.f
      );
      if (hasPointsForAlignment()) {
        enlargedMidPanelSecondDocCanvasCtx = nudgeAlignedCanvas(firstDocIndex, enlargedMidPanelSecondDocCanvasCtx);
      } else {
        enlargedMidPanelSecondDocCanvasCtx = nudgeCanvas(firstDocIndex, enlargedMidPanelSecondDocCanvasCtx);
      }
      enlargedMidPanelSecondDocCanvasCtx.drawImage(middleSecondDocToDraw, 0, 0);

      const enlargedMidPanelFirstDocCanvas = exports.DiffUtil.createCanvas(desiredWidth, desiredHeight, canvasMultiplier);
      const enlargedMidPanelFirstDocCanvasCtx = enlargedMidPanelFirstDocCanvas.getContext('2d');
      enlargedMidPanelFirstDocCanvasCtx.setTransform(firstDocCanvasMatrix.a, firstDocCanvasMatrix.b, firstDocCanvasMatrix.c, firstDocCanvasMatrix.d, firstDocCanvasMatrix.e, firstDocCanvasMatrix.f);
      enlargedMidPanelFirstDocCanvasCtx.drawImage(firstDocCanvas, 0, 0);

      const midPanelFirstDocImgData = enlargedMidPanelFirstDocCanvasCtx.getImageData(0, 0, enlargedMidPanelFirstDocCanvas.width, enlargedMidPanelFirstDocCanvas.height).data;

      let result;
      const documentOpacity = getDocumentOpacity();
      const firstDocOpacity = documentOpacity.leftDocOpacity;
      const secondDocOpacity = documentOpacity.rightDocOpacity;
      if (shouldDiff) {
        result = exports.DiffUtil.diffPixels(enlargedMidPanelSecondDocCanvas, enlargedMidPanelFirstDocCanvas, midPanelFirstDocImgData, firstDocOpacity, secondDocOpacity);
      } else {
        result = exports.DiffUtil.overlayPixels(enlargedMidPanelSecondDocCanvas, enlargedMidPanelFirstDocCanvas, midPanelFirstDocImgData, firstDocOpacity, secondDocOpacity);
      }
      result.style.position = 'absolute';
      // copy over left and top so that on zoom the diffed canvas is still shown properly
      result.style.left = firstDocCanvas.style.left;
      result.style.top = firstDocCanvas.style.top;
      result.style.width = `${desiredWidth / canvasMultiplier}px`;
      result.style.height = `${desiredHeight / canvasMultiplier}px`;
      result.style.zIndex = 25;
      result.style.backgroundColor = 'white';
      result.classList.add('canvasOverlay');

      const existingOverlay = midPanelFirstDocCanvas.parentNode.querySelector('.canvasOverlay');
      if (existingOverlay) {
        existingOverlay.parentNode.removeChild(existingOverlay);
      }
      midPanelFirstDocCanvas.parentNode.appendChild(result);
    };
    if (hasPointsForAlignment()) {
      // load whole canvas for that alignment and diffing can be done correctly
      // if zoomed in a lot, midPanelFirstDocCanvas will only give the view port of the document container
      instances[PANEL_IDS.LEFT_PANEL].instance.docViewer.getDocument().loadCanvasAsync({
        pageNumber: firstDocIndex + 1,
        pageRotation: instances[PANEL_IDS.MID_PANEL].instance.docViewer.getRotation(),
        getZoom: () => {
          return instances[PANEL_IDS.MID_PANEL].instance.docViewer.getZoom();
        },
        drawComplete: firstDocCanvas => {
          diffCanvas(firstDocCanvas);
        },
      });
    } else {
      diffCanvas(midPanelFirstDocCanvas);
    }
  };

  const createDiffedAlignedCanvas = (firstDocIndex, secondDocIndex, canvasToAlign) => {
    const midPanelFirstDocCanvas = instances[PANEL_IDS.MID_PANEL].documentContainer.querySelector(`.canvas${firstDocIndex + 1}`);
    if (!midPanelFirstDocCanvas) {
      return;
    }

    const canvasMultiplier = instances[PANEL_IDS.MID_PANEL].instance.iframeWindow.utils.getCanvasMultiplier();

    const pageMatrix = exports.DiffAlignment.retrievePageMatrix(instances[PANEL_IDS.MID_PANEL].instance, firstDocIndex);
    const canvasForLineAlignment = exports.DiffAlignment.createCanvasForLineAlignment(
      canvasToAlign.width,
      canvasToAlign.height,
      pageMatrix,
      line2Start,
      line2End,
      line1Start,
      line1End,
      canvasMultiplier
    );
    const canvasMatrix = canvasForLineAlignment.getContext('2d').getTransform();

    // Construct the minimum canvas size needed to hold the image from the left doc and right doc
    const matrix = [
      [canvasMatrix.a, canvasMatrix.c, canvasMatrix.e],
      [canvasMatrix.b, canvasMatrix.d, canvasMatrix.f],
      [0, 0, 1],
    ];

    // [minX, maxX, minY, maxY]
    const alignedCanvasBoundingBox = exports.DiffAlignment.createBoundingBoxFromTransformationMatrix(matrix, 0, 0, canvasToAlign.width, canvasToAlign.height);

    let minX = Math.min(0, alignedCanvasBoundingBox[0]);
    let maxX = Math.max(midPanelFirstDocCanvas.width, alignedCanvasBoundingBox[2]);
    let minY = Math.min(0, alignedCanvasBoundingBox[1]);
    let maxY = Math.max(midPanelFirstDocCanvas.height, alignedCanvasBoundingBox[3]);
    // Its possible that x,y coords of the bounding box are negative
    // If they are negative translate all coordinates such that the top left corner is at 0,0
    const deltaX = -1 * minX;
    const deltaY = -1 * minY;

    minX += deltaX;
    maxX += deltaX;

    minY += deltaY;
    maxY += deltaY;

    // If a translation is done, account for that translation in the transformation matrix as well
    const secondDocMatrix = canvasMatrix;
    secondDocMatrix.e += deltaX;
    secondDocMatrix.f += deltaY;

    const firstDocMatrix = {
      a: 1,
      b: 0,
      c: 0,
      d: 1,
      e: deltaX,
      f: deltaY,
    };

    renderMidPanelOverlay(firstDocIndex, secondDocIndex, canvasToAlign, maxX, maxY, firstDocMatrix, secondDocMatrix, shouldDiff);
  };

  const updatePage = (doc, documentContainer, instance, pageIndex) => {
    const firstDocCanvas = documentContainer.querySelector(`.canvas${pageIndex + 1}`);
    if (!firstDocCanvas || pageIndex > doc.getPageCount() - 1) {
      return;
    }
    const isViewportRender = firstDocCanvas.style.left !== '';
    return doc.loadCanvasAsync({
      pageNumber: pageIndex + 1,
      pageRotation: instance.docViewer.getRotation(),
      getZoom: () => {
        return instance.docViewer.getZoom();
      },
      drawComplete: pageCanvas => {
        originalRightPanelCanvases[pageIndex] = pageCanvas;
        if (!hasPointsForAlignment()) {
          renderMidPanelOverlay(pageIndex, pageIndex, pageCanvas, pageCanvas.width, pageCanvas.height, DEFAULT_TRANSFORMATION_MATRIX, DEFAULT_TRANSFORMATION_MATRIX, shouldDiff);
        }
        currentLoadCanvas[pageIndex] = null;
        if (initialRotation === undefined || initialRotation === null) {
          initialRotation = instance.docViewer.getCompleteRotation(pageIndex + 1);
        }
      },
      renderRect: isViewportRender ? Object.assign({}, lastRenderRect[pageIndex]) : undefined,
    });
  };

  const update = (panel, pageIndex) => {
    const { newDoc, documentContainer, instance } = instances[panel];

    if (currentLoadCanvas[pageIndex]) {
      newDoc.cancelLoadCanvas(currentLoadCanvas[pageIndex]);
    }
    currentLoadCanvas[pageIndex] = updatePage(newDoc, documentContainer, instance, pageIndex);
  };

  // Create an instance of worker transport to share among WebViewer instances
  const getWorkerTransportPromise = path => {
    // String or file
    const filename = typeof path === 'object' ? path.name : path || '';
    const isOfficeFile = filename.endsWith('docx') || filename.endsWith('pptx') || filename.endsWith('xlsx');

    // replace with your license key here as it needs to be passed when instantiating the worker transport promise
    const licenseKey = undefined;

    // Use existing workers
    if (isOfficeFile && officeWorkerTransportPromise) {
      return officeWorkerTransportPromise;
    }

    if (!isOfficeFile && pdfWorkerTransportPromise) {
      return pdfWorkerTransportPromise;
    }

    return CoreControls.getDefaultBackendType().then(backendType => {
      if (path && isOfficeFile) {
        officeWorkerTransportPromise = CoreControls.initOfficeWorkerTransports(backendType, {}, licenseKey);

        return officeWorkerTransportPromise;
      }

      // Use PDF worker by default
      pdfWorkerTransportPromise = CoreControls.initPDFWorkerTransports(backendType, {}, licenseKey);

      return pdfWorkerTransportPromise;
    });
  };

  const loadDocument = (panel, docLocation) => {
    const CoreControls = instances[panel].instance.CoreControls;

    CoreControls.createDocument(docLocation, { workerTransportPromise: getWorkerTransportPromise(docLocation) }).then(newDoc => {
      instances[panel] = Object.assign({}, instances[panel], { newDoc });
    });
  };

  const openDoc = (panel, firstPdf, secondPdf) => {
    const instance = instances[panel].instance;
    instance.loadDocument(firstPdf);

    if (panel === PANEL_IDS.MID_PANEL && secondPdf) {
      loadDocument(panel, secondPdf);
    }
  };

  // Synchronizes zooming of WebViewer instances
  const syncZoom = zoom => {
    viewers.forEach(item => {
      const instance = instances[item.panel].instance;

      if (instance.getZoomLevel() !== zoom) {
        instance.setZoomLevel(zoom);
      }
    });
  };

  // Synchronizes scrolling of WebViewer instances
  const syncScrolls = (scrollLeft, scrollTop) => {
    viewers.forEach(item => {
      const documentContainer = instances[item.panel].documentContainer;

      if (!documentContainer) {
        return;
      }

      if (documentContainer.scrollLeft !== scrollLeft) {
        documentContainer.scrollLeft = scrollLeft;
      }

      if (documentContainer.scrollTop !== scrollTop) {
        documentContainer.scrollTop = scrollTop;
      }
    });
  };

  // Synchronizes rotation of the page
  const syncRotation = rotation => {
    viewers.forEach(item => {
      const instance = instances[item.panel].instance;

      if (instance.docViewer.getRotation() !== rotation) {
        instance.docViewer.setRotation(rotation);
      }
    });
  };

  const syncPageNumber = pageNumber => {
    viewers.forEach(item => {
      const instance = instances[item.panel].instance;

      if (instance.docViewer.getCurrentPage() !== pageNumber) {
        instance.docViewer.setCurrentPage(pageNumber);
      }
    });
  };

  const alignLineSegments = (line1StartPoint, line1EndPoint, line2StartPoint, line2EndPoint, leftPageIndexToAlign, rightPageIndexToAlign) => {
    line1Start = line1StartPoint;
    line1End = line1EndPoint;
    line2Start = line2StartPoint;
    line2End = line2EndPoint;
    firstDocIndex = leftPageIndexToAlign;
    secondDocIndex = rightPageIndexToAlign;

    const canvas = originalRightPanelCanvases[rightPageIndexToAlign];
    if (!canvas) {
      return;
    }

    instances[PANEL_IDS.MID_PANEL].newDoc.loadCanvasAsync({
      pageNumber: secondDocIndex + 1,
      // load canvas with pdf at 0 degrees of rotation so that it can be applied to returned canvas
      // else rotation will be applied twice
      pageRotation: (4 - initialRotation) % 4,
      drawComplete: pageCanvas => {
        // set view port render mode to be false for smooth scrolling at high zoom level
        // likewise for setting max zoom level
        allowViewPortRendering(false);
        alignedCanvasDrawing = pageCanvas;
        // the middle panel canvas will be diffed as a side effect
        exports.NudgeTool.setPageTransformationState(firstDocIndex, 0, 0, exports.DiffUtil.getScaleStateForNudgeToolFromCanvas(1), 0);
      },
    });
  };

  // Create an instance of WebViewer
  const setupViewer = item => {
    return new Promise(resolve => {
      const viewerElement = document.getElementById(item.panel);

      WebViewer(
        {
          path: '../../../lib',
          css: './nudge-tool.css',
          // share a single instance of the worker transport
          workerTransportPromise: getWorkerTransportPromise(item.pdf),
          initialDoc: item.pdf || null,
          // turn on to enable snapping
          // fullAPI: true,
          disabledElements: ['layoutButtons', 'pageTransitionButtons', 'toolsButton', 'annotationPopup', 'panToolButton', 'linkButton', 'toolsOverlayCloseButton'],
        },
        viewerElement
      ).then(instance => {
        samplesSetup(instance);
        const docViewer = instance.docViewer;
        instance.disableFeatures([instance.Feature.Annotations]);
        instance.setToolMode('AnnotationEdit');
        const documentContainer = viewerElement.querySelector('iframe').contentDocument.querySelector('.DocumentContainer');
        docViewer.on('documentLoaded', () => {
          instance.setLayoutMode(instance.LayoutMode.Single);
          instance.setFitMode(instance.FitMode.FitWidth);
        });

        // Sync all WebViewer instances when scroll changes
        documentContainer.onscroll = () => {
          if (!hasPointsForAlignment() && (!originalScroller || originalScroller === documentContainer)) {
            originalScroller = documentContainer;
            syncScrolls(documentContainer.scrollLeft, documentContainer.scrollTop);
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
              originalScroller = null;
            }, timeoutForIE);
          }
        };

        // Update zoom value of the WebViewer instances
        docViewer.on('zoomUpdated', zoom => {
          if (!hasPointsForAlignment()) {
            // zoom events will also trigger a scroll event
            // set the original scroll to be the same panel that first triggers the zoom event
            // so that scroll events are handled properly and in the correct order
            // some browsers such as Chrome do not respect the scroll event ordering correctly
            if (!originalScroller) {
              originalScroller = documentContainer;
              clearTimeout(scrollTimeout);
              scrollTimeout = setTimeout(() => {
                originalScroller = null;
              }, timeoutForIE);
            }
            syncZoom(zoom, documentContainer);
          }
        });

        // Update rotation value of the WebViewer instances
        docViewer.on('rotationUpdated', rotation => {
          if (!hasPointsForAlignment()) {
            syncRotation(rotation);
          }
        });

        docViewer.on('pageNumberUpdated', pageNumber => {
          if (!exports.DiffAlignmentTool.isInAlignmentMode()) {
            syncPageNumber(pageNumber);
          } else {
            // we are in alignment mode
            // sync up left and middle panel as they are the same document
            if (item.panel !== PANEL_IDS.RIGHT_PANEL) {
              viewers.forEach(viewerItem => {
                const instance = instances[viewerItem.panel].instance;
                if (instance.docViewer.getCurrentPage() !== pageNumber && viewerItem.panel !== PANEL_IDS.RIGHT_PANEL) {
                  instance.docViewer.setCurrentPage(pageNumber);
                }
              });
            }
          }
        });

        instance.annotManager.on('annotationChanged', (annotations, action) => {
          if (action === 'add') {
            const internalAnnotations = annotations.filter(annot => annot.getInternal());
            instance.annotManager.deleteAnnotations(internalAnnotations, true, true);
          }
        });

        viewers.push(item);

        instances[item.panel] = {
          instance,
          viewerElement,
          documentContainer,
        };

        resolve();
      });
    });
  };

  const onNudgeToolStateChange = () => {
    const instance = instances[PANEL_IDS.MID_PANEL].instance;
    const currPageIndex = instance.docViewer.getCurrentPage() - 1;

    const nudgeToolState = exports.NudgeTool.getPageTransformationState(hasPointsForAlignment() ? firstDocIndex : currPageIndex);
    let totalStateValues = 0;
    // use pre-es5 as this code isn't polyfilled and it needs to work in IE11
    // eslint-disable-next-line no-restricted-syntax
    for (const key in nudgeToolState) {
      if (nudgeToolState.hasOwnProperty(key)) {
        const value = nudgeToolState[key];
        totalStateValues += value;
        if (totalStateValues !== 0) {
          break;
        }
      }
    }
    allowViewPortRendering(!hasPointsForAlignment() && totalStateValues === 0);
    if (hasPointsForAlignment()) {
      createDiffedAlignedCanvas(firstDocIndex, secondDocIndex, alignedCanvasDrawing);
    } else {
      const originalRightPanelCanvas = originalRightPanelCanvases[currPageIndex];
      if (!originalRightPanelCanvas) {
        return;
      }
      renderMidPanelOverlay(
        currPageIndex,
        currPageIndex,
        originalRightPanelCanvas,
        originalRightPanelCanvas.width,
        originalRightPanelCanvas.height,
        DEFAULT_TRANSFORMATION_MATRIX,
        DEFAULT_TRANSFORMATION_MATRIX,
        shouldDiff
      );
    }
  };

  const initializeViewers = (array, callback) => {
    const pageCompleteRenderRect = {};

    Promise.all(array.map(setupViewer)).then(() => {
      const instance = instances[PANEL_IDS.MID_PANEL].instance;

      instance.disableElements(['leftPanelButton', 'searchButton', 'searchPanel', 'searchOverlay']);

      const showDiffCheckbox = {
        type: 'customElement',
        render: () => {
          const span = document.createElement('span');
          span.style = 'display: flex; align-items: center;';
          const checkbox = document.createElement('input');
          checkbox.id = 'show-diff';
          checkbox.type = 'checkbox';
          checkbox.checked = shouldDiff;
          checkbox.addEventListener('change', () => {
            shouldDiff = !shouldDiff;
            onNudgeToolStateChange();
          });

          const label = document.createElement('label');
          label.htmlFor = 'show-diff';
          label.style = 'font-size: 9px';
          label.innerHTML = 'Show difference';

          span.appendChild(checkbox);
          span.appendChild(label);
          return span;
        },
      };

      const overlaySliderCheckboxToggle = {
        type: 'customElement',
        render: () => {
          const span = document.createElement('span');
          span.style = 'display: flex; align-items: center;';
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.id = 'enable-overlay-slider';
          exports.DiffOverlaySlider.enable(checkbox.checked);
          checkbox.addEventListener('change', () => {
            exports.DiffOverlaySlider.enable(checkbox.checked);
            slider.disabled = !exports.DiffOverlaySlider.isEnabled();
            slider.style = exports.DiffOverlaySlider.getDisabledCSSStyle();
            exports.DiffOverlaySlider.setValue(slider.value / 100);
            onNudgeToolStateChange();
          });

          const label = document.createElement('label');
          label.style = 'font-size: 9px';
          label.innerHTML = 'Enable Overlay Slider';
          label.htmlFor = 'enable-overlay-slider';
          span.appendChild(checkbox);
          span.appendChild(label);
          return span;
        },
      };

      const overlaySlider = {
        type: 'customElement',
        render: () => {
          slider = document.createElement('input');
          slider.id = 'overlay-slider';
          slider.type = 'range';
          slider.disabled = !exports.DiffOverlaySlider.isEnabled();
          slider.style = exports.DiffOverlaySlider.getDisabledCSSStyle();
          // use change event over input as its not supported in IE11 for sliders
          slider.addEventListener('change', () => {
            exports.DiffOverlaySlider.setValue(slider.value / 100);
            onNudgeToolStateChange();
          });
          return slider;
        },
      };

      instance.setHeaderItems(header => {
        const items = header.getItems();
        items.splice(items.length - 2, 0, { type: 'divider' });
        items.splice(items.length - 2, 0, overlaySliderCheckboxToggle);
        items.splice(items.length - 2, 0, { type: 'spacer' });
        items.splice(items.length - 2, 0, overlaySlider);
        items.splice(items.length - 2, 0, { type: 'divider' });
        items.splice(items.length - 2, 0, showDiffCheckbox);
        items.splice(items.length - 2, 0, { type: 'divider' });
        header.update(items);
      });

      instance.docViewer.on('pageComplete', completedPageNumber => {
        const pageIndex = completedPageNumber - 1;

        pageCompleteRenderRect[pageIndex] = lastRenderRect[pageIndex];
        update(PANEL_IDS.MID_PANEL, pageIndex);
      });

      instance.docViewer.on('beginRendering', () => {
        const pageIndex = instance.docViewer.getCurrentPage() - 1;
        lastRenderRect[pageIndex] = instance.docViewer.getViewportRegionRect(pageIndex + 1);
        if (currentLoadCanvas[pageIndex]) {
          const newDoc = instances[PANEL_IDS.MID_PANEL].newDoc;
          newDoc.cancelLoadCanvas(currentLoadCanvas[pageIndex]);
        }
      });

      instance.docViewer.on('finishedRendering', () => {
        const displayMode = instance.docViewer.getDisplayModeManager().getDisplayMode();
        const visiblePages = displayMode.getVisiblePages();

        visiblePages.forEach(pageNumber => {
          const pageIndex = pageNumber - 1;
          lastRenderRect[pageIndex] = pageCompleteRenderRect[pageIndex];
          update(PANEL_IDS.MID_PANEL, pageIndex);
        });

        if (hasPointsForAlignment()) {
          // re-align after zoom / rotation is done
          instances[PANEL_IDS.MID_PANEL].newDoc.loadCanvasAsync({
            pageNumber: secondDocIndex + 1,
            // load canvas witih pdf at 0 degrees of rotation so that it can be applied to returned canvas
            // else rotation will be applied twice
            pageRotation: (4 - initialRotation) % 4,
            drawComplete: pageCanvas => {
              createDiffedAlignedCanvas(firstDocIndex, secondDocIndex, pageCanvas);
            },
          });
        }
      });

      return callback();
    });
  };

  const initialize = (firstPdfRelPath, secondPdfRelPath) => {
    initialRotation = undefined;
    alignedCanvasDrawing = undefined;
    line1Start = undefined;
    line1End = undefined;
    line2Start = undefined;
    line2End = undefined;
    firstDocIndex = undefined;
    secondDocIndex = undefined;
    openDoc(PANEL_IDS.MID_PANEL, firstPdfRelPath, secondPdfRelPath);
    openDoc(PANEL_IDS.LEFT_PANEL, firstPdfRelPath);
    openDoc(PANEL_IDS.RIGHT_PANEL, secondPdfRelPath);

    originalRightPanelCanvases = [];
    exports.NudgeTool.resetPageTransformationStates();
    exports.DiffAlignmentTool.initializeDiffAlignmentToolHandlers(
      instances[PANEL_IDS.LEFT_PANEL].instance,
      instances[PANEL_IDS.RIGHT_PANEL].instance,
      alignLineSegments,
      () => {
        // do nothing on enter
      },
      () => {
        line1Start = undefined;
        line1End = undefined;
        line2Start = undefined;
        line2End = undefined;
        alignedCanvasDrawing = undefined;
        firstDocIndex = undefined;
        secondDocIndex = undefined;
        const instance = instances[PANEL_IDS.MID_PANEL].instance;
        const currPageIndex = instance.docViewer.getCurrentPage() - 1;
        syncPageNumber(currPageIndex + 1);
        update(PANEL_IDS.MID_PANEL, currPageIndex);
      }
    );
  };

  // Initialize WebViewer instances
  initializeViewers(VIEWER_IDS, () => {
    initialize(`${window.location.href}../../../samples/files/test_doc_1.pdf`, `${window.location.href}../../../samples/files/test_doc_2.pdf`);
    exports.NudgeTool.initNudgeTool(instances[PANEL_IDS.MID_PANEL].instance, TRANSFORMATION_DELTA, onNudgeToolStateChange);
    document.getElementById('enable-snap-mode').disabled =
      !instances[PANEL_IDS.LEFT_PANEL].instance.CoreControls.isFullPDFEnabled() && !instances[PANEL_IDS.RIGHT_PANEL].instance.CoreControls.isFullPDFEnabled();
  });

  document.getElementById('selectControl').onclick = e => {
    e.preventDefault();
    const select1 = document.getElementById('select1');
    const firstPdf = select1.options[select1.selectedIndex].value;
    const select2 = document.getElementById('select2');
    const secondPdf = select2.options[select2.selectedIndex].value;
    initialize(window.location.href + firstPdf, window.location.href + secondPdf);
  };

  document.getElementById('url-form').onsubmit = e => {
    e.preventDefault();

    const firstPdf = document.getElementById('url').value;
    const secondPdf = document.getElementById('url2').value;
    initialize(firstPdf, secondPdf);
  };

  document.getElementById('file-picker-form').onsubmit = e => {
    e.preventDefault();
    const firstPdf = document.forms['file-picker-form'][0].files[0];
    const secondPdf = document.forms['file-picker-form'][1].files[0];
    initialize(firstPdf, secondPdf);
  };

  document.getElementById('download-middle-panel-image').onclick = e => {
    e.preventDefault();
    const documentContainer = instances[PANEL_IDS.MID_PANEL].documentContainer;
    const canvasElement = documentContainer.querySelector('.canvasOverlay');
    canvasElement.toBlob(blob => {
      saveAs(blob, 'diffed-image.png');
    });
  };
})(window);
