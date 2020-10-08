// @link WebViewerInstance: https://www.pdftron.com/api/web/WebViewerInstance.html
// @link WebViewerInstance.setHeaderItems: https://www.pdftron.com/api/web/WebViewerInstance.html#setHeaderItems__anchor
// @link WebViewerInstance.openElements: https://www.pdftron.com/api/web/WebViewerInstance.html#openElements__anchor
// @link WebViewerInstance.loadDocument: https://www.pdftron.com/api/web/WebViewerInstance.html#loadDocument__anchor

// @link Header: https://www.pdftron.com/api/web/Header.html

WebViewer(
  {
    path: '../../../lib',
    initialDoc: '../../../samples/files/houseplan-A.pdf',
    enableMeasurement: true,
  },
  document.getElementById('viewer')
).then(instance => {
  samplesSetup(instance);

  instance.setToolbarGroup('toolbarGroup-Measure');

  // open notes panel by default
  instance.openElements(['notesPanel']);

  document.getElementById('select').onchange = e => {
    instance.loadDocument(e.target.value);
  };

  document.getElementById('file-picker').onchange = e => {
    const file = e.target.files[0];
    if (file) {
      instance.loadDocument(file);
    }
  };

  document.getElementById('url-form').onsubmit = e => {
    e.preventDefault();
    instance.loadDocument(document.getElementById('url').value);
  };
});
