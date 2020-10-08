// @link WebViewerInstance: https://www.pdftron.com/api/web/WebViewerInstance.html
// @link WebViewerInstance.setHeaderItems: https://www.pdftron.com/api/web/WebViewerInstance.html#setHeaderItems__anchor
// @link WebViewerInstance.enableElements: https://www.pdftron.com/api/web/WebViewerInstance.html#enableElements__anchor
// @link WebViewerInstance.disableElements: https://www.pdftron.com/api/web/WebViewerInstance.html#disableElements__anchor

// @link Header: https://www.pdftron.com/api/web/Header.html
// @link Header.getItems: https://www.pdftron.com/api/web/Header.html#getItems__anchor
// @link Header.update: https://www.pdftron.com/api/web/Header.html#update__anchor

WebViewer(
  {
    path: '../../../lib',
    pdftronServer: 'https://demo.pdftron.com/', // comment this out to do client-side only
    initialDoc: 'https://pdftron.s3.amazonaws.com/downloads/pl/demo-annotated.pdf',
  },
  document.getElementById('viewer')
).then(instance => {
  samplesSetup(instance);

  const reverseHeaderItems = () => {
    // Change header items
    instance.setHeaderItems(header => {
      const items = header.getItems();
      const copiedItems = items.splice(2, 18);
      copiedItems.reverse();
      header.update([].concat(items.slice(0, 2), copiedItems, items.slice(2)));
    });
  };

  const toggleElement = (e, dataElement) => {
    // Enable/disable individual element
    if (e.target.checked) {
      instance.enableElements([dataElement]);
    } else {
      instance.disableElements([dataElement]);
    }
  };

  if (NodeList && !NodeList.prototype.forEach) {
    NodeList.prototype.forEach = Array.prototype.forEach;
  }

  if (HTMLCollection && !HTMLCollection.prototype.forEach) {
    HTMLCollection.prototype.forEach = Array.prototype.forEach;
  }

  document.getElementsByName('header').forEach(radioInput => {
    radioInput.onchange = () => {
      reverseHeaderItems();
    };
  });

  document.getElementById('ribbons').onchange = e => {
    // Enable/disable ribbons
    if (e.target.checked) {
      instance.enableFeatures([instance.Feature.Ribbons]);
    } else {
      instance.disableFeatures([instance.Feature.Ribbons]);
    }
  };

  document.getElementById('text-selection').onchange = e => {
    // Enable/disable text selection
    if (e.target.checked) {
      instance.enableFeatures([instance.Feature.TextSelection]);
    } else {
      instance.disableFeatures([instance.Feature.TextSelection]);
    }
  };

  document.getElementById('annotations').onchange = e => {
    // Enable/disable annotations
    if (e.target.checked) {
      instance.enableFeatures([instance.Feature.Annotations]);
    } else {
      instance.disableFeatures([instance.Feature.Annotations]);
    }
  };

  document.getElementById('notes-panel').onchange = e => {
    // Enable/disable notes panel
    if (e.target.checked) {
      instance.enableFeatures([instance.Feature.NotesPanel]);
    } else {
      instance.disableFeatures([instance.Feature.NotesPanel]);
    }
  };

  document.getElementById('file-picker').onchange = e => {
    // Enable/disable file picker
    if (e.target.checked) {
      instance.enableFeatures([instance.Feature.FilePicker]);
    } else {
      instance.disableFeatures([instance.Feature.FilePicker]);
    }
  };

  document.getElementById('print').onchange = e => {
    // Enable/disable print
    if (e.target.checked) {
      instance.enableFeatures([instance.Feature.Print]);
    } else {
      instance.disableFeatures([instance.Feature.Print]);
    }
  };

  document.getElementById('download').onchange = e => {
    // Enable/disable download
    if (e.target.checked) {
      instance.enableFeatures([instance.Feature.Download]);
    } else {
      instance.disableFeatures([instance.Feature.Download]);
    }
  };

  document.getElementById('view-controls').onchange = e => {
    toggleElement(e, 'viewControlsButton');
  };

  document.getElementById('search').onchange = e => {
    toggleElement(e, 'searchButton');
  };

  document.getElementById('pan-tool').onchange = e => {
    toggleElement(e, 'panToolButton');
  };

  document.getElementById('page-nav').onchange = e => {
    toggleElement(e, 'pageNavOverlay');
  };

  document.getElementById('default').onchange = e => {
    if (e.target.checked) {
      reverseHeaderItems();
    }
  };

  document.getElementById('reverse').onchange = e => {
    if (e.target.checked) {
      reverseHeaderItems();
    }
  };

  document.getElementsByName('theme').forEach(radioInput => {
    radioInput.onchange = e => {
      if (e.target.id === 'light' && e.target.checked) {
        instance.setTheme('light');
      } else {
        instance.setTheme('dark');
      }
    };
  });
});
