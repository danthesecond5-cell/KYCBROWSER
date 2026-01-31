import type { CompatibilityCheckItem } from '../types';
import { IDEAL_WEBCAM_SPECS, ACCEPTABLE_SPECS } from '../specs';
import { getAspectRatioString, isAspectRatioCompatible } from '../helpers';

export const checkAspectRatio = (
  aspectRatio: string | undefined,
  width: number | undefined,
  height: number | undefined
): CompatibilityCheckItem => {
  let actualRatio = aspectRatio;
  
  if (!actualRatio && width && height) {
    actualRatio = getAspectRatioString(width, height);
  }
  
  if (!actualRatio) {
    return {
      name: 'Aspect Ratio',
      status: 'warning',
      currentValue: 'Unknown',
      idealValue: IDEAL_WEBCAM_SPECS.aspectRatio,
      message: 'Aspect ratio could not be determined',
    };
  }
  
  const isIdeal = actualRatio === IDEAL_WEBCAM_SPECS.aspectRatio;
  const isCompatible = isAspectRatioCompatible(
    actualRatio,
    IDEAL_WEBCAM_SPECS.aspectRatio,
    ACCEPTABLE_SPECS.aspectRatioTolerance
  );
  
  if (isIdeal) {
    return {
      name: 'Aspect Ratio',
      status: 'perfect',
      currentValue: actualRatio,
      idealValue: IDEAL_WEBCAM_SPECS.aspectRatio,
      message: 'Perfect 9:16 aspect ratio',
    };
  }
  
  if (isCompatible) {
    return {
      name: 'Aspect Ratio',
      status: 'compatible',
      currentValue: actualRatio,
      idealValue: IDEAL_WEBCAM_SPECS.aspectRatio,
      message: 'Aspect ratio is close to 9:16',
    };
  }
  
  return {
    name: 'Aspect Ratio',
    status: 'incompatible',
    currentValue: actualRatio,
    idealValue: IDEAL_WEBCAM_SPECS.aspectRatio,
    message: 'Aspect ratio must be 9:16',
    fixSuggestion: 'Crop video to 9:16 aspect ratio',
  };
};
