// @link WebViewerInstance: https://www.pdftron.com/api/web/WebViewerInstance.html

// @link DocumentViewer: https://www.pdftron.com/api/web/CoreControls.DocumentViewer.html

// @link Document: https://www.pdftron.com/api/web/CoreControls.Document.html
// @link Document.getPageInfo: https://www.pdftron.com/api/web/CoreControls.Document.html#getPageInfo__anchor
// @link Document.rotatePages: https://www.pdftron.com/api/web/CoreControls.Document.html#rotatePages__anchor
// @link Document.cropPages: https://www.pdftron.com/api/web/CoreControls.Document.html#cropPages__anchor
// @link Document.getPageCount: https://www.pdftron.com/api/web/CoreControls.Document.html#getPageCount__anchor
// @link Document.removePages: https://www.pdftron.com/api/web/CoreControls.Document.html#removePages__anchor
// @link Document.movePages: https://www.pdftron.com/api/web/CoreControls.Document.html#movePages__anchor
// @link Document.insertBlankPages: https://www.pdftron.com/api/web/CoreControls.Document.html#insertBlankPages__anchor

// @link CoreControls: https://www.pdftron.com/api/web/CoreControls.html

// @link partRetriever: https://www.pdftron.com/api/web/PartRetrievers.html

WebViewer(
  {
    path: '../../../lib',
    useDownloader: false,
    initialDoc: '../../../samples/files/demo.pdf',
  },
  document.getElementById('viewer')
).then(instance => {
  samplesSetup(instance);
  const { docViewer, CoreControls } = instance;

  docViewer.on('documentLoaded', () => {
    const doc = docViewer.getDocument();

    const editDropdown = document.getElementById('edit');
    const moveFromDropdown = document.getElementById('move-from');
    const moveToDropdown = document.getElementById('move-to');
    const insertAtDropdown = document.getElementById('insert-at');
    const rotateButton = document.getElementById('rotate');
    const cropButton = document.getElementById('crop');
    const deleteButton = document.getElementById('delete');
    const moveButton = document.getElementById('move');
    const insertButton = document.getElementById('insert');
    const filePickerButton = document.getElementById('file-picker');

    // Updates page dropdowns when page count changes
    const updatePages = pageCount => {
      editDropdown.innerHTML = '';
      moveFromDropdown.innerHTML = '';
      moveToDropdown.innerHTML = '';
      insertAtDropdown.innerHTML = '';

      let i;
      let option;
      for (i = 0; i < pageCount; i++) {
        option = document.createElement('option');
        option.innerHTML = i + 1;
        editDropdown.appendChild(option);
        moveFromDropdown.appendChild(option.cloneNode(true));
        moveToDropdown.appendChild(option.cloneNode(true));
        insertAtDropdown.appendChild(option.cloneNode(true));
      }

      const clonedOption = option.cloneNode(true);
      clonedOption.innerHTML = i + 1;
      insertAtDropdown.appendChild(clonedOption);
    };

    rotateButton.onclick = () => {
      // Rotate pages
      doc.rotatePages([Number(editDropdown.value)], CoreControls.PageRotation.E_90);
    };

    cropButton.onclick = () => {
      // Crop pages
      doc.cropPages([Number(editDropdown.value)], 40, 40, 40, 40);
    };

    deleteButton.onclick = () => {
      const newPageCount = doc.getPageCount() - 1;
      // Delete pages
      doc.removePages([Number(editDropdown.value)]);
      updatePages(newPageCount);
    };

    moveButton.onclick = () => {
      const pageFrom = Number(moveFromDropdown.value);
      let pageTo = Number(moveToDropdown.value);
      if (pageFrom < pageTo) {
        pageTo++;
      }

      // Move pages
      doc.movePages([pageFrom], pageTo);
    };

    insertButton.onclick = () => {
      const info = doc.getPageInfo(1);
      const width = info.width;
      const height = info.height;
      const newPageCount = doc.getPageCount() + 1;
      // Insert blank pages
      doc.insertBlankPages([Number(insertAtDropdown.value)], width, height);
      updatePages(newPageCount);
    };

    filePickerButton.onchange = e => {
      const file = e.target.files[0];
      CoreControls.createDocument(file, {} /* , license key here */).then(newDoc => {
        const pages = [];
        for (let i = 0; i < newDoc.getPageCount(); i++) {
          pages.push(i + 1);
        }
        const newPageCount = doc.getPageCount() + newDoc.getPageCount();
        // Insert (merge) pages
        doc.insertPages(newDoc, pages, doc.getPageCount() + 1);
        updatePages(newPageCount);
      });
    };

    updatePages(doc.getPageCount());
  });
});
