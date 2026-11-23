export const PRODUCTION_HOST_AMI_PARAMETER_NAME =
  "/finhand/production/infrastructure/host-ami-id";

// Keep this version pinned. Updating the Parameter Store value creates a new
// version, but production keeps using this one until the version is reviewed
// and deliberately incremented here.
export const PRODUCTION_HOST_AMI_PARAMETER_VERSION = 1;
