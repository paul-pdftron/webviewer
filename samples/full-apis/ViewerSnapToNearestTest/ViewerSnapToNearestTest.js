(() => {
  let snapMode;

  const getMouseLocation = e => {
    const scrollElement = readerControl.docViewer.getScrollViewElement();
    const scrollLeft = scrollElement.scrollLeft || 0;
    const scrollTop = scrollElement.scrollTop || 0;

    return {
      x: e.pageX + scrollLeft,
      y: e.pageY + scrollTop,
    };
  };

  const mouseToPagePoint = e => {
    const displayMode = readerControl.docViewer.getDisplayModeManager().getDisplayMode();
    const windowPoint = getMouseLocation(e);

    const page = displayMode.getSelectedPages(windowPoint, windowPoint);
    const pageNumber = page.first !== null ? page.first : readerControl.docViewer.getCurrentPage();

    return {
      point: displayMode.windowToPage(windowPoint, pageNumber),
      pageNumber,
    };
  };

  const createSnapModesPanel = () => {
    const snapModesPanel = {
      tab: {
        dataElement: 'snapModesPanelTab',
        title: 'snapModesPanelTab',
        img:
          '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24"><defs><path id="a" d="M0 0h24v24H0V0z"/></defs><clipPath id="b"><use xlink:href="#a" overflow="visible"/></clipPath><path clip-path="url(#b)" d="M19.5 9.5c-1.03 0-1.9.62-2.29 1.5h-2.92c-.39-.88-1.26-1.5-2.29-1.5s-1.9.62-2.29 1.5H6.79c-.39-.88-1.26-1.5-2.29-1.5C3.12 9.5 2 10.62 2 12s1.12 2.5 2.5 2.5c1.03 0 1.9-.62 2.29-1.5h2.92c.39.88 1.26 1.5 2.29 1.5s1.9-.62 2.29-1.5h2.92c.39.88 1.26 1.5 2.29 1.5 1.38 0 2.5-1.12 2.5-2.5s-1.12-2.5-2.5-2.5z"/></svg>',
      },
      panel: {
        dataElement: 'snapModesPanel',
        render: () => {
          const { DEFAULT, POINT_ON_LINE, LINE_MID_POINT, LINE_INTERSECTION, PATH_ENDPOINT } = readerControl.docViewer.SnapMode;

          const buttonContainer = document.createElement('div');
          const map = {
            Default: DEFAULT,
            'Point On Line': POINT_ON_LINE,
            'Line Midpoint': LINE_MID_POINT,
            'Line Intersection': LINE_INTERSECTION,
            'Path Endpoint': PATH_ENDPOINT,
          };
          Object.keys(map).forEach(key => {
            const div = document.createElement('div');
            div.style.margin = '0px 0px 12px 12px';

            const radioBtn = document.createElement('input');
            radioBtn.type = 'radio';
            radioBtn.style.marginRight = '10px';
            radioBtn.name = 'snapMode';
            radioBtn.value = map[key];
            radioBtn.id = key;
            radioBtn.addEventListener('change', e => {
              snapMode = parseInt(e.target.value, 10);
            });

            const label = document.createElement('label');
            label.innerHTML = key;
            label.for = key;

            div.appendChild(radioBtn);
            div.appendChild(label);
            buttonContainer.appendChild(div);
          });

          // make the default radio button checked
          buttonContainer.querySelector('input[id="Default"]').checked = true;

          return buttonContainer;
        },
      },
    };

    readerControl.setCustomPanel(snapModesPanel);
  };

  window.addEventListener('documentLoaded', () => {
    createSnapModesPanel();
    readerControl.openElements(['snapModesPanel']);

    const lineAnnot = new Annotations.LineAnnotation();
    lineAnnot.setStartPoint(0, 0);
    lineAnnot.setEndPoint(0, 0);
    lineAnnot.PageNumber = 1;

    const annotManager = readerControl.docViewer.getAnnotationManager();
    annotManager.addAnnotation(lineAnnot);

    readerControl.docViewer.on('mouseMove', e => {
      const result = mouseToPagePoint(e);
      const pagePoint = result.point;
      const pageNumber = result.pageNumber;
      const oldPageNumber = lineAnnot.PageNumber;

      lineAnnot.PageNumber = pageNumber;
      lineAnnot.setStartPoint(pagePoint.x, pagePoint.y);
      // refresh old page since line annotation has been removed from it
      if (pageNumber !== oldPageNumber) {
        annotManager.drawAnnotations(oldPageNumber);
      }

      readerControl.docViewer.snapToNearest(pageNumber, pagePoint.x, pagePoint.y, snapMode).then(snapPoint => {
        lineAnnot.setEndPoint(snapPoint.x, snapPoint.y);
        annotManager.redrawAnnotation(lineAnnot);
      });
    });
  });
})(window);
// eslint-disable-next-line spaced-comment
//# sourceURL=config.js
