export const DELETE_GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 minutes
export const DEFAULT_CUSTOMER_SUPPORT_PHONE = "+91 98765 43210";

/**
 * Checks if a record was created within the 5-minute deletion grace window.
 */
export function isWithinDeleteWindow(record) {
  if (!record || !record.createdAt) return false;
  const createdAtTime = new Date(record.createdAt).getTime();
  if (isNaN(createdAtTime)) return false;
  const ageMs = Date.now() - createdAtTime;
  return ageMs >= 0 && ageMs <= DELETE_GRACE_PERIOD_MS;
}

/**
 * Returns remaining deletion grace window in seconds (0 if expired).
 */
/**
 * Checks if the tenant subscription includes any deletion feature entitlement.
 */
export function getDeleteFeatures(subscription) {
  if (!subscription) return [];
  const features = subscription.features || subscription.entitlements?.features || [];
  return Array.isArray(features) ? features : [];
}

/**
 * Checks if the tenant subscription has permanent/unrestricted delete access for a given module.
 */
export function hasPermanentDeleteAccess(subscription, moduleName = "") {
  const features = getDeleteFeatures(subscription);
  if (features.includes("record-deletion:all")) return true;
  if (moduleName && features.includes(`record-deletion:${moduleName}`)) return true;
  return false;
}

/**
 * Checks if the tenant subscription has deletion capability (5-min window or permanent) for a module.
 */
export function hasDeleteEntitlement(subscription, moduleName = "") {
  const features = getDeleteFeatures(subscription);
  if (features.includes("record-deletion") || features.includes("record-deletion:5min")) return true;
  if (features.includes("record-deletion:all")) return true;
  if (moduleName && features.includes(`record-deletion:${moduleName}`)) return true;
  return false;
}

/**
 * Evaluates whether a record can be deleted right now based on entitlement, module, & 5-minute rule.
 */
export function canDeleteRecord(record, subscription, moduleName = "") {
  if (!hasDeleteEntitlement(subscription, moduleName)) return false;
  if (hasPermanentDeleteAccess(subscription, moduleName)) return true;
  return isWithinDeleteWindow(record);
}

/**
 * Returns user-facing support restriction message.
 */
export function getDeleteRestrictionReason(record, subscription, moduleName = "", supportPhone = DEFAULT_CUSTOMER_SUPPORT_PHONE) {
  if (!hasDeleteEntitlement(subscription, moduleName)) {
    return `Record deletion is not included in your active subscription package. To upgrade your plan or request record deletion access, please contact Customer Support at ${supportPhone}.`;
  }
  if (!hasPermanentDeleteAccess(subscription, moduleName) && !isWithinDeleteWindow(record)) {
    return `The initial 5-minute deletion window has passed. If you want to delete this record or purchase extended deletion access, please contact Customer Support at ${supportPhone}.`;
  }
  return null;
}
