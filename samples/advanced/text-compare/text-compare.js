// @link WebViewerInstance: https://www.pdftron.com/api/web/WebViewerInstance.html

/*global Diff*/

const compareViewer = [
  {
    initialDoc: '../../files/text-compare_1.pdf',
    domElement: 'leftPanel',
    diffPanel: 'compareLeftPanel',
    instance: null,
    loaded: false,
  },
  {
    initialDoc: '../../files/text-compare_2.pdf',
    domElement: 'rightPanel',
    diffPanel: 'compareRightPanel',
    instance: null,
    loaded: false,
  },
];

let workerTransportPromise;

CoreControls.setWorkerPath('../../../lib/core');
CoreControls.getDefaultBackendType().then(async pdfType => {
  workerTransportPromise = CoreControls.initPDFWorkerTransports(pdfType, {});
  const [viewer1, viewer2] = await Promise.all([initializeWebViewer(compareViewer[0]), initializeWebViewer(compareViewer[1])]);

  viewer1.docViewer.on('documentLoaded', documentLoaded);
  viewer2.docViewer.on('documentLoaded', documentLoaded);
  documentLoaded();
});

const documentLoaded = () => {
  compareText(1);
};

const initializeWebViewer = viewer => {
  return new Promise(resolve => {
    WebViewer(
      {
        path: '../../../lib',
        // since there are two instance of WebViewer, use "workerTransportPromise" so viewers can share resources
        workerTransportPromise: {
          pdf: workerTransportPromise,
        },
        initialDoc: viewer.initialDoc,
      },
      document.getElementById(`${viewer.domElement}`)
    ).then(instance => {
      const { docViewer, CoreControls } = instance;
      viewer.instance = instance;
      instance.disableTools();

      instance.closeElement('toolsHeader');

      docViewer.on('documentLoaded', async () => {
        viewer.loaded = true;
        const displayMode = docViewer.getDisplayModeManager();
        displayMode.setDisplayMode(new CoreControls.DisplayMode(docViewer, CoreControls.DisplayModes.Single));
        instance.setFitMode(instance.FitMode.FitWidth);
        resolve(instance);
      });

      docViewer.on('pageNumberUpdated', pageNumber => {
        const otherViewer = compareViewer[0].instance === instance ? compareViewer[1].instance : compareViewer[0].instance;
        if (otherViewer.docViewer.getCurrentPage() !== pageNumber) {
          otherViewer.setCurrentPageNumber(pageNumber);
        }
        compareText(pageNumber);
      });

      docViewer.on('zoomUpdated', zoom => {
        const isNotHidden = document.getElementById(viewer.domElement).className.indexOf('hidden') === -1;
        if (isNotHidden) {
          // only sync the zoom if the event is from a viewer that isn't hidden
          // hidden viewers might have incorrect zoom levels because the dimensions are small
          syncZoom(zoom, viewer.domElement);
        }
      });

      // set up controls on the left side bar
      document.getElementById(`${viewer.domElement}-select`).onchange = e => {
        instance.loadDocument(e.target.value);
      };

      document.getElementById(`${viewer.domElement}-file-picker`).onchange = e => {
        const file = e.target.files[0];

        if (file) {
          instance.loadDocument(file);
        }
      };

      document.getElementById(`${viewer.domElement}-url-form`).onsubmit = e => {
        e.preventDefault();
        instance.loadDocument(document.getElementById(`${viewer.domElement}-url`).value);
      };
    });
  });
};

const getPageText = (instance, pageNumber) => {
  const doc = instance.docViewer.getDocument();

  return new Promise(resolve => {
    doc.loadPageText(pageNumber, text => {
      resolve(text);
    });
  });
};

