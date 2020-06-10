(function(exports) {
  // To help us identify that the annotation is of type Triangle
  const TRIANGLE_ANNOT_ID = 'triangle';
  const ANNOT_TYPE = 'AnnotType;';
  /**
   * Don't use arrow function because context of 'this' matters
   */
  function TriangleAnnotationFactory(Annotations) {
    const TriangleAnnotation = function() {
      Annotations.MarkupAnnotation.call(this);
      this.Subject = 'Triangle';
      this[ANNOT_TYPE] = TRIANGLE_ANNOT_ID;
      this.vertices = [];
      const numVertices = 3;
      for (let i = 0; i < numVertices; ++i) {
        this.vertices.push({
          x: 0,
          y: 0,
        });
      }
    };

    TriangleAnnotation.prototype = new Annotations.MarkupAnnotation();

    TriangleAnnotation.prototype.elementName = 'triangle';

    const triangleSelectionModel = exports.TriangleSelectionModelFactory.initialize(Annotations);
    TriangleAnnotation.prototype.selectionModel = triangleSelectionModel;

    TriangleAnnotation.prototype.draw = function(ctx, pageMatrix) {
      // the setStyles function is a function on markup annotations that sets up
      // certain properties for us on the canvas for the annotation's stroke thickness.
      this.setStyles(ctx, pageMatrix);

      ctx.beginPath();
      ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
      ctx.lineTo(this.vertices[1].x, this.vertices[1].y);
      ctx.lineTo(this.vertices[2].x, this.vertices[2].y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    };

    TriangleAnnotation.prototype.resize = function(rect) {
      // this function is only called when the annotation is dragged
      // since we handle the case where the control handles move
      const annotRect = this.getRect();
      const deltaX = rect.x1 - annotRect.x1;
      const deltaY = rect.y1 - annotRect.y1;

      // shift the vertices by the amount the rect has shifted
      this.vertices = this.vertices.map(vertex => {
        vertex.x += deltaX;
        vertex.y += deltaY;
        return vertex;
      });
      this.setRect(rect);
    };

    TriangleAnnotation.prototype.serialize = function(element, pageMatrix) {
      const el = Annotations.MarkupAnnotation.prototype.serialize.call(this, element, pageMatrix);
      el.setAttribute('vertices', Annotations.XfdfUtils.serializePointArray(this.vertices, pageMatrix));
      return el;
    };

    TriangleAnnotation.prototype.deserialize = function(element, pageMatrix) {
      Annotations.MarkupAnnotation.prototype.deserialize.call(this, element, pageMatrix);
      this.vertices = Annotations.XfdfUtils.deserializePointArray(element.getAttribute('vertices'), pageMatrix);
    };

    return TriangleAnnotation;
  }

  exports.TriangleAnnotationFactory = {
    initialize: TriangleAnnotationFactory,
    TRIANGLE_ANNOT_ID,
    ANNOT_TYPE,
  };
})(window);
