(function(exports) {
  /**
   * Don't use arrow function because context of 'this' matters
   */
  function TriangleControlHandleFactory(Annotations) {
    const TriangleControlHandle = function(annotation, index) {
      this.annotation = annotation;
      // set the index of this control handle so that we know which vertex it corresponds to
      this.index = index;
    };

    TriangleControlHandle.prototype = new Annotations.ControlHandle();

    // returns a rect that should represent the control handle's position and size
    TriangleControlHandle.prototype.getDimensions = function(annotation, selectionBox, zoom) {
      let x = annotation.vertices[this.index].x;
      let y = annotation.vertices[this.index].y;
      const width = Annotations.ControlHandle.handleWidth / zoom;
      const height = Annotations.ControlHandle.handleHeight / zoom;

      // adjust for the control handle's own width and height
      x -= width * 0.5;
      y -= height * 0.5;
      return new Annotations.Rect(x, y, x + width, y + height);
    };

    TriangleControlHandle.prototype.draw = function(ctx, annotation, selectionBox, zoom) {
      const dim = this.getDimensions(annotation, selectionBox, zoom);
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(dim.x1 + dim.getWidth() / 2, dim.y1);
      ctx.lineTo(dim.x1 + dim.getWidth(), dim.y1 + dim.getHeight());
      ctx.lineTo(dim.x1, dim.y1 + dim.getHeight());
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
    };

    // this function is called when the control handle is dragged
    TriangleControlHandle.prototype.move = function(annotation, deltaX, deltaY, fromPoint, toPoint) {
      annotation.vertices[this.index].x += deltaX;
      annotation.vertices[this.index].y += deltaY;

      // recalculate the X, Y, width and height of the annotation
      let minX = Number.MAX_VALUE;
      let maxX = -Number.MAX_VALUE;
      let minY = Number.MAX_VALUE;
      let maxY = -Number.MAX_VALUE;
      for (let i = 0; i < annotation.vertices.length; ++i) {
        const vertex = annotation.vertices[i];
        minX = Math.min(minX, vertex.x);
        maxX = Math.max(maxX, vertex.x);
        minY = Math.min(minY, vertex.y);
        maxY = Math.max(maxY, vertex.y);
      }

      const rect = new Annotations.Rect(minX, minY, maxX, maxY);
      annotation.setRect(rect);
      // return true if redraw is needed
      return true;
    };
    return TriangleControlHandle;
  }

  exports.TriangleControlHandleFactory = {
    initialize: TriangleControlHandleFactory,
  };
})(window);
