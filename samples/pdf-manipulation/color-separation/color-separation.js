// @link WebViewerInstance: https://www.pdftron.com/api/web/WebViewerInstance.html
// @link WebViewerInstance.openElements: https://www.pdftron.com/api/web/WebViewerInstance.html#openElements__anchor
// @link WebViewerInstance.closeElements: https://www.pdftron.com/api/web/WebViewerInstance.html#closeElements__anchor

// @link DocumentViewer: https://www.pdftron.com/api/web/CoreControls.DocumentViewer.html
// @link DocumentViewer.getToolMode.getMouseLocation: https://www.pdftron.com/api/web/Tools.Tool.html#getMouseLocation__anchor
// @link DocumentViewer.getDisplayModeManager.getDisplayMode: https://www.pdftron.com/api/web/CoreControls.DisplayMode.html
// @link DocumentViewer.getColorSeparationsAtPoint: https://www.pdftron.com/api/web/CoreControls.DocumentViewer.html#getColorSeparationsAtPoint__anchor
// @link DocumentViewer.refreshAll: https://www.pdftron.com/api/web/CoreControls.DocumentViewer.html#refreshAll__anchor
// @link DocumentViewer.updateView: https://www.pdftron.com/api/web/CoreControls.DocumentViewer.html#updateView__anchor

// @link displayMode.windowToPage: https://www.pdftron.com/api/web/CoreControls.DisplayMode.html#windowToPage__anchor

// @link Document: https://www.pdftron.com/api/web/CoreControls.Document.html
// @link Document.enableColorSeparations: https://www.pdftron.com/api/web/CoreControls.Document.html#enableColorSeparations__anchor
// @link Document.enableSeparation: https://www.pdftron.com/api/web/CoreControls.Document.html#enableSeparation__anchor

WebViewer(
  {
    path: '../../../lib',
    fullAPI: true,
    initialDoc: '../../../samples/files/op-blend-test.pdf',
  },
  document.getElementById('viewer')
).then(instance => {
  samplesSetup(instance);
  const { docViewer } = instance;
  const colorsElement = document.getElementById('colors');

  docViewer.on('documentLoaded', () => {
    const doc = docViewer.getDocument();

    // Enable color separation
    doc.enableColorSeparations(true);

    // Listen to each color in a PDF document
    doc.on('colorSeparationAdded', color => {
      const input = document.createElement('input');
      input.id = color.name;
      input.type = 'checkbox';
      input.checked = color.enabled;
      input.onchange = e => {
        instance.openElements(['loadingModal']);
        // Show/hide a color
        doc.enableSeparation(color.name, e.target.checked);
        // Redraw the canvas
        docViewer.refreshAll();
        docViewer.updateView();
      };

      const label = document.createElement('label');
      label.id = `${color.name} label`;
      label.htmlFor = color.name;
      label.style.color = `rgb(${color.rgb.join(',')})`;
      label.innerHTML = color.name;

      const lineBreak = document.createElement('br');

      colorsElement.appendChild(input);
      colorsElement.appendChild(label);
      colorsElement.appendChild(lineBreak);
    });
  });

  docViewer.on('mouseMove', nativeE => {
    const mouseLocation = docViewer.getToolMode().getMouseLocation(nativeE);
    const displayMode = docViewer.getDisplayModeManager().getDisplayMode();

    const pageIndex = displayMode.getSelectedPages(mouseLocation, mouseLocation).first;
    if (pageIndex !== null) {
      const pageCoordinate = displayMode.windowToPage(mouseLocation, pageIndex);
      if (pageCoordinate) {
        const pageNumber = pageCoordinate.pageIndex + 1;
        const x = pageCoordinate.x;
        const y = pageCoordinate.y;
        const results = docViewer.getColorSeparationsAtPoint(pageNumber, x, y);
        for (let i = 0; i < results.length; ++i) {
          // Update the text in color panel
          document.getElementById(`${results[i].name} label`).innerHTML = `${results[i].name} ${results[i].value}%`;
        }
      }
    }
  });

  docViewer.on('pageComplete', () => {
    instance.closeElements(['loadingModal']);
  });
});
