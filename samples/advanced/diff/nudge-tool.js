(function(exports) {
  const MID_PANEL = 'middlePanel';
  const TRANSFORMATION_TYPE = {
    // some arbitrary unique values
    HORIZONTAL_TRANSLATION_INC: 'HORIZONTAL_TRANSLATION_INC',
    HORIZONTAL_TRANSLATION_DEC: 'HORIZONTAL_TRANSLATION_DEC',
    VERTICAL_TRANSLATION_INC: 'VERTICAL_TRANSLATION_INC',
    VERTICAL_TRANSLATION_DEC: 'VERTICAL_TRANSLATION_DEC',
    ROTATION_INC: 'ROTATION_INC',
    ROTATION_DEC: 'ROTATION_DEC',
    SCALE_IN: 'SCALE_IN',
    SCALE_OUT: 'SCALE_OUT',
  };
  const DEFAULT_TRANSFORMATION_STATE = {
    verticalTranslation: 0,
    horizontalTranslation: 0,
    rotation: 0,
    scaling: 0,
  };
  let pageTransformationStates = {};
  let onStateChangeCallbackFxn;
  let mouseDownIntervalId;
  let instance;
  let delta = 1;

  const renderSVGIcons = nudgeDiffToolElement => {
    const url = window.location.href;
    const elementIdToSVGMapping = {
      rotateCounterClockwise: 'rotate_left.svg',
      rotateClockwise: 'rotate_right.svg',
      translateUp: 'arrow_up.svg',
      translateLeft: 'arrow_left.svg',
      translateRight: 'arrow_right.svg',
      translateDown: 'arrow_down.svg',
      scaleOut: 'size_decrease.svg',
      scaleIn: 'size_increase.svg',
    };
    Object.keys(elementIdToSVGMapping).forEach(elementId => {
      const nudgeButtonElement = nudgeDiffToolElement.getElementsByClassName(elementId)[0];
      const img = document.createElement('img');
      img.draggable = false;
      img.setAttribute('src', `${url}/assets/${elementIdToSVGMapping[elementId]}`);
      if (nudgeButtonElement) {
        nudgeButtonElement.appendChild(img);
      }
    });
  };

  const detectLeftButton = evt => {
    evt = evt || window.event;
    if ('buttons' in evt) {
      return evt.buttons === 1;
    }
    const button = evt.which || evt.button;
    return button === 1;
  };

  const updateLocalTransformationState = transformationOperation => {
    const currPageIndex = instance.docViewer.getCurrentPage() - 1;
    pageTransformationStates[currPageIndex] = pageTransformationStates[currPageIndex] || Object.assign({}, DEFAULT_TRANSFORMATION_STATE);

    const transformationState = pageTransformationStates[currPageIndex];
    switch (transformationOperation) {
      case TRANSFORMATION_TYPE.HORIZONTAL_TRANSLATION_INC:
        transformationState.horizontalTranslation += delta;
        break;
      case TRANSFORMATION_TYPE.HORIZONTAL_TRANSLATION_DEC:
        transformationState.horizontalTranslation -= delta;
        break;
      case TRANSFORMATION_TYPE.VERTICAL_TRANSLATION_INC:
        transformationState.verticalTranslation += delta;
        break;
      case TRANSFORMATION_TYPE.VERTICAL_TRANSLATION_DEC:
        transformationState.verticalTranslation -= delta;
        break;
      case TRANSFORMATION_TYPE.ROTATION_INC:
        transformationState.rotation += delta;
        break;
      case TRANSFORMATION_TYPE.ROTATION_DEC:
        transformationState.rotation -= delta;
        break;
      case TRANSFORMATION_TYPE.SCALE_IN:
        transformationState.scaling += delta;
        break;
      case TRANSFORMATION_TYPE.SCALE_OUT:
        transformationState.scaling -= delta;
        break;
    }
  };

  const setUpEventListenersForTool = nudgeDiffToolElement => {
    const elementIdToOperationMapping = {
      rotateCounterClockwise: TRANSFORMATION_TYPE.ROTATION_DEC,
      rotateClockwise: TRANSFORMATION_TYPE.ROTATION_INC,
      translateUp: TRANSFORMATION_TYPE.VERTICAL_TRANSLATION_DEC,
      translateLeft: TRANSFORMATION_TYPE.HORIZONTAL_TRANSLATION_DEC,
      translateRight: TRANSFORMATION_TYPE.HORIZONTAL_TRANSLATION_INC,
      translateDown: TRANSFORMATION_TYPE.VERTICAL_TRANSLATION_INC,
      scaleOut: TRANSFORMATION_TYPE.SCALE_OUT,
      scaleIn: TRANSFORMATION_TYPE.SCALE_IN,
    };
    const activateFxn = elementId => {
      const operationType = elementIdToOperationMapping[elementId];

      updateLocalTransformationState(operationType);
      if (onStateChangeCallbackFxn) {
        onStateChangeCallbackFxn(pageTransformationStates);
      }
      mouseDownIntervalId = setInterval(() => {
        updateLocalTransformationState(operationType);
        if (onStateChangeCallbackFxn) {
          onStateChangeCallbackFxn(pageTransformationStates);
        }
      }, 250);
    };
    const deactivateFxn = () => {
      clearInterval(mouseDownIntervalId);
    };
    Object.keys(elementIdToOperationMapping).forEach(elementId => {
      const element = nudgeDiffToolElement.getElementsByClassName(elementId)[0];
      element.onmousedown = activateFxn.bind(this, elementId);
      element.onmouseup = deactivateFxn;
      element.onmouseenter = e => {
        if (detectLeftButton(e)) {
          activateFxn(elementId);
        }
      };
      element.onmouseleave = e => {
        if (detectLeftButton(e)) {
          deactivateFxn();
        }
      };
      element.ontouchstart = e => {
        e.preventDefault();
        activateFxn(elementId);
      };
      element.ontouchend = deactivateFxn;
    });
  };

  const initNudgeTool = (instanceParam, deltaParam, callbackFxn) => {
    instance = instanceParam;
    delta = deltaParam;
    onStateChangeCallbackFxn = callbackFxn;

    const nudgeDiffToolElement = document.createElement('div');
    nudgeDiffToolElement.setAttribute('id', 'nudge-diff-tool');
    nudgeDiffToolElement.innerHTML = `
       <div class="action-group">
        <div class="action rotateCounterClockwise"></div>
        <div class="action rotateClockwise"></div>
       </div>
       <div>
        <div class="action translateUp"></div>
       <div class="action-group">
        <div class="action translateLeft"></div>
         <div class="action translateRight"></div>
       </div>
       <div class="action translateDown"></div>
       </div>
      <div class="action-group">
      <div class="action scaleOut"></div>
      <div class="action scaleIn"></div>
      </div>`;
    renderSVGIcons(nudgeDiffToolElement);
    setUpEventListenersForTool(nudgeDiffToolElement);
    pageTransformationStates = {};

    const viewerElementBody = document
      .getElementById(MID_PANEL)
      .querySelector('iframe')
      .contentDocument.querySelector('body');
    viewerElementBody.insertBefore(nudgeDiffToolElement, viewerElementBody.firstChild);
  };

  const setPageTransformationState = (pageIndex, horizontalTranslation, verticalTranslation, scale, rotation) => {
    // keys should be same as DEFAULT_TRANSFORMATION_STATE
    const newPageTransformationState = {
      verticalTranslation,
      horizontalTranslation,
      rotation,
      scaling: scale,
    };
    pageTransformationStates[pageIndex] = newPageTransformationState;
    onStateChangeCallbackFxn(pageTransformationStates);
  };

  const getPageTransformationState = index => {
    return pageTransformationStates[index];
  };

  const resetPageTransformationStates = () => {
    pageTransformationStates = {};
  };

  exports.NudgeTool = {
    initNudgeTool,
    resetPageTransformationStates,
    setPageTransformationState,
    getPageTransformationState,
  };
})(window);
