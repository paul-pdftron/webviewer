// @link WebViewerInstance: https://www.pdftron.com/api/web/WebViewerInstance.html
// @link WebViewerInstance.openElements: https://www.pdftron.com/api/web/WebViewerInstance.html#openElements__anchor

// @link AnnotationManager: https://www.pdftron.com/api/web/CoreControls.AnnotationManager.html
// @link AnnotationManager.importAnnotCommand: https://www.pdftron.com/api/web/CoreControls.AnnotationManager.html#importAnnotCommand__anchor
// @link AnnotationManager.redrawAnnotation: https://www.pdftron.com/api/web/CoreControls.AnnotationManager.html#redrawAnnotation__anchor
// @link AnnotationManager.setCurrentUser: https://www.pdftron.com/api/web/CoreControls.AnnotationManager.html#setCurrentUser__anchor
// @link AnnotationManager.getAnnotCommand: https://www.pdftron.com/api/web/CoreControls.AnnotationManager.html#getAnnotCommand__anchor
// @link AnnotationManager.getAnnotationbyId: https://www.pdftron.com/api/web/CoreControls.AnnotationManager.html#getAnnotationById__anchor
// @link AnnotationManager.updateAnnotation: https://www.pdftron.com/api/web/CoreControls.AnnotationManager.html#updateAnnotation__anchor
// @link AnnotationManager.setPermissionCheckCallback: https://www.pdftron.com/api/web/CoreControls.AnnotationManager.html#setPermissionCheckCallback__anchor

// eslint-disable-next-line no-undef
const server = new Server();

WebViewer(
  {
    path: '../../../lib',
    pdftronServer: 'https://demo.pdftron.com/', // comment this out to do client-side only
    initialDoc: 'https://pdftron.s3.amazonaws.com/downloads/pl/demo-annotated.pdf',
  },
  document.getElementById('viewer')
).then(instance => {
  samplesSetup(instance);
  const { docViewer, annotManager } = instance;
  const urlInput = document.getElementById('url');
  const copyButton = document.getElementById('copy');
  instance.openElements(['notesPanel']);

  let hasSeenPopup = false;

  if (window.location.origin === 'http://localhost:3000') {
    const xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = () => {
      if (xhttp.readyState === 4 && xhttp.status === 200) {
        urlInput.value = `http://${xhttp.responseText}:3000/samples/annotation/realtime-collaboration/`;
      }
    };
    xhttp.open('GET', '/ip', true);
    xhttp.send();
  } else {
    urlInput.value = 'https://pdftron.com/samples/web/samples/annotation/realtime-collaboration/';
  }

  copyButton.onclick = () => {
    urlInput.select();
    document.execCommand('copy');
    document.getSelection().empty();
  };

  docViewer.on('documentLoaded', () => {
    let authorId = null;

    const onAnnotationCreated = async data => {
      // Import the annotation based on xfdf command
      const annotations = await annotManager.importAnnotCommand(data.val().xfdf);
      const annotation = annotations[0];
      if (annotation) {
        await annotation.resourcesLoaded();
        // Set a custom field authorId to be used in client-side permission check
        annotation.authorId = data.val().authorId;
        annotManager.redrawAnnotation(annotation);
        // viewerInstance.fireEvent('updateAnnotationPermission', [annotation]); //TODO
      }
    };

    const onAnnotationUpdated = async data => {
      // Import the annotation based on xfdf command
      const annotations = await annotManager.importAnnotCommand(data.val().xfdf);
      const annotation = annotations[0];
      if (annotation) {
        await annotation.resourcesLoaded();
        // Set a custom field authorId to be used in client-side permission check
        annotation.authorId = data.val().authorId;
        annotManager.redrawAnnotation(annotation);
      }
    };

    const onAnnotationDeleted = data => {
      // data.key would return annotationId since our server method is designed as
      // annotationsRef.child(annotationId).set(annotationData)
      const command = `<delete><id>${data.key}</id></delete>`;
      annotManager.importAnnotCommand(command);
    };

    const openReturningAuthorPopup = authorName => {
      if (hasSeenPopup) {
        return;
      }
      // The author name will be used for both WebViewer and annotations in PDF
      annotManager.setCurrentUser(authorName);
      // Open popup for the returning author
      window.alert(`Welcome back ${authorName}`);
      hasSeenPopup = true;
    };

    const updateAuthor = authorName => {
      // The author name will be used for both WebViewer and annotations in PDF
      annotManager.setCurrentUser(authorName);
      // Create/update author information in the server
      server.updateAuthor(authorId, { authorName });
    };

    const openNewAuthorPopup = () => {
      // Open prompt for a new author
      const name = window.prompt('Welcome! Tell us your name :)');
      if (name) {
        updateAuthor(name);
      }
    };

    // Bind server-side authorization state change to a callback function
    // The event is triggered in the beginning as well to check if author has already signed in
    server.bind('onAuthStateChanged', user => {
      // Author is logged in
      if (user) {
        // Using uid property from Firebase Database as an author id
        // It is also used as a reference for server-side permission
        authorId = user.uid;
        // Check if author exists, and call appropriate callback functions
        server.checkAuthor(authorId, openReturningAuthorPopup, openNewAuthorPopup);
        // Bind server-side data events to callback functions
        // When loaded for the first time, onAnnotationCreated event will be triggered for all database entries
        server.bind('onAnnotationCreated', onAnnotationCreated);
        server.bind('onAnnotationUpdated', onAnnotationUpdated);
        server.bind('onAnnotationDeleted', onAnnotationDeleted);
      } else {
        // Author is not logged in
        server.signInAnonymously();
      }
    });

    // Bind annotation change events to a callback function
    annotManager.on('annotationChanged', async (annotations, type, info) => {
      // info.imported is true by default for annotations from pdf and annotations added by importAnnotCommand
      if (info.imported) {
        return;
      }

      const xfdf = await annotManager.exportAnnotCommand();
      // Iterate through all annotations and call appropriate server methods
      annotations.forEach(annotation => {
        let parentAuthorId = null;
        if (type === 'add') {
          // In case of replies, add extra field for server-side permission to be granted to the
          // parent annotation's author
          if (annotation.InReplyTo) {
            parentAuthorId = annotManager.getAnnotationById(annotation.InReplyTo).authorId || 'default';
          }

          if (authorId) {
            annotation.authorId = authorId;
          }

          server.createAnnotation(annotation.Id, {
            authorId,
            parentAuthorId,
            xfdf,
          });
        } else if (type === 'modify') {
          // In case of replies, add extra field for server-side permission to be granted to the
          // parent annotation's author
          if (annotation.InReplyTo) {
            parentAuthorId = annotManager.getAnnotationById(annotation.InReplyTo).authorId || 'default';
          }
          server.updateAnnotation(annotation.Id, {
            authorId,
            parentAuthorId,
            xfdf,
          });
        } else if (type === 'delete') {
          server.deleteAnnotation(annotation.Id);
        }
      });
    });

    // Overwrite client-side permission check method on the annotation manager
    // The default was set to compare the authorName
    // Instead of the authorName, we will compare authorId created from the server
    annotManager.setPermissionCheckCallback((author, annotation) => annotation.authorId === authorId);
  });
});
