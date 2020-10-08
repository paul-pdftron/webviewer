(function(exports) {
  let eventHandlersSetup = false;
  let _isInAlignmentMode = false;
  let leftPanelAnnot;
  let rightPanelAnnot;

  const alignPages = onAlignPressedCallback => {
    if (leftPanelAnnot && rightPanelAnnot) {
      onAlignPressedCallback(leftPanelAnnot.Start, leftPanelAnnot.End, rightPanelAnnot.Start, rightPanelAnnot.End, leftPanelAnnot.PageNumber - 1, rightPanelAnnot.PageNumber - 1);
    }
  };

  const isInAlignmentMode = () => {
    return _isInAlignmentMode;
  };

  const toggleAlignmentMode = (leftPanelInstance, rightPanelInstance, alignmentModeButton, onEnterAlignmentMode, onExitAlignmentMode) => {
    if (!_isInAlignmentMode) {
      _isInAlignmentMode = true;
      alignmentModeButton.textContent = 'Leave Alignment Mode';

      leftPanelInstance.setToolMode('AnnotationCreateArrow');
      rightPanelInstance.setToolMode('AnnotationCreateArrow');
      if (onEnterAlignmentMode) {
        onEnterAlignmentMode();
      }
    } else {
      _isInAlignmentMode = false;
      alignmentModeButton.textContent = 'Enter Alignment Mode';
      leftPanelInstance.setToolMode('AnnotationEdit');
      rightPanelInstance.setToolMode('AnnotationEdit');
      leftPanelInstance.docViewer.getAnnotationManager().deleteAnnotations(leftPanelInstance.docViewer.getAnnotationManager().getAnnotationsList(), true, true);
      rightPanelInstance.docViewer.getAnnotationManager().deleteAnnotations(rightPanelInstance.docViewer.getAnnotationManager().getAnnotationsList(), true, true);
      leftPanelAnnot = undefined;
      rightPanelAnnot = undefined;
      if (onExitAlignmentMode) {
        onExitAlignmentMode();
      }
    }
  };

  const initializeDiffAlignmentToolHandlers = (leftPanelInstance, rightPanelInstance, onAlignPressedCallback, onEnterAlignmentMode, onExitAlignmentMode) => {
    leftPanelAnnot = undefined;
    rightPanelAnnot = undefined;

    const alignmentModeButton = document.getElementById('toggle-alignment-mode');

    if (_isInAlignmentMode) {
      toggleAlignmentMode(leftPanelInstance, rightPanelInstance, alignmentModeButton, onEnterAlignmentMode, onExitAlignmentMode);
    }

    if (!eventHandlersSetup) {
      eventHandlersSetup = true;
      leftPanelInstance.docViewer.getTool('AnnotationCreateArrow').on('annotationAdded', annotation => {
        // after alignment annotation is added in the left viewer
        if (leftPanelAnnot) {
          leftPanelInstance.docViewer.getAnnotationManager().deleteAnnotation(leftPanelAnnot, false, true);
        }
        annotation.ReadOnly = true;
        leftPanelAnnot = annotation;
        alignPages(onAlignPressedCallback);
      });

      rightPanelInstance.docViewer.getTool('AnnotationCreateArrow').on('annotationAdded', annotation => {
        // after alignment annotation is added in the right viewer
        if (rightPanelAnnot) {
          rightPanelInstance.docViewer.getAnnotationManager().deleteAnnotation(rightPanelAnnot, false, true);
        }
        annotation.ReadOnly = true;
        rightPanelAnnot = annotation;
        alignPages(onAlignPressedCallback);
      });

      alignmentModeButton.addEventListener('click', () => {
        toggleAlignmentMode(leftPanelInstance, rightPanelInstance, alignmentModeButton, onEnterAlignmentMode, onExitAlignmentMode);
      });
      document.getElementById('enable-snap-mode').addEventListener('change', event => {
        const enableSnapMode = event.target.checked;
        leftPanelInstance.docViewer.getTool('AnnotationCreateArrow').setSnapMode(enableSnapMode ? leftPanelInstance.docViewer.SnapMode.DEFAULT : null);
        rightPanelInstance.docViewer.getTool('AnnotationCreateArrow').setSnapMode(enableSnapMode ? rightPanelInstance.docViewer.SnapMode.DEFAULT : null);
      });
    }
  };
  exports.DiffAlignmentTool = {
    initializeDiffAlignmentToolHandlers,
    isInAlignmentMode,
  };
})(window);
