// The ingredient checker lives in ../src/core and is shared with the web app.
// Metro has to watch that folder, and resolve its TypeScript-style imports
// ("./diets.js" for diets.ts), which Metro doesn't do on its own.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "..");
const sharedCore = path.join(repoRoot, "src", "core");

const config = getDefaultConfig(projectRoot);
config.watchFolders = [...(config.watchFolders ?? []), sharedCore];
config.resolver.nodeModulesPaths = [path.join(projectRoot, "node_modules")];

const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = upstream ?? context.resolveRequest;
  if (moduleName.startsWith(".") && moduleName.endsWith(".js") && context.originModulePath.startsWith(sharedCore)) {
    return resolve(context, moduleName.replace(/\.js$/, ".ts"), platform);
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
