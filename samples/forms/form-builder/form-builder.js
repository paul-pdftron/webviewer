WebViewer(
  {
    path: '../../../lib',
    initialDoc: '../../full-apis/TestFiles/contract.pdf',
  },
  document.getElementById('viewer')
).then(instance => {
  samplesSetup(instance);
  let dropPoint = {};
  const { docViewer, Annotations, annotManager, iframeWindow } = instance;
  const { WidgetFlags } = Annotations;
  const fieldManager = annotManager.getFieldManager();

  iframeWindow.convertAnnotToFormField = () => {
    const annotationsList = annotManager.getAnnotationsList();
    const annotsToDelete = [];
    const annotsToDraw = [];

    annotationsList.forEach((annot, index) => {
      let inputAnnot;
      let field;
      if (annot.getCustomData('type') !== '') {
        // set readonly flag if necessary
        const flags = new WidgetFlags();
        if (annot.getCustomData('flag').readOnly) {
          flags.set(WidgetFlags['READ_ONLY'], true);
        }
        if (annot.getCustomData('flag').multiline) {
          flags.set(WidgetFlags['MULTILINE'], true);
        }

        // add it to clean up placeholder annots
        annotsToDelete.push(annot);

        // create a form field based on the type of annotation
        if (annot.getCustomData('type') === 'TEXT') {
          field = new Annotations.Forms.Field(annot.getContents() + Date.now() + index, {
            type: 'Tx',
            value: annot.getCustomData('value'),
            flags,
          });
          inputAnnot = new Annotations.TextWidgetAnnotation(field);
        } else if (annot.getCustomData('type') === 'SIGNATURE') {
          field = new Annotations.Forms.Field(annot.getContents() + Date.now() + index, {
            type: 'Sig',
            flags,
          });
          inputAnnot = new Annotations.SignatureWidgetAnnotation(field, {
            appearance: '_DEFAULT',
            appearances: {
              _DEFAULT: {
                Normal: {
                  data:
                    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAYdEVYdFNvZnR3YXJlAHBhaW50Lm5ldCA0LjEuMWMqnEsAAAANSURBVBhXY/j//z8DAAj8Av6IXwbgAAAAAElFTkSuQmCC',
                  offset: {
                    x: 100,
                    y: 100,
                  },
                },
              },
            },
          });
        } else if (annot.getCustomData('type') === 'CHECK') {
          flags.set(WidgetFlags.EDIT, true);
          const font = new Annotations.Font({ name: 'Helvetica' });
          field = new Annotations.Forms.Field(annot.getContents() + Date.now() + index, {
            type: 'Btn',
            value: 'Off',
            flags,
            font,
          });
          inputAnnot = new Annotations.CheckButtonWidgetAnnotation(field, {
            appearance: 'Off',
            appearances: {
              Off: {},
              Yes: {},
            },
          });
        } else {
          // exit early for other annotations
          annotManager.deleteAnnotation(annot, false, true); // prevent duplicates when importing xfdf
          return;
        }
      } else {
        return;
      }

      // set flag and position
      inputAnnot.PageNumber = annot.getPageNumber();
      inputAnnot.X = annot.getX();
      inputAnnot.Y = annot.getY();
      inputAnnot.rotation = annot.Rotation;
      if (annot.Rotation === 0 || annot.Rotation === 180) {
        inputAnnot.Width = annot.getWidth();
        inputAnnot.Height = annot.getHeight();
      } else {
        inputAnnot.Width = annot.getHeight();
        inputAnnot.Height = annot.getWidth();
      }

      // customize styles of the form field
      Annotations.WidgetAnnotation.getCustomStyles = widget => {
        if (widget instanceof Annotations.TextWidgetAnnotation) {
          return {
            'background-color': '#a5c7ff',
            color: 'white',
            'font-size': '20px',
          };
        }

        if (widget instanceof Annotations.SignatureWidgetAnnotation) {
          return {
            border: '1px solid #a5c7ff',
          };
        }
      };
      Annotations.WidgetAnnotation.getCustomStyles(inputAnnot);

      annotManager.addAnnotation(inputAnnot);
      fieldManager.addField(field);
      annotsToDraw.push(inputAnnot);
    });

    annotManager.deleteAnnotations(annotsToDelete, null, true);

    return annotManager.drawAnnotationsFromList(annotsToDraw).then(() => {
      dropPoint = {};
    });
  };

  // adding the annotation which later will be converted to form fields
  iframeWindow.addFormFieldAnnot = (type, name, value, flag) => {
    const zoom = docViewer.getZoom();
    const doc = docViewer.getDocument();
    const displayMode = docViewer.getDisplayModeManager().getDisplayMode();
    const page = displayMode.getSelectedPages(dropPoint, dropPoint);
    if (!!dropPoint.x && page.first == null) {
      return; // don't add field to an invalid page location
    }
    const pageNumber = page.first !== null ? page.first : docViewer.getCurrentPage();
    const pageInfo = doc.getPageInfo(pageNumber);
    const pagePoint = displayMode.windowToPage(dropPoint, pageNumber);

    const textAnnot = new Annotations.FreeTextAnnotation();
    textAnnot.PageNumber = pageNumber;
    const rotation = docViewer.getCompleteRotation(pageNumber) * 90;
    textAnnot.Rotation = rotation;
    if (type === 'CHECK') {
      textAnnot.Width = 25 / zoom;
      textAnnot.Height = 25 / zoom;
    } else if (rotation === 270 || rotation === 90) {
      textAnnot.Width = 50 / zoom;
      textAnnot.Height = 250 / zoom;
    } else {
      textAnnot.Width = 250 / zoom;
      textAnnot.Height = 50 / zoom;
    }
    textAnnot.X = (pagePoint.x || pageInfo.width / 2) - textAnnot.Width / 2;
    textAnnot.Y = (pagePoint.y || pageInfo.height / 2) - textAnnot.Height / 2;

    textAnnot.setPadding(new Annotations.Rect(0, 0, 0, 0));
    textAnnot.setCustomData('type', type);
    textAnnot.setCustomData('value', value);
    textAnnot.setCustomData('flag', flag);

    // set the type of annot
    textAnnot.setContents(`${name}_${type}`);
    textAnnot.FontSize = `${10.0 / zoom}px`;
    textAnnot.FillColor = new Annotations.Color(211, 211, 211, 0.5);
    textAnnot.TextColor = new Annotations.Color(0, 165, 228);
    textAnnot.StrokeThickness = 1;
    textAnnot.StrokeColor = new Annotations.Color(0, 165, 228);
    textAnnot.TextAlign = 'center';
    textAnnot.Author = annotManager.getCurrentUser();

    annotManager.deselectAllAnnotations();
    annotManager.addAnnotation(textAnnot, true);
    annotManager.redrawAnnotation(textAnnot);
    annotManager.selectAnnotation(textAnnot);
    dropPoint = {};
  };

  iframeWindow.setDropPoint = dropPt => {
    dropPoint = {
      x: dropPt.x,
      y: dropPt.y,
    };
  };
});
