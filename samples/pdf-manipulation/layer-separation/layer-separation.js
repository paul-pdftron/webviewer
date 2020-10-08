// @link WebViewerInstance: https://www.pdftron.com/api/web/WebViewerInstance.html
// @link WebViewerInstance.openElements: https://www.pdftron.com/api/web/WebViewerInstance.html#openElements__anchor
// @link WebViewerInstance.closeElements: https://www.pdftron.com/api/web/WebViewerInstance.html#closeElements__anchor

// @link DocumentViewer: https://www.pdftron.com/api/web/CoreControls.DocumentViewer.html
// @link DocumentViewer.refreshAll: https://www.pdftron.com/api/web/CoreControls.DocumentViewer.html#refreshAll__anchor
// @link DocumentViewer.updateView: https://www.pdftron.com/api/web/CoreControls.DocumentViewer.html#updateView__anchor

// @link Document: https://www.pdftron.com/api/web/CoreControls.Document.html
// @link Document.getLayersArray: https://www.pdftron.com/api/web/CoreControls.Document.html#getLayersArray__anchor
// @link Document.setLayersArray: https://www.pdftron.com/api/web/CoreControls.Document.html#setLayersArray__anchor

WebViewer(
  {
    path: '../../../lib',
    initialDoc: '../../../samples/files/construction-drawing-final.pdf',
  },
  document.getElementById('viewer')
).then(instance => {
  samplesSetup(instance);
  instance.openElements(['leftPanel']);
  instance.setActiveLeftPanel('layersPanel');
  instance.docViewer.on('pageComplete', () => {
    instance.closeElements(['loadingModal']);
  });
});
