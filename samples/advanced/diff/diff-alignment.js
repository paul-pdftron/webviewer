(function(exports) {
  // If angle is positive, it is rotated clockwise
  // https://en.wikipedia.org/wiki/Rotation_matrix
  const rotatedX = (x, y, radianAngle) => {
    return x * Math.cos(radianAngle) + y * Math.sin(radianAngle);
  };

  // If angle is positive, it is rotated clockwise
  // https://en.wikipedia.org/wiki/Rotation_matrix
  const rotatedY = (x, y, radianAngle) => {
    return -1 * x * Math.sin(radianAngle) + y * Math.cos(radianAngle);
  };

  // https://stackoverflow.com/questions/27205018/multiply-2-matrices-in-javascript
  const multiply = (a, b) => {
    const aNumRows = a.length;
    const aNumCols = a[0].length;
    const bNumCols = b[0].length;
    const m = new Array(aNumRows); // initialize array of rows
    for (let r = 0; r < aNumRows; ++r) {
      m[r] = new Array(bNumCols); // initialize the current row
      for (let c = 0; c < bNumCols; ++c) {
        m[r][c] = 0; // initialize the current cell
        for (let i = 0; i < aNumCols; ++i) {
          m[r][c] += a[r][i] * b[i][c];
        }
      }
    }
    return m;
  };

  // Use this fxn to retrieve the actual page matrix rather than using canvasContext.getTransform / Document.getPageMatrix
  // As this matrix accounts for scaling / zoom / rotation
  const retrievePageMatrix = (instance, pageIndex) => {
    const docViewer = instance.docViewer;
    const pageNumber = pageIndex + 1;
    const pageRotation = docViewer.getCompleteRotation(pageNumber);
    const pageWidth = docViewer.getPageWidth(pageNumber);
    const pageHeight = docViewer.getPageHeight(pageNumber);
    const zoom = docViewer.getPageZoom(pageNumber);

    // defined in CoreControls
    const pageMatrix = window.getPageMatrix(zoom, pageRotation, { width: pageWidth, height: pageHeight }, 0, true, instance.iframeWindow.utils.getCanvasMultiplier());
    // convert page matrix to have native DOM matrix property
    return {
      a: pageMatrix.m_a,
      b: pageMatrix.m_b,
      c: pageMatrix.m_c,
      d: pageMatrix.m_d,
      e: pageMatrix.m_h,
      f: pageMatrix.m_v,
    };
  };

  const getLineLength = (x1, y1, x2, y2) => {
    const deltaX = x2 - x1;
    const deltaY = y2 - y1;
    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  };

  const createCanvasForLineAlignment = (canvasWidth, canvasHeight, matrix, srcLineStartPoint, srcLineEndPoint, targetLineStartPoint, targetLineEndPoint, canvasMultiplier) => {
    const result = exports.DiffUtil.createCanvas(canvasWidth, canvasHeight, canvasMultiplier);
    const resultCtx = result.getContext('2d');

    // https://math.stackexchange.com/questions/1544147/find-transform-matrix-that-transforms-one-line-segment-to-another
    // Observe order of operations in the visual diagram for accepted answer
    let srcLineAngleToOrigin = Math.atan2(srcLineEndPoint.y - srcLineStartPoint.y, srcLineEndPoint.x - srcLineStartPoint.x);
    const targetLineAngleToOrigin = Math.atan2(targetLineEndPoint.y - targetLineStartPoint.y, targetLineEndPoint.x - targetLineStartPoint.x);

    resultCtx.setTransform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
    // Translate source line to start point so that it can be rotated properly
    resultCtx.translate(srcLineStartPoint.x, srcLineStartPoint.y);

    // Change rotation angle such that start point is always to the left of the end point
    if (srcLineStartPoint.x > srcLineEndPoint.x || srcLineStartPoint.y > srcLineEndPoint.y) {
      // start point is farther from end point
      srcLineAngleToOrigin *= -1;
    } else if (srcLineAngleToOrigin > 0) {
      // end point is farther from start point
      srcLineAngleToOrigin *= -1;
    }
    // rotate such that the canvas is now sitting on the x-axis
    resultCtx.rotate(srcLineAngleToOrigin);

    // get line lengths so we know how much to scale source line by to match line length of target line
    const srcLineLength = getLineLength(srcLineStartPoint.x, srcLineStartPoint.y, srcLineEndPoint.x, srcLineEndPoint.y);
    const targetLineLength = getLineLength(targetLineStartPoint.x, targetLineStartPoint.y, targetLineEndPoint.x, targetLineEndPoint.y);
    const scaleFactor = targetLineLength / srcLineLength / canvasMultiplier;

    resultCtx.scale(scaleFactor, scaleFactor);
    resultCtx.rotate(targetLineAngleToOrigin);

    // Translate canvas draw point such that its back to origin (0,0)
    // Note that we account of the scaling as well so that it can be translated with the appropriate units
    const translateXBack = -rotatedX(srcLineStartPoint.x, srcLineStartPoint.y, srcLineAngleToOrigin + targetLineAngleToOrigin) / scaleFactor;
    const translateYBack = -rotatedY(srcLineStartPoint.x, srcLineStartPoint.y, srcLineAngleToOrigin + targetLineAngleToOrigin) / scaleFactor;

    resultCtx.translate(translateXBack, translateYBack);

    // Translate canvas origin (0,0) such that it is at the same coordinate as the start point of the target line
    resultCtx.translate(
      rotatedX(targetLineStartPoint.x, targetLineStartPoint.y, srcLineAngleToOrigin + targetLineAngleToOrigin) / scaleFactor,
      rotatedY(targetLineStartPoint.x, targetLineStartPoint.y, srcLineAngleToOrigin + targetLineAngleToOrigin) / scaleFactor
    );

    // Translate the canvas such that the start point of the source line = start point of target line
    resultCtx.translate(-srcLineStartPoint.x * canvasMultiplier, -srcLineStartPoint.y * canvasMultiplier);

    return result;
  };

  const createBoundingBoxFromTransformationMatrix = (matrix, minX, minY, maxX, maxY) => {
    let point = [[minX], [minY], [1]];
    const topLeft = multiply(matrix, point);
    const topLeftX = topLeft[0][0];
    const topLeftY = topLeft[1][0];

    point = [[maxX], [minY], [1]];
    const topRight = multiply(matrix, point);
    const topRightX = topRight[0][0];
    const topRightY = topRight[1][0];

    point = [[minX], [maxY], [1]];
    const botLeft = multiply(matrix, point);

    const botLeftX = botLeft[0][0];
    const botLeftY = botLeft[1][0];

    point = [[maxX], [maxY], [1]];
    const botRight = multiply(matrix, point);

    const botRightX = botRight[0][0];
    const botRightY = botRight[1][0];

    const minXResult = Math.min(topLeftX, topRightX, botLeftX, botRightX);
    const maxXResult = Math.max(topLeftX, topRightX, botLeftX, botRightX);
    const minYResult = Math.min(topLeftY, topRightY, botLeftY, botRightY);
    const maxYResult = Math.max(topLeftY, topRightY, botLeftY, botRightY);

    return [minXResult, minYResult, maxXResult, maxYResult];
  };
  exports.DiffAlignment = {
    multiply,
    rotatedX,
    rotatedY,
    retrievePageMatrix,
    createCanvasForLineAlignment,
    createBoundingBoxFromTransformationMatrix,
  };
})(window);
