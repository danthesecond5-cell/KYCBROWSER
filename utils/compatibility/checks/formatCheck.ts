import type { CompatibilityCheckItem } from '../types';
import { IDEAL_WEBCAM_SPECS, ACCEPTABLE_SPECS } from '../specs';
import {
  getFormatFromMimeType,
  getMimeTypeFromDataUri,
  isBase64VideoUri,
  isBlobUri,
} from '../../base64VideoHandler';

const getExtensionFromName = (name: string): string | null => {
  if (!name) return null;
  const trimmed = name.trim();
  const lastDot = trimmed.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === trimmed.length - 1) {
    return null;
  }
  return trimmed.slice(lastDot + 1).toLowerCase();
};

const getExtensionFromUri = (uri: string): string | null => {
  if (!uri) return null;
  const trimmed = uri.trim();
  if (!trimmed) return null;
  const extractFromPath = (path: string): string | null => {
    const cleanPath = path.split('?')[0].split('#')[0];
    const lastDot = cleanPath.lastIndexOf('.');
    if (lastDot <= 0 || lastDot === cleanPath.length - 1) {
      return null;
    }
    return cleanPath.slice(lastDot + 1).toLowerCase();
  };
  const stripToPath = (value: string): string => {
    const schemeIndex = value.indexOf('://');
    if (schemeIndex === -1) return value;
    const afterScheme = value.slice(schemeIndex + 3);
    const slashIndex = afterScheme.indexOf('/');
    if (slashIndex === -1) return '';
    return afterScheme.slice(slashIndex);
  };

  try {
    const parsed = new URL(trimmed);
    return extractFromPath(parsed.pathname);
  } catch {
    return extractFromPath(stripToPath(trimmed));
  }
};

export const checkFormat = (uri: string, name: string): CompatibilityCheckItem => {
  let extension = getExtensionFromName(name);
  
  if (!extension) {
    if (isBase64VideoUri(uri)) {
      const mimeType = getMimeTypeFromDataUri(uri);
      extension = getFormatFromMimeType(mimeType);
    } else if (isBlobUri(uri)) {
      extension = 'mp4';
    } else {
      extension = getExtensionFromUri(uri) || '';
    }
  }
  
  if (!extension) {
    return {
      name: 'Format',
      status: 'warning',
      currentValue: 'Unknown',
      idealValue: IDEAL_WEBCAM_SPECS.format.toUpperCase(),
      message: 'File format could not be determined',
    };
  }
  
  const isIdeal = extension === IDEAL_WEBCAM_SPECS.format;
  const isAcceptable = ACCEPTABLE_SPECS.acceptableFormats.includes(extension);
  
  if (isIdeal) {
    return {
      name: 'Format',
      status: 'perfect',
      currentValue: extension.toUpperCase(),
      idealValue: IDEAL_WEBCAM_SPECS.format.toUpperCase(),
      message: 'Perfect MP4 format',
    };
  }
  
  if (isAcceptable) {
    return {
      name: 'Format',
      status: 'compatible',
      currentValue: extension.toUpperCase(),
      idealValue: IDEAL_WEBCAM_SPECS.format.toUpperCase(),
      message: `${extension.toUpperCase()} is acceptable but MP4 is preferred`,
      fixSuggestion: 'Convert to MP4 (H.264) for best compatibility',
    };
  }
  
  return {
    name: 'Format',
    status: 'incompatible',
    currentValue: extension.toUpperCase(),
    idealValue: IDEAL_WEBCAM_SPECS.format.toUpperCase(),
    message: 'Unsupported video format',
    fixSuggestion: 'Convert video to MP4 (H.264)',
  };
};
