(function(exports) {
  /**
   * Don't use arrow function because context of 'this' matters
   */
  function TriangleCreateToolFactory(Annotations, Tools) {
    const TriangleCreateTool = function(docViewer) {
      // TriangleAnnotation is the constructor function for our annotation we defined previously
      Tools.GenericAnnotationCreateTool.call(this, docViewer, exports.TriangleAnnotationFactory.initialize(Annotations));
    };

    TriangleCreateTool.prototype = new Tools.GenericAnnotationCreateTool();

    TriangleCreateTool.prototype.mouseMove = function(e) {
      // call the parent mouseMove first
      Tools.GenericAnnotationCreateTool.prototype.mouseMove.call(this, e);
      if (this.annotation) {
        this.annotation.vertices[0].x = this.annotation.X + this.annotation.Width / 2;
        this.annotation.vertices[0].y = this.annotation.Y;
        this.annotation.vertices[1].x = this.annotation.X + this.annotation.Width;
        this.annotation.vertices[1].y = this.annotation.Y + this.annotation.Height;
        this.annotation.vertices[2].x = this.annotation.X;
        this.annotation.vertices[2].y = this.annotation.Y + this.annotation.Height;

        // update the annotation appearance
        this.docViewer.getAnnotationManager().redrawAnnotation(this.annotation);
      }
    };

    return TriangleCreateTool;
  }

  exports.TriangleCreateToolFactory = {
    initialize: TriangleCreateToolFactory,
  };
})(window);
