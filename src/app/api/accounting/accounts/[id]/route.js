import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

export async function DELETE(req, { params }) {
  try {
    const auth = requireTenantSession(req, "accounts.manage");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "accounts.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { id } = await params;
    const { Account } = await getTenantModels(auth.tenantId);
    const account = await Account.findOne({ _id: id, tenantId: auth.tenantId });

    if (!account) return Response.json({ error: "Account not found" }, { status: 404 });
    if (account.isSystem) {
      return Response.json({ error: "System accounts cannot be deleted" }, { status: 400 });
    }
    if (account.balance !== 0) {
      return Response.json({ error: "Only zero-balance accounts can be deleted" }, { status: 400 });
    }

    await account.deleteOne();

    return Response.json({ message: "Account deleted" });
  } catch (error) {
    return jsonError("Unable to delete account", error, 500);
  }
}