const compareText = async pageNumber => {
  const text0 = await getPageText(compareViewer[0].instance, pageNumber);
  const text1 = await getPageText(compareViewer[1].instance, pageNumber);

  document.querySelector(`#${compareViewer[0].diffPanel}`).innerHTML = '';
  document.querySelector(`#${compareViewer[1].diffPanel}`).innerHTML = '';

  const diffLines = Diff.diffLines(text0, text1);
  for (let i = 0; i < diffLines.length; i++) {
    const diffLine = diffLines[i];

    if (!diffLine.removed && !diffLine.added) {
      // handle case when the text are the same
      // add a toggleable element

      const sectionLeft = document.createElement('div');
      const sectionRight = document.createElement('div');
      sectionLeft.className = 'section identical';
      sectionRight.className = 'section identical';

      const btnLeft = document.createElement('span');
      const btnRight = document.createElement('span');
      btnLeft.innerHTML = '(...)';
      btnRight.innerHTML = '(...)';

      const textRight = document.createElement('p');
      const textLeft = document.createElement('p');
      textRight.innerHTML = diffLine.value;
      textRight.className = 'hidden';

      textLeft.innerHTML = diffLine.value;
      textLeft.className = 'hidden';

      sectionRight.appendChild(textRight);
      sectionLeft.appendChild(textLeft);

      sectionLeft.appendChild(btnLeft);
      sectionRight.appendChild(btnRight);

      let displayingText = false;
      const toggleText = () => {
        displayingText = !displayingText;

        textLeft.className = displayingText ? '' : 'hidden';
        textRight.className = displayingText ? '' : 'hidden';
        btnRight.className = displayingText ? 'hidden' : '';
        btnLeft.className = displayingText ? 'hidden' : '';
      };

      sectionRight.addEventListener('click', toggleText);
      sectionLeft.addEventListener('click', toggleText);

      document.querySelector(`#${compareViewer[0].diffPanel}`).appendChild(sectionLeft);
      document.querySelector(`#${compareViewer[1].diffPanel}`).appendChild(sectionRight);
    } else {
      let updatedLine = '';
      if (i + 1 < diffLines.length && (diffLines[i + 1].removed || diffLines[i + 1].added)) {
        updatedLine = diffLines[i + 1].value;
        i++;
      }

      // get difference for individual characters so they can be highlighted
      const diffChars = Diff.diffChars(diffLine.value, updatedLine);
      let oldText = '';
      let newText = '';

      diffChars.forEach(char => {
        const value = char.value.replace(/\r?\n/g, '<br />');

        if (!char.removed && !char.added) {
          oldText = oldText + value;
          newText = newText + value;
        } else if (!char.value.replace(/\s/g, '').length) {
          // don't do anything for new line characters
          return;
        } else if (char.added) {
          newText = `${newText}<span class="added">${value}</span>`;
        } else if (char.removed) {
          oldText = `${oldText}<span class="removed">${value}</span>`;
        }
      });

      const sectionRight = document.createElement('div');
      sectionRight.className = 'section empty';

      const sectionLeft = document.createElement('div');
      sectionLeft.className = 'section removed';

      const textLeft = document.createElement('p');
      textLeft.innerHTML = oldText;
      sectionLeft.appendChild(textLeft);
      document.querySelector(`#${compareViewer[0].diffPanel}`).appendChild(sectionLeft);

      const textRight = document.createElement('p');
      textRight.innerHTML = newText;
      sectionRight.appendChild(textRight);
      document.querySelector(`#${compareViewer[1].diffPanel}`).appendChild(sectionRight);

      const maxHeight = Math.max(sectionRight.scrollHeight, sectionLeft.scrollHeight);
      sectionRight.style.height = `${maxHeight}px`;
      sectionLeft.style.height = `${maxHeight}px`;
    }
  }
};

const syncZoom = (zoom, domElement) => {
  compareViewer.forEach(viewer => {
    const instance = viewer.instance;

    if (instance.getZoomLevel() !== zoom && domElement !== viewer.domElement) {
      instance.setZoomLevel(zoom);
    }
  });
};

let scrollDebounce = 0;
const scrollDebounceTime = 10;

//re render the top display when window resize
window.onresize = () => {
  if (compareViewer[0].instance && compareViewer[0].instance.docViewer) {
    compareText(compareViewer[0].instance.docViewer.getCurrentPage());
  }
};

// sync the top display
document.getElementById('compareLeftPanel').onscroll = e => {
  clearTimeout(scrollDebounce);

  scrollDebounce = setTimeout(() => {
    document.getElementById('compareRightPanel').scrollTop = e.target.scrollTop;
  }, scrollDebounceTime);
};

document.getElementById('compareRightPanel').onscroll = e => {
  clearTimeout(scrollDebounce);

  scrollDebounce = setTimeout(() => {
    document.getElementById('compareLeftPanel').scrollTop = e.target.scrollTop;
  }, scrollDebounceTime);
};

// toggle between bottom viewers
document.getElementById('toggleLeft').onclick = e => {
  e.target.disabled = true;
  document.getElementById('toggleRight').disabled = false;

  document.getElementById('rightPanel').classList.add('hidden');
  document.getElementById('leftPanel').classList.remove('hidden');
};

document.getElementById('toggleRight').onclick = e => {
  e.target.disabled = true;
  document.getElementById('toggleLeft').disabled = false;

  document.getElementById('rightPanel').classList.remove('hidden');
  document.getElementById('leftPanel').classList.add('hidden');
};
