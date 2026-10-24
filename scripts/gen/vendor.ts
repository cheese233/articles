import { buildVendor } from "../lib/vendor_bundle.ts";

export default async function () {
  const { urls } = await buildVendor();
  return urls;
}
