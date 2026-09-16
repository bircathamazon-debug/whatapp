// Por defecto Metro no deja importar archivos fuera de app/ (su project
// root). La app comparte tipos con bot/ y functions/ vía ../shared/types,
// así que hay que decirle a Metro que también mire esa carpeta.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
