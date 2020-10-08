// @link WebViewerInstance: https://www.pdftron.com/api/web/WebViewerInstance.html
// @link WebViewerInstance.loadDocument: https://www.pdftron.com/api/web/WebViewerInstance.html#loadDocument__anchor

// @link DocumentViewer: https://www.pdftron.com/api/web/CoreControls.DocumentViewer.html

// @link AnnotationManager: https://www.pdftron.com/api/web/CoreControls.AnnotationManager.html
// @link AnnotationManager.addAnnotations: https://www.pdftron.com/api/web/CoreControls.AnnotationManager.html#addAnnotations__anchor
// @link AnnotationManager.deleteAnnotations: https://www.pdftron.com/api/web/CoreControls.AnnotationManager.html#deleteAnnotations__anchor
// @link AnnotationManager.selectAnnotations: https://www.pdftron.com/api/web/CoreControls.AnnotationManager.html#selectAnnotations__anchor
// @link AnnotationManager.getAnnotationsList: https://www.pdftron.com/api/web/CoreControls.AnnotationManager.html#getAnnotationsList__anchor

// @link Annotations: https://www.pdftron.com/api/web/Annotations.html

// @link Document: https://www.pdftron.com/api/web/CoreControls.Document.html
// @link Document.loadPageText: https://www.pdftron.com/api/web/CoreControls.Document.html#loadPageText__anchor
// @link Document.getTextPosition: https://www.pdftron.com/api/web/CoreControls.Document.html#getTextPosition__anchor

const viewerElement = document.getElementById('viewer');
WebViewer(
  {
    path: '../../../lib',
    pdftronServer: 'https://demo.pdftron.com/', // comment this out to do client-side only
    initialDoc: 'https://pdftron.s3.amazonaws.com/downloads/pl/legal-contract.pdf',
  },
  viewerElement
).then(instance => {
  samplesSetup(instance);
  const { docViewer, annotManager, Annotations } = instance;

  const renderCheckBoxes = pageCount => {
    const pagesDiv = document.getElementById('pages');
    let pageNumber;
    const checkboxes = [];

    for (pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      const input = document.createElement('input');
      /* eslint-disable prefer-template */
      input.id = `page-${pageNumber}`;
      input.type = 'checkbox';
      input.checked = false;
      input.value = pageNumber;

      checkboxes.push(input);

      const label = document.createElement('label');
      label.htmlFor = `page-${pageNumber}`;
      label.innerHTML = `Page ${pageNumber}`;

      const lineBreak = document.createElement('br');

      pagesDiv.appendChild(input);
      pagesDiv.appendChild(label);
      pagesDiv.appendChild(lineBreak);
    }

    return checkboxes;
  };

  const highlightText = (searchText, pageNumber) => {
    const doc = docViewer.getDocument();

    // gets all text on the requested page
    // see https://pdftron.com/api/web/CoreControls.Document.html#loadPageText__anchor
    doc.loadPageText(pageNumber).then(text => {
      let textStartIndex = 0;
      let textIndex;
      const annotationPromises = [];

      // find the position of the searched text and add text highlight annotation at that location
      while ((textIndex = text.indexOf(searchText, textStartIndex)) > -1) {
        textStartIndex = textIndex + searchText.length;
        // gets quads for each of the characters from start to end index. Then,
        // resolve the annotation and return.
        // see https://pdftron.com/api/web/CoreControls.Document.html#getTextPosition__anchor
        const annotationPromise = doc.getTextPosition(pageNumber, textIndex, textIndex + searchText.length).then(quads => {
          const annotation = new Annotations.TextHighlightAnnotation();
          annotation.Author = annotManager.getCurrentUser();
          annotation.PageNumber = pageNumber;
          annotation.Quads = quads;
          annotation.StrokeColor = new Annotations.Color(0, 255, 255);
          return annotation;
        });
        annotationPromises.push(annotationPromise);
      }

      // Wait for all annotations to be resolved.
      Promise.all(annotationPromises).then(annotations => {
        annotManager.addAnnotations(annotations);
        annotManager.selectAnnotations(annotations);
      });
    });
  };

  const removeHighlightedText = pageNumber => {
    const annotations = annotManager.getAnnotationsList().filter(annotation => {
      return annotation.PageNumber === pageNumber;
    });
    annotManager.deleteAnnotations(annotations);
  };

  docViewer.on('documentLoaded', () => {
    const textInput = document.getElementById('text');
    const checkboxes = renderCheckBoxes(docViewer.getPageCount());

    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        const pageNumber = Number(checkbox.value);

        if (checkbox.checked && textInput.value) {
          highlightText(textInput.value, pageNumber);
        } else {
          removeHighlightedText(pageNumber);
        }
      });
    });

    textInput.addEventListener(
      'input',
      // debounce loaded elsewhere
      // eslint-disable-next-line
      debounce(() => {
        checkboxes.forEach(checkbox => {
          const pageNumber = Number(checkbox.value);

          if (checkbox.checked) {
            removeHighlightedText(pageNumber);

            if (textInput.value) {
              highlightText(textInput.value, pageNumber);
            }
          }
        });
      }, 200)
    );

    // highlight search text in the first page by default
    checkboxes[0].checked = true;
    highlightText(textInput.value, 1);
  });
});
