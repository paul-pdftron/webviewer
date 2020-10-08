// @link WebViewerInstance: https://www.pdftron.com/api/web/WebViewerInstance.html
// @link CoreControls.setWorkerPath: https://www.pdftron.com/api/web/CoreControls.html#.setWorkerPath__anchor
// @link CoreControls.getDefaultBackendType: https://www.pdftron.com/api/web/CoreControls.html#.getDefaultBackendType__anchor
// @link CoreControls.initPDFWorkerTransports: https://www.pdftron.com/api/web/CoreControls.html#.initPDFWorkerTransports__anchor
// @link ExternalPdfPartRetriever: https://www.pdftron.com/api/web/PartRetrievers.ExternalPdfPartRetriever.html
// @link Document: https://www.pdftron.com/api/web/CoreControls.Document.html
// @link Document.loadAsync: https://www.pdftron.com/api/web/CoreControls.Document.html#loadAsync__anchor
// @link Document.getPageInfo: https://www.pdftron.com/api/web/CoreControls.Document.html#getPageInfo__anchor
// @link Document.getPageCount: https://www.pdftron.com/api/web/CoreControls.Document.html#getPageCount__anchor
// @link Document.requirePage: https://www.pdftron.com/api/web/CoreControls.Document.html#requirePage__anchor
// @link Document.loadCanvasAsync: https://www.pdftron.com/api/web/CoreControls.Document.html#loadCanvasAsync__anchor

CoreControls.setWorkerPath('../../../lib/core');

const flipbookElement = document.getElementById('flipbook');
const loadingMessageElement = document.getElementById('loading-message');

loadingMessageElement.innerHTML = 'Preparing document...';

const source = 'https://pdftron.s3.amazonaws.com/downloads/pl/Cheetahs.pdf';
const options = { l: window.sampleL /* license key here */ };

const documentPromise = CoreControls.createDocument(source, options);

documentPromise.then(doc => {
  const info = doc.getPageInfo(1);
  const width = info.width;
  const height = info.height;
  const pageCount = doc.getPageCount();
  const promises = [];
  const canvases = [];

  const boundingRect = flipbookElement.getBoundingClientRect();
  let flipbookHeight = boundingRect.height;
  let flipbookWidth = boundingRect.width;
  if (((flipbookHeight * width) / height) * 2 < flipbookWidth) {
    flipbookWidth = ((flipbookHeight * width) / height) * 2;
  } else {
    flipbookHeight = ((flipbookWidth / width) * height) / 2;
  }

  for (let i = 0; i < pageCount; i++) {
    promises.push(
      /* eslint-disable-next-line no-loop-func */
      new Promise(resolve => {
        // Load page canvas
        const pageNumber = i + 1;
        return doc.requirePage(pageNumber).then(() => {
          return doc.loadCanvasAsync({
            pageNumber,
            drawComplete: (canvas, index) => {
              canvases.push({ index, canvas });

              loadingMessageElement.innerHTML = `Loading page canvas... (${canvases.length}/${pageCount})`;
              resolve();
            },
            isInternalRender: true,
          });
        });
      })
    );
  }

  Promise.all(promises).then(() => {
    flipbookElement.removeChild(loadingMessageElement);
    flipbookElement.style.margin = '60px 0px 0px auto';

    canvases.sort((a, b) => a.index - b.index).forEach(o => flipbookElement.appendChild(o.canvas));

    $('#flipbook').turn({
      width: flipbookWidth,
      height: flipbookHeight,
    });

    setTimeout(() => {
      $('#flipbook').turn('next');
    }, 500);

    document.getElementById('previous').onclick = () => {
      $('#flipbook').turn('previous');
    };

    document.getElementById('next').onclick = () => {
      $('#flipbook').turn('next');
    };
  });
});
