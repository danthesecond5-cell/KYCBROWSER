const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  withDangerousMod,
  withInfoPlist,
  withXcodeProject,
  IOSConfig,
} = require('@expo/config-plugins');

function resolveFrameworkPath(projectRoot, frameworkPath) {
  if (!frameworkPath) {
    return null;
  }
  return path.isAbsolute(frameworkPath)
    ? frameworkPath
    : path.resolve(projectRoot, frameworkPath);
}

function resolveFrameworkBinaryPath(frameworkPath, override) {
  if (override) {
    return override;
  }
  if (!frameworkPath) {
    return null;
  }
  const frameworkName = path.basename(frameworkPath, '.framework');
  return path.join(frameworkPath, frameworkName);
}

function computeSha256(filePath) {
  const hash = crypto.createHash('sha256');
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest('hex');
}

function readChecksumFile(checksumPath) {
  if (!checksumPath || !fs.existsSync(checksumPath)) {
    return null;
  }
  const content = fs.readFileSync(checksumPath, 'utf8').trim();
  return content.length > 0 ? content : null;
}

function writeChecksumFile(checksumPath, hash) {
  if (!checksumPath) {
    return;
  }
  fs.writeFileSync(checksumPath, `${hash}\n`, 'utf8');
}

function resolveExpectedSha256(props, checksumPath) {
  if (props.frameworkSha256) {
    return String(props.frameworkSha256).trim();
  }
  if (props.frameworkSha256Env) {
    const value = process.env[String(props.frameworkSha256Env)];
    return value ? String(value).trim() : null;
  }
  if (checksumPath) {
    return readChecksumFile(checksumPath);
  }
  return null;
}

