const util = require('util');
const exec = util.promisify(require('child_process').exec);
const path = require('path');

const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const MAGENTA = '\x1b[35m';
const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const BLINK = '\x1b[5m';
const UNDER = '\x1b[4m';

const resourceDir = path.resolve(__dirname, '../webviewer-salesforce/');
const resourcesForZip = [
  [`${resourceDir}/resource`],
  [`${resourceDir}/external`],
];
const globalPrompt = {
  message: "Answer must be 'y' or 'n'",
  pattern: /^[yn]$/,
  required: true,
  type: 'string',
};


(async() => {
  try {
    require.resolve('prompt');
    require.resolve('fs-extra');
    require.resolve('archiver');
  } catch (e) {
    console.log(CYAN, 'Installing required dependencies...', RESET);
    await exec('npm i prompt --save-dev && npm i fs-extra --save-dev && npm i archiver --save-dev');
  }

  console.log(CYAN, '\nThis script will delete any files you won\'t be using in your lib folder. Please use with caution!');
  console.log(CYAN, `\nPress CTRL + C at any time to safely cancel this process. If you are unsure of any answer, ${UNDER}please clarify${RESET}${CYAN} before answering them.`, RESET);

  const prompt = require('prompt');
  const fs = require('fs-extra');
  const archiver = require('archiver');

  prompt.start();
  prompt.message = `${MAGENTA}\nOptimize`;
  prompt.delimiter = `: ${RESET}`;

  const backupExists = await fs.pathExists(path.resolve(__dirname, '../lib-backup'));
  if (backupExists) {
    console.log(CYAN, '\nA backup will not be created because a backup already exists!');
  }

  const schema = {
    properties: {
      backup: {
        description: `Do you want us to backup your files before optimizing? [y/n]${RESET}`,
        ask: () => !backupExists,
        ...globalPrompt,
      },
      webViewerServer: {
        description: `Will you be using WebViewer Server? See ${CYAN}https://www.pdftron.com/documentation/web/guides/wv-server/${RESET}${DIM} for more info. [y/n]${RESET}`,
        ...globalPrompt,
      },
      xod: {
        description: `Will you be converting all your documents to XOD? See ${CYAN}https://www.pdftron.com/documentation/web/guides/optimize-lib-folder${RESET}${DIM} for more info. [y/n]${RESET}`,
        ...globalPrompt,
        ask: () => prompt.history('webViewerServer').value === 'n',
      },
      office: {
        description: `Do you need client side office support? [y/n]${RESET}`,
        ...globalPrompt,
        ask: () => prompt.history('xod') && prompt.history('xod').value === 'n' && prompt.history('webViewerServer').value === 'n',
      },
      type: {
        description: `Do you need the full PDF API? See ${CYAN}https://www.pdftron.com/documentation/web/guides/optimize-lib-folder${RESET}${DIM} for more info (most users dont need this option). [y/n]${RESET}`,
        ...globalPrompt,
        ask: () => prompt.history('xod') && prompt.history('xod').value === 'n' && prompt.history('webViewerServer').value === 'n',
      },
      pdfnetProd: {
        description: `Do you want to use the production version of PDFNet.js? The production version does not have type checking and console messages, but is much smaller than the development version. [y/n]${RESET}`,
        ...globalPrompt,
        ask: () => prompt.history('type') && prompt.history('type').value === 'y',
      },
      salesforce: {
        description: `Do you need to deploy to Salesforce? See ${CYAN}https://www.pdftron.com/documentation/web/guides/optimize-lib-folder${RESET}${DIM} for more info (most users dont need this option). [y/n]${RESET}`,
        ...globalPrompt,
        ask: () => prompt.history('xod') && prompt.history('xod').value === 'n' && prompt.history('webViewerServer').value === 'n',
      },
    },
  };

  prompt.get(schema, (err, result) => {
    if (err) {
      console.log(`\n\n${RED}Process exited. No action will be taken.${RESET}\n`);
      return;
    }

    const {
      xod = 'n',
      office = 'n',
      type = 'n',
      pdfnetProd = 'n',
      backup = 'n',
      salesforce = 'n',
      webViewerServer = 'n',
    } = result;

    const filesToDelete = [];
    const filesToDeleteForSalesforce = [];

    const filesToRelocate = [
      [path.resolve(__dirname, '../lib/core/pdf/pdfnet.res'), `${resourceDir}/resource`],
      [path.resolve(__dirname, '../lib/core/pdf/PDFworker.js'), `${resourceDir}/resource`],
      [path.resolve(__dirname, '../lib/core/pdf/ResizableWorker.js'), `${resourceDir}/resource`],
      [path.resolve(__dirname, '../lib/core/external/'), `${resourceDir}/`, true],
      [path.resolve(__dirname, '../lib/core/assets'), `${resourceDir}/lib/core/`, true],
      [path.resolve(__dirname, '../lib/core/external'), `${resourceDir}/lib/core/`, true],
      [path.resolve(__dirname, '../lib/core/pdf/PDFNet.js'), `${resourceDir}/lib/core/pdf/`, true],
      [path.resolve(__dirname, '../lib/core/CoreControls.js'), `${resourceDir}/lib/core/`, true],
      [path.resolve(__dirname, '../lib/core/CORSWorker.js'), `${resourceDir}/lib/core/`, true],
      [path.resolve(__dirname, '../lib/core/DecryptWorker.js'), `${resourceDir}/lib/core/`, true],
      [path.resolve(__dirname, '../lib/core/Worker.js'), `${resourceDir}/lib/core/`, true],
      [path.resolve(__dirname, '../lib/package.json'), `${resourceDir}/lib/`, true],
      [path.resolve(__dirname, '../lib/webviewer.min.js'), `${resourceDir}/lib/`, true],
      [path.resolve(__dirname, '../lib/ui'), `${resourceDir}/lib/`, true],
    ];


    // Add chunk files to filesToRelocate
    let files = fs.readdirSync(path.resolve(__dirname, '../lib/core'));
    files = files.filter((file) => file.indexOf('.chunk.') > -1);
    files.forEach((file) => {
      filesToRelocate.push([path.resolve(__dirname, `../lib/core/${file}`), `${resourceDir}/lib/core/`, true]);
    });

    // If they are not using XOD
    if (webViewerServer === 'n' && xod === 'n') {
      // if they dont need office
      if (office === 'n') {
        filesToDelete.push(
          path.resolve(__dirname, '../lib/core/office'),
        );
      } else {
        filesToRelocate.push(
          [path.resolve(__dirname, '../lib/core/office/OfficeWorker.js'), `${resourceDir}/office`],
          [path.resolve(__dirname, '../lib/core/office/WebOfficeWorkerWasm.br.wasm'), `${resourceDir}/office`],
          [path.resolve(__dirname, '../lib/core/office/WebOfficeWorkerWasm.br.js.mem'), `${resourceDir}/office`],
          [path.resolve(__dirname, '../lib/core/office/WebOfficeWorker.br.js.mem'), `${resourceDir}/office_asm`],
          [path.resolve(__dirname, '../lib/core/office/WebOfficeWorker.br.mem'), `${resourceDir}/office_resource`],
        );
        resourcesForZip.push(
          [`${resourceDir}/office`],
          [`${resourceDir}/office_asm`],
          [`${resourceDir}/office_resource`],
        );
      }

      // If they dont need the full api
      if (type === 'n') {
        filesToDelete.push(
          path.resolve(__dirname, '../lib/core/pdf/full'),
        );
        filesToRelocate.push(
          [path.resolve(__dirname, '../lib/core/pdf/lean/PDFNetCWasm.br.js.mem'), `${resourceDir}/pdf_lean/lean`],
          [path.resolve(__dirname, '../lib/core/pdf/lean/PDFNetCWasm.br.wasm'), `${resourceDir}/pdf_lean/lean`],
          [path.resolve(__dirname, '../lib/core/pdf/lean/PDFNetC.br.js.mem'), `${resourceDir}/asm_lean/lean`],
          [path.resolve(__dirname, '../lib/core/pdf/lean/PDFNetC.gz.mem'), `${resourceDir}/resource/lean`],
        );
        resourcesForZip.push(
          [`${resourceDir}/pdf_lean`],
          [`${resourceDir}/asm_lean`],
        );
      }
      // If they do need the full API
      else {
        filesToDelete.push(
          path.resolve(__dirname, '../lib/core/pdf/lean'),
        );

        if (pdfnetProd === 'y') {
          // replace PDFNet.js with PDFNet.prod.js
          fs.removeSync(path.resolve(__dirname, '../lib/core/pdf/PDFNet.js'));
          fs.renameSync(
            path.resolve(__dirname, '../lib/core/pdf/PDFNet.prod.js'),
            path.resolve(__dirname, '../lib/core/pdf/PDFNet.js'),
          );
        } else {
          fs.removeSync(path.resolve(__dirname, '../lib/core/pdf/PDFNet.prod.js'));
        }

        filesToRelocate.push(
          [path.resolve(__dirname, '../lib/core/pdf/full/PDFNetCWasm.br.js.mem'), `${resourceDir}/pdf_full/full`],
          [path.resolve(__dirname, '../lib/core/pdf/full/PDFNetCWasm.br.wasm'), `${resourceDir}/pdf_full/full`],
          [path.resolve(__dirname, '../lib/core/pdf/full/PDFNetC.br.js.mem'), `${resourceDir}/asm_full/full`],
          [path.resolve(__dirname, '../lib/core/pdf/full/PDFNetC.gz.mem'), `${resourceDir}/resource/full`],
        );
        resourcesForZip.push(
          [`${resourceDir}/pdf_full`],
          [`${resourceDir}/asm_full`],
        );
      }
    }
    // if they are using XOD
    else if (webViewerServer === 'n') {
      filesToDelete.push(
        path.resolve(__dirname, '../lib/core/office'),
      );
      filesToDelete.push(
        path.resolve(__dirname, '../lib/core/pdf'),
      );
    }

    if (webViewerServer === 'y') {
      filesToDelete.push(
        path.resolve(__dirname, '../lib/core/pdf/PDFNet.js'),
        path.resolve(__dirname, '../lib/core/office'),
        path.resolve(__dirname, '../lib/core/pdf/full'),
      );
    }
    if (salesforce === 'y') {
      // If they dont need the full api
      if (type === 'n') {
        filesToDeleteForSalesforce.push(
          path.resolve(__dirname, '../lib/core/pdf/lean/PDFWorker.nmf'),
          path.resolve(__dirname, '../lib/core/pdf/lean/PDFWorker.pexe'),
          path.resolve(__dirname, '../lib/core/pdf/lean/PDFWorkerSubzero.nmf'),
        );
      }
      // If they do need the full API
      else {
        filesToDeleteForSalesforce.push(
          path.resolve(__dirname, '../lib/core/pdf/full/PDFWorker.nmf'),
          path.resolve(__dirname, '../lib/core/pdf/full/PDFWorker.pexe'),
          path.resolve(__dirname, '../lib/core/pdf/full/PDFWorkerSubzero.nmf'),
        );
      }

      filesToDeleteForSalesforce.push(
        path.resolve(__dirname, '../lib/core/office/WebOfficeWorker.nmf'),
        path.resolve(__dirname, '../lib/core/office/WebOfficeWorker.pexe'),
        path.resolve(__dirname, '../lib/core/office/WebOfficeWorkerSubzero.nmf'),
        path.resolve(__dirname, '../lib/core/office/WebOfficeWorkerWasm.br.wasm'),
      );
      resourcesForZip.push([`${resourceDir}/lib`]);
    }
    console.log(`\n==== ${RED}${BLINK + UNDER}FILES & FOLDERS TO DELETE${RESET} ====\n`);

    filesToDelete.forEach(f => {
      console.log(`${RED}${f}${RESET}`);
    });

    console.log('\n===================================');

    prompt.get({
      properties: {
        delete: {
          description: `The above files will be permanently deleted. Is this okay? ${backup === 'y' ? "(A backup will be created in './lib-backup')" : '(A backup will NOT be created)'} [y|n]${RESET}`,
          ...globalPrompt,
        },
      },
    }, async(err, result) => {
      if (err) {
        console.log(`\n\n${RED}Process exited. No action will be taken.${RESET}\n`);
        return;
      }

      if (result.delete === 'y') {
        if (backup === 'y') {
          console.log(`\n${GREEN}Creating backup...${RESET}`);
          await fs.copy(
            path.resolve(__dirname, '../lib'),
            path.resolve(__dirname, '../lib-backup'),
          );
        }

        console.log(`\n${GREEN}Deleting files...${RESET}`);

        const promises = filesToDelete.map(file => fs.remove(file));

        await Promise.all(promises);

        if (salesforce === 'y') {
          console.log(`\n${GREEN}Extracting files for salesforce build...${RESET}`);
          const relocatePromises = filesToRelocate.map(([file, dest, isCopy]) => {
            const f = path.basename(file);
            dest = path.resolve(dest, f);
            const func = (isCopy) ? fs.copy : fs.copy;
            return func(file, dest);
          });

          await Promise.all(relocatePromises);

          console.log(`\n${GREEN}Compressing files...${RESET}`);

          const zipPromises = resourcesForZip.map(item => {
            const [source, tmp = ''] = item;
            return new Promise(function(resolve, reject) {
              var output = fs.createWriteStream(`${source}.zip`);
              var archive = archiver('zip', {
                zlib: {
                  level: 9,
                }, // Sets the compression level.
              });
              output.on('close', () => {
                const fi = path.basename(source);
                console.log(`${fi}.zip`);
                // fs.remove(source);
                resolve();
              });
              archive.on('error', reject);
              archive.pipe(output);
              archive.directory(source, tmp);
              archive.finalize();
            });
          });
          await Promise.all(zipPromises);
          console.log(`\n${GREEN}${UNDER}Done! Copy above zipped files into "staticresources" folder of your salesforce app.${RESET}\n`);
          return;
        }
      } else {
        console.log(`\n${RED}Process exited. No action will be taken.${RESET}\n`);
        return;
      }

      console.log(`\n${GREEN}${UNDER}Done! Your lib folder is now optimized for production use.${RESET}\n\n`);
    });
  });
})();