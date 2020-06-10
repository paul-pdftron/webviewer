//---------------------------------------------------------------------------------------
// Copyright (c) 2001-2019 by PDFTron Systems Inc. All Rights Reserved.
// Consult legal.txt regarding legal and license information.
//---------------------------------------------------------------------------------------

(exports => {
  // @link PDFNet: https://www.pdftron.com/api/web/PDFNet.html
  // @link PDFNet.PDFDoc: https://www.pdftron.com/api/web/PDFNet.PDFDoc.html
  const PDFNet = exports.PDFNet;
  const CoreControls = exports.CoreControls;

  const convertOfficeToPDF = (inputUrl, outputName, l) =>
    CoreControls.office2PDFBuffer(inputUrl, { l }).then(buffer => {
      saveBufferAsPDFDoc(buffer, outputName);
      console.log('Finished downloading ' + outputName);
    });

  exports.runOfficeToPDF = () => {
    const inputDir = '../TestFiles/';
    const docxFilename = 'simple-word_2007.docx';
    const pptxFilename = 'simple-powerpoint_2007.pptx';
    const xlsxFilename = 'simple-excel_2007.xlsx';

    PDFNet.initialize()
      .then(() => convertOfficeToPDF(inputDir + docxFilename, 'converted_docx.pdf'))
      .then(() => convertOfficeToPDF(inputDir + pptxFilename, 'converted_pptx.pdf'))
      .then(() => convertOfficeToPDF(inputDir + xlsxFilename, 'converted_xlsx.pdf'))
      .then(() => {
        console.log('Test Complete!');
      })
      .catch(err => {
        console.log('An error was encountered! :(', err);
      });
  };
})(window);
// eslint-disable-next-line spaced-comment
//# sourceURL=OfficeToPDFTest.js
