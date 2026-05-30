import { getAccountModel } from "@/app/models/tenant/Account";
import { getJournalEntryModel } from "@/app/models/tenant/JournalEntry";

export const systemChartOfAccounts = [
  { code: "1001", name: "Cash", type: "asset", subtype: "cash" },
  { code: "1002", name: "Bank", type: "asset", subtype: "bank" },
  { code: "1100", name: "Accounts Receivable - Patients", type: "asset", subtype: "accounts-receivable" },
  { code: "1101", name: "Accounts Receivable - Corporate", type: "asset", subtype: "corporate-receivable" },
  { code: "2001", name: "Accounts Payable - Referral Doctors", type: "liability", subtype: "referral-payable" },
  { code: "2002", name: "Accounts Payable - Vendors", type: "liability", subtype: "vendor-payable" },
  { code: "2100", name: "Tax Payable (GST/VAT)", type: "liability", subtype: "tax-payable" },
  { code: "3001", name: "Owner Equity", type: "equity", subtype: "owner-equity" },
  { code: "4001", name: "Lab Revenue - Tests", type: "revenue", subtype: "test-revenue" },
  { code: "4002", name: "Lab Revenue - Packages", type: "revenue", subtype: "package-revenue" },
  { code: "4003", name: "Discounts Given", type: "revenue", subtype: "discounts-given" },
  { code: "5001", name: "Reagent Expense", type: "expense", subtype: "reagent-expense" },
  { code: "5002", name: "Staff Expense", type: "expense", subtype: "staff-expense" },
  { code: "5003", name: "Equipment Expense", type: "expense", subtype: "equipment-expense" },
  { code: "5004", name: "Overhead Expense", type: "expense", subtype: "overhead-expense" },
  { code: "5005", name: "Referral Commission Expense", type: "expense", subtype: "referral-commission-expense" },
];

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function accountBalanceDelta(accountType, debit, credit) {
  return ["asset", "expense"].includes(accountType)
    ? roundMoney(debit - credit)
    : roundMoney(credit - debit);
}

export async function seedSystemChartOfAccounts(tenantConnection, tenantId, options = {}) {
  const Account = getAccountModel(tenantConnection);

  await Account.bulkWrite(
    systemChartOfAccounts.map((account) => ({
      updateOne: {
        filter: { tenantId, code: account.code },
        update: { $setOnInsert: { ...account, tenantId, isSystem: true, balance: 0 } },
        upsert: true,
      },
    })),
    { session: options.session }
  );
}

export async function getAccountByCode(tenantConnection, tenantId, code, options = {}) {
  const Account = getAccountModel(tenantConnection);
  const account = await Account.findOne({ tenantId, code }).session(options.session || null);

  if (!account) {
    throw new Error(`Account ${code} is not seeded for tenant ${tenantId}`);
  }

  return account;
}

async function createJournalEntry(tenantConnection, payload, session) {
  const Account = getAccountModel(tenantConnection);
  const JournalEntry = getJournalEntryModel(tenantConnection);
  const accountIds = payload.lines.map((line) => line.accountId);
  const accounts = await Account.find({ tenantId: payload.tenantId, _id: { $in: accountIds } }).session(session);
  const accountsById = new Map(accounts.map((account) => [String(account._id), account]));

  if (accounts.length !== accountIds.length) {
    throw new Error("Journal entry contains an account outside this tenant or an unknown account");
  }

  const [journalEntry] = await JournalEntry.create(
    [
      {
        date: payload.date || new Date(),
        description: payload.description,
        sourceType: payload.sourceType,
        sourceId: payload.sourceId,
        lines: payload.lines.map((line) => ({
          accountId: line.accountId,
          debit: roundMoney(line.debit),
          credit: roundMoney(line.credit),
        })),
        tenantId: payload.tenantId,
        postedBy: payload.postedBy,
        postedAt: new Date(),
      },
    ],
    { session }
  );

  for (const line of journalEntry.lines) {
    const account = accountsById.get(String(line.accountId));
    const delta = accountBalanceDelta(account.type, line.debit, line.credit);

    await Account.updateOne(
      { _id: account._id, tenantId: payload.tenantId },
      { $inc: { balance: delta } },
      { session }
    );
  }

  return journalEntry;
}

export async function postJournalEntry(tenantConnection, payload, options = {}) {
  if (options.session) {
    return createJournalEntry(tenantConnection, payload, options.session);
  }

  return tenantConnection.transaction((session) => createJournalEntry(tenantConnection, payload, session));
}

export async function reverseJournalEntry(tenantConnection, originalEntry, payload, options = {}) {
  const reversal = await postJournalEntry(
    tenantConnection,
    {
      tenantId: originalEntry.tenantId,
      postedBy: payload.postedBy,
      date: payload.date || new Date(),
      description: payload.description || `Reversal of ${originalEntry.entryNumber}`,
      sourceType: payload.sourceType || "refund",
      sourceId: payload.sourceId || originalEntry.sourceId,
      lines: originalEntry.lines.map((line) => ({
        accountId: line.accountId,
        debit: roundMoney(line.credit),
        credit: roundMoney(line.debit),
      })),
    },
    options
  );

  originalEntry.isReversed = true;
  originalEntry.reversalEntryId = reversal._id;
  await originalEntry.save({ session: options.session });

  return reversal;
}
