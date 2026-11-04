import type { Account, AccountType, CreateAccountInput } from "@/lib/api";
import { majorToMinorUnits, minorToMajorUnits } from "@/lib/money";

export const accountTypeLabels: Record<AccountType, string> = {
  cash: "Cash",
  checking: "Checking",
  savings: "Savings",
  credit: "Credit",
  investment: "Investment",
  other: "Other",
};

export interface AccountFormValues {
  name: string;
  type: AccountType;
  openingBalance: string;
}

export function emptyAccountForm(): AccountFormValues {
  return {
    name: "",
    type: "checking",
    openingBalance: "0.00",
  };
}

export function formValuesFromAccount(account: Account): AccountFormValues {
  return {
    name: account.name,
    type: account.type,
    openingBalance: minorToMajorUnits(account.openingBalanceMinor),
  };
}

export function accountInputFromForm(
  values: AccountFormValues,
): CreateAccountInput {
  return {
    name: values.name,
    type: values.type,
    openingBalanceMinor: majorToMinorUnits(values.openingBalance),
  };
}
