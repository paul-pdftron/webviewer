// @link WebViewerInstance: https://www.pdftron.com/api/web/WebViewerInstance.html
// @link WebViewerInstance.registerTool: https://www.pdftron.com/api/web/WebViewerInstance.html#registerTool__anchor
// @link WebViewerInstance.unregisterTool: https://www.pdftron.com/api/web/WebViewerInstance.html#unregisterTool__anchor
// @link WebViewerInstance.setHeaderItems: https://www.pdftron.com/api/web/WebViewerInstance.html#setHeaderItems__anchor
// @link WebViewerInstance.setToolMode: https://www.pdftron.com/api/web/WebViewerInstance.html#setToolMode__anchor

// @link Header: https://www.pdftron.com/api/web/Header.html
// @link Header.get: https://www.pdftron.com/api/web/Header.html#get__anchor
// @link Header.getHeader: https://www.pdftron.com/api/web/Header.html#getHeader__anchor
// @link Header.insertBefore: https://www.pdftron.com/api/web/Header.html#insertBefore__anchor
(function(exports) {
  const TRIANGLE_TOOL_NAME = 'AnnotationCreateTriangle';
  WebViewer(
    {
      path: '../../../lib',
      pdftronServer: 'https://demo.pdftron.com/', // comment this out to do client-side only
      initialDoc: 'https://pdftron.s3.amazonaws.com/downloads/pl/demo-annotated.pdf',
    },
    document.getElementById('viewer')
  ).then(instance => {
    samplesSetup(instance);
    // stamp.js
    const customStampTool = window.createStampTool(instance);

    const TriangleCreateTool = exports.TriangleCreateToolFactory.initialize(instance.Annotations, instance.Tools);
    const TriangleAnnotation = exports.TriangleAnnotationFactory.initialize(instance.Annotations);

    // register the annotation type so that it can be saved to XFDF files
    instance.docViewer.getAnnotationManager().registerAnnotationType(TriangleAnnotation.prototype.elementName, TriangleAnnotation);
    // fxn to check if an annotation is a triangle annotation. allows WebViewer UI to be able to style a selected custom triange annotation
    const isTriangleAnnot = annotation =>
      annotation && annotation[exports.TriangleAnnotationFactory.ANNOT_TYPE] && annotation[exports.TriangleAnnotationFactory.ANNOT_TYPE] === exports.TriangleAnnotationFactory.TRIANGLE_ANNOT_ID;
    const addTriangleTool = () => {
      instance.registerTool(
        {
          toolName: TRIANGLE_TOOL_NAME,
          toolObject: new TriangleCreateTool(instance.docViewer),
          buttonImage:
            '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">' +
            '<path d="M12 7.77L18.39 18H5.61L12 7.77M12 4L2 20h20L12 4z"/>' +
            '<path fill="none" d="M0 0h24v24H0V0z"/>' +
            '</svg>',
          buttonName: 'triangleToolButton',
          tooltip: 'Triangle',
        },
        TriangleAnnotation,
        annotation => isTriangleAnnot(annotation)
      );

      const triangleButton = {
        type: 'toolButton',
        toolName: TRIANGLE_TOOL_NAME,
      };

      instance.setHeaderItems(header => {
        header
          .getHeader('toolbarGroup-Annotate')
          .get('highlightToolGroupButton')
          .insertBefore(triangleButton);
      });
      instance.setToolMode(TRIANGLE_TOOL_NAME);
    };

    const addCustomStampTool = () => {
      // Register tool
      instance.registerTool({
        toolName: 'CustomStampTool',
        toolObject: customStampTool,
        buttonImage: '../../../samples/annotation/custom-annotations/stamp.png',
        buttonName: 'customStampToolButton',
        tooltip: 'Approved Stamp Tool',
      });

      // Add tool button in header
      instance.setHeaderItems(header => {
        header
          .getHeader('toolbarGroup-Annotate')
          .get('highlightToolGroupButton')
          .insertBefore({
            type: 'toolButton',
            toolName: 'CustomStampTool',
          });
      });
      instance.setToolMode('CustomStampTool');
    };

    const removeCustomStampTool = () => {
      instance.unregisterTool('CustomStampTool');
      instance.setToolMode('AnnotationEdit');
    };

    const removeTriangleTool = () => {
      instance.unregisterTool(TRIANGLE_TOOL_NAME);
      instance.setToolMode('AnnotationEdit');
    };

    document.getElementById('custom-stamp').onchange = e => {
      if (e.target.checked) {
        addCustomStampTool();
      } else {
        removeCustomStampTool();
      }
    };

    document.getElementById('custom-triangle-tool').onchange = e => {
      if (e.target.checked) {
        addTriangleTool();
      } else {
        removeTriangleTool();
      }
    };

    instance.iframeWindow.document.body.ondragover = e => {
      e.preventDefault();
      return false;
    };

    let dropPoint = {};
    instance.iframeWindow.document.body.ondrop = e => {
      const scrollElement = instance.docViewer.getScrollViewElement();
      const scrollLeft = scrollElement.scrollLeft || 0;
      const scrollTop = scrollElement.scrollTop || 0;
      dropPoint = { x: e.pageX + scrollLeft, y: e.pageY + scrollTop };
      e.preventDefault();
      return false;
    };

    const addStamp = (imgData, point, rect) => {
      point = point || {};
      rect = rect || {};
      const { Annotations, docViewer, annotManager } = instance;
      const doc = docViewer.getDocument();
      const displayMode = docViewer.getDisplayModeManager().getDisplayMode();
      const page = displayMode.getSelectedPages(point, point);
      if (!!point.x && page.first == null) {
        return; // don't add to an invalid page location
      }
      const pageNumber = page.first !== null ? page.first : docViewer.getCurrentPage();
      const pageInfo = doc.getPageInfo(pageNumber);
      const pagePoint = displayMode.windowToPage(point, pageNumber);
      const zoom = docViewer.getZoom();

      const stampAnnot = new Annotations.StampAnnotation();
      stampAnnot.PageNumber = pageNumber;
      const rotation = docViewer.getCompleteRotation(pageNumber) * 90;
      stampAnnot.Rotation = rotation;
      if (rotation === 270 || rotation === 90) {
        stampAnnot.Width = rect.height / zoom;
        stampAnnot.Height = rect.width / zoom;
      } else {
        stampAnnot.Width = rect.width / zoom;
        stampAnnot.Height = rect.height / zoom;
      }
      stampAnnot.X = (pagePoint.x || pageInfo.width / 2) - stampAnnot.Width / 2;
      stampAnnot.Y = (pagePoint.y || pageInfo.height / 2) - stampAnnot.Height / 2;

      stampAnnot.ImageData = imgData;
      stampAnnot.Author = annotManager.getCurrentUser();

      annotManager.deselectAllAnnotations();
      annotManager.addAnnotation(stampAnnot);
      annotManager.redrawAnnotation(stampAnnot);
      annotManager.selectAnnotation(stampAnnot);
    };

    // create a stamp image copy for drag and drop
    const sampleImg = document.getElementById('sample-image');
    const div = document.createElement('div');
    const img = document.createElement('img');
    img.id = 'sample-image-copy';
    div.appendChild(img);
    div.style.position = 'absolute';
    div.style.top = '-500px';
    div.style.left = '-500px';
    document.body.appendChild(div);
    const el = sampleImg.firstElementChild;
    img.src = el.src;
    const height = el.height;
    const drawImage = () => {
      const width = (height / img.height) * img.width;
      img.style.width = `${width}px`;
      img.style.height = `${height}px`;
      const c = document.createElement('canvas');
      const ctx = c.getContext('2d');
      c.width = width;
      c.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      img.src = c.toDataURL();
    };
    img.onload = drawImage;

    sampleImg.ondragstart = e => {
      e.target.style.opacity = 0.5;
      const copy = e.target.cloneNode(true);
      copy.id = 'stamp-image-drag-copy';
      const el = document.getElementById('sample-image-copy');
      copy.src = el.src;
      copy.style.width = el.width;
      copy.style.height = el.height;
      copy.style.padding = 0;
      copy.style.position = 'absolute';
      copy.style.top = '-1000px';
      copy.style.left = '-1000px';
      document.body.appendChild(copy);
      e.dataTransfer.setDragImage(copy, copy.width * 0.5, copy.height * 0.5);
      e.dataTransfer.setData('text', '');
    };

    sampleImg.ondragend = e => {
      const el = document.getElementById('stamp-image-drag-copy');
      addStamp(e.target.src, dropPoint, el.getBoundingClientRect());
      e.target.style.opacity = 1;
      document.body.removeChild(document.getElementById('stamp-image-drag-copy'));
      e.preventDefault();
    };

    sampleImg.onclick = e => {
      addStamp(e.target.src, {}, document.getElementById('sample-image-copy'));
    };

    document.getElementById('file-open').onchange = e => {
      const fileReader = new FileReader();
      fileReader.onload = () => {
        const result = fileReader.result;
        const uploadImg = new Image();
        uploadImg.onload = () => {
          const imgWidth = 250;
          addStamp(result, {}, { width: imgWidth, height: (uploadImg.height / uploadImg.width) * imgWidth });
        };
        uploadImg.src = result;
      };
      if (e.target.files && e.target.files.length > 0) {
        fileReader.readAsDataURL(e.target.files[0]);
      }
    };
  });
})(window);
