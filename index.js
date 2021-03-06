const yaml = require('js-yaml');
const fs = require('fs');
const { execSync } = require('child_process');
const replace = require('replace-in-file');
const createValidators = require('./lib/createValidators');
const createModel = require('./lib/createModel');
const createRoutes = require('./lib/createRoutes');
const createController = require('./lib/createController');
const createServices = require('./lib/createServices');
const createTests = require('./lib/createTests');
const {copyFolderRecursiveSync} = require('./lib/util');

const templateFilePath = './generatorConfig.yml';

(() => {
  if (!fs.existsSync(templateFilePath)) {
    console.error(`Error: Could not locate file ${templateFilePath}`);
    return;
  }
  const config = yaml.safeLoad(fs.readFileSync(templateFilePath, 'utf8'));
  const appTemplate = config.app.auth === 'basic' ? 'localAuthApp' : 'basicApp';
  const appFolderName = config.app.name.replace(/ /g, '');
  try {
    copyFolderRecursiveSync(`./templates/${appTemplate}`, '.');
    fs.renameSync(appTemplate, './generatedApp');
  } catch (e) {
    console.error('Error: Could not copy reference template.', e);
    return;
  }

  let combinedControllerImports = '';
  let combinedValidationImports = '';
  let combinedRouteHandlers = '';
  if (appTemplate === 'localAuthApp' && config.app.resources.user) {
    console.error('User resource cannot be included since it will be created by local auth');
    return;
  }
  const modelImports = Object.keys(config.app.resources).map(m => `import "../models/${m}";\n`).join('');
  const controllersIndexFilePath = './generatedApp/src/controllers/index.ts';

  const resourceKeys = Object.keys(config.app.resources);
  for(let resourceName of resourceKeys) {
    const resource = config.app.resources[resourceName];
    try {
      createModel(resourceName, resource);
      createValidators(resourceName, resource);
      createController(resourceName, resource);
      createServices(resourceName, resource);
      createTests(resourceName, resource);
      const {
        controllerImports,
        validationImports,
        routeHandlers,
      } = createRoutes(resourceName, resource);

      combinedControllerImports += controllerImports;
      combinedValidationImports += validationImports;
      combinedRouteHandlers += `${routeHandlers}\n`;
    } catch (e) {
      console.error(e);
    }
  };

  try {
    const options = {
      files: controllersIndexFilePath,
      from: [
        /ROUTE_HANDLERS;/g,
        /CONTROLLER_IMPORTS;/g,
        /VALIDATION_IMPORTS;/g,
        /MODEL_IMPORTS;/g,
      ],
      to: [
        combinedRouteHandlers,
        combinedControllerImports,
        combinedValidationImports,
        modelImports,
      ],
    };
    replace.sync(options);
    execSync(`mv generatedApp ${appFolderName}`);
    console.log(`App Generated!`);
    console.log(`cd into ./${appFolderName} and run npm install, npm start!`);
  } catch (e) {
    console.error(e);
  }
})();

process.exit();