function readJsonConfig(jsonPath) {
  if (!jsonPath || !fs.existsSync(jsonPath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(jsonPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse enterprise JSON config at ${jsonPath}: ${error.message}`);
  }
}

function mergeArray(target, values) {
  if (!Array.isArray(values) || values.length === 0) {
    return target;
  }
  const set = new Set(Array.isArray(target) ? target : []);
  for (const item of values) {
    if (typeof item === 'string' && item.trim().length > 0) {
      set.add(item.trim());
    }
  }
  return Array.from(set);
}

function mergeObject(target, values) {
  if (!values || typeof values !== 'object') {
    return target;
  }
  return { ...(target || {}), ...values };
}

function buildVariantRuntimePath(frameworkPath, binaryOverride) {
  if (!frameworkPath) {
    return null;
  }
  const frameworkName = path.basename(frameworkPath);
  const binaryName = binaryOverride || path.basename(frameworkPath, '.framework');
  return `frameworks://${frameworkName}/${binaryName}`;
}

function normalizeVariants(props) {
  if (Array.isArray(props.frameworkVariants) && props.frameworkVariants.length > 0) {
    return props.frameworkVariants.map((variant) => ({
      path: variant.path,
      binary: variant.binary,
      minVersion: variant.minVersion || variant.minIOS || null,
      maxVersion: variant.maxVersion || variant.maxIOS || null,
      checksumFile: variant.checksumFile || null,
      sha256: variant.sha256 || null,
      sha256Env: variant.sha256Env || null,
    }));
  }
  return [
    {
      path: props.frameworkPath || 'enterprise/webkit/CustomWebKit.framework',
      binary: props.frameworkBinary || null,
      minVersion: null,
      maxVersion: null,
      checksumFile: props.checksumFile || null,
      sha256: props.frameworkSha256 || null,
      sha256Env: props.frameworkSha256Env || null,
    },
  ];
}

function copyFramework(sourcePath, destDir) {
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    return null;
  }
  fs.mkdirSync(destDir, { recursive: true });
  const frameworkName = path.basename(sourcePath);
  const destPath = path.join(destDir, frameworkName);
  if (fs.existsSync(destPath)) {
    fs.rmSync(destPath, { recursive: true, force: true });
  }
  fs.cpSync(sourcePath, destPath, { recursive: true });
  return destPath;
}

function addFrameworkToProject(project, projectRoot, frameworkName, iosFrameworksDir) {
  const projectName = IOSConfig.XcodeUtils.getProjectName(projectRoot);
  const target = IOSConfig.XcodeUtils.getApplicationNativeTarget({
    project,
    projectName,
  });
  const frameworkRef = `${iosFrameworksDir}/${frameworkName}`;
  
  project.addFramework(frameworkRef, {
    customFramework: true,
    embed: true,
    link: true,
    target: target.uuid,
  });
}

const withEnterpriseWebKit = (config, props = {}) => {
  const iosFrameworksDir = props.iosFrameworksDir || 'Frameworks';
  const required = props.required !== false;
  const checksumRequired = props.checksumRequired !== false;
  const autoGenerateChecksum = props.autoGenerateChecksum !== false;
  const variants = normalizeVariants(props);
  const hookConfigPath = props.hookConfigPath || 'enterprise/webkit/hooks.json';
  const hookConfig = readJsonConfig(path.resolve(process.cwd(), hookConfigPath));
  
  config = withInfoPlist(config, (config) => {
    const runtimeVariants = variants.map((variant) => ({
      path: buildVariantRuntimePath(variant.path, variant.binary),
      minVersion: variant.minVersion || undefined,
      maxVersion: variant.maxVersion || undefined,
    })).filter((entry) => entry.path);
    
    if (runtimeVariants.length > 0) {
      config.modResults.RNCEnterpriseWebKitFrameworkVariants = runtimeVariants;
    }
    
    if (hookConfig) {
      config.modResults.RNCEnterpriseWebKitCustomPreferenceFlags = mergeArray(
        config.modResults.RNCEnterpriseWebKitCustomPreferenceFlags,
        hookConfig.customPreferenceFlags
      );
      config.modResults.RNCEnterpriseWebKitCustomConfigFlags = mergeArray(
        config.modResults.RNCEnterpriseWebKitCustomConfigFlags,
        hookConfig.customConfigFlags
      );
      config.modResults.RNCEnterpriseWebKitCustomPreferenceSettings = mergeObject(
        config.modResults.RNCEnterpriseWebKitCustomPreferenceSettings,
        hookConfig.customPreferenceSettings
      );
      config.modResults.RNCEnterpriseWebKitCustomConfigSettings = mergeObject(
        config.modResults.RNCEnterpriseWebKitCustomConfigSettings,
        hookConfig.customConfigSettings
      );
      config.modResults.RNCEnterpriseWebKitDefaults = mergeObject(
        config.modResults.RNCEnterpriseWebKitDefaults,
        hookConfig.defaults
      );
    }
    
    return config;
  });
  
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const iosRoot = config.modRequest.platformProjectRoot;
      const destDir = path.join(iosRoot, iosFrameworksDir);
      
      for (const variant of variants) {
        const sourcePath = resolveFrameworkPath(projectRoot, variant.path);
        if (!sourcePath || !fs.existsSync(sourcePath)) {
          if (required) {
            throw new Error(
              `Enterprise WebKit framework missing at: ${sourcePath || variant.path}. ` +
                'Place CustomWebKit.framework under enterprise/webkit or update frameworkVariants.'
            );
          }
          continue;
        }
        
        const checksumFile = variant.checksumFile || `${sourcePath}.sha256`;
        const expectedSha256 = resolveExpectedSha256(
          {
            frameworkSha256: variant.sha256,
            frameworkSha256Env: variant.sha256Env,
          },
          checksumFile
        );
        const binaryPath = resolveFrameworkBinaryPath(sourcePath, variant.binary);
        
        if (binaryPath && fs.existsSync(binaryPath)) {
          if (checksumRequired) {
            let expected = expectedSha256;
            if (!expected) {
              if (autoGenerateChecksum) {
                const generated = computeSha256(binaryPath);
                if (!fs.existsSync(checksumFile)) {
                  writeChecksumFile(checksumFile, generated);
                  console.warn(`[Enterprise WebKit] Generated checksum at ${checksumFile}`);
                } else {
                  expected = readChecksumFile(checksumFile);
                }
                expected = expected || generated;
              } else {
                throw new Error(
                  'Enterprise WebKit checksum required but no SHA256 provided. ' +
                    'Set frameworkSha256 or frameworkSha256Env in the plugin config.'
                );
              }
            }
            expected = resolveExpectedSha256(
              {
                frameworkSha256: variant.sha256,
                frameworkSha256Env: variant.sha256Env,
              },
              checksumFile
            ) || expected;
            if (!expected) {
              throw new Error(
                `Enterprise WebKit checksum missing after generation for ${binaryPath}.`
              );
            }
            const actual = computeSha256(binaryPath);
            if (actual.toLowerCase() !== expected.toLowerCase()) {
              throw new Error(
                `Enterprise WebKit checksum mismatch for ${binaryPath}. ` +
                  `Expected ${expected}, got ${actual}.`
              );
            }
          }
        } else if (checksumRequired) {
          throw new Error(
            `Enterprise WebKit binary not found for checksum validation: ${binaryPath || '(none)'}. ` +
              'Set frameworkBinary if your framework uses a non-standard binary name.'
          );
        }
        
        copyFramework(sourcePath, destDir);
      }
      return config;
    },
  ]);
  
  config = withXcodeProject(config, (config) => {
    const project = config.modResults;
    for (const variant of variants) {
      const frameworkName = path.basename(variant.path);
      addFrameworkToProject(project, config.modRequest.projectRoot, frameworkName, iosFrameworksDir);
    }
    return config;
  });
  
  return config;
};

module.exports = withEnterpriseWebKit;
