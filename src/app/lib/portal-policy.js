/**
 * Checks if the tenant subscription includes the patient-portal feature entitlement
 * AND the module is enabled in lab configuration.
 */
export function hasPatientPortalEntitlement(subscription) {
  if (!subscription) return false;
  const features = subscription.features || subscription.subscriptionFeatures || subscription.entitlements?.features || [];
  const enabledModules = subscription.enabledModules || subscription.entitlements?.enabledModules || [];
  const hasPackageFeature = Array.isArray(features) && features.length > 0 ? features.includes("patient-portal") : true;
  const isModuleEnabled = !Array.isArray(enabledModules) || enabledModules.length === 0 || enabledModules.includes("patient-portal") || hasPackageFeature;
  return Boolean(hasPackageFeature && isModuleEnabled);
}

/**
 * Checks if the tenant subscription includes the doctor-portal feature entitlement
 * AND the module is enabled in lab configuration.
 */
export function hasDoctorPortalEntitlement(subscription) {
  if (!subscription) return false;
  const features = subscription.features || subscription.subscriptionFeatures || subscription.entitlements?.features || [];
  const enabledModules = subscription.enabledModules || subscription.entitlements?.enabledModules || [];
  const hasPackageFeature = Array.isArray(features) && features.length > 0 ? features.includes("doctor-portal") : true;
  const isModuleEnabled = !Array.isArray(enabledModules) || enabledModules.length === 0 || enabledModules.includes("doctor-portal") || hasPackageFeature;
  return Boolean(hasPackageFeature && isModuleEnabled);
}
