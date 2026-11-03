const moneyPattern = /^(-?)(\d+)(?:[.,](\d{0,2}))?$/;

export function majorToMinorUnits(value: string): string {
  const match = moneyPattern.exec(value.trim());

  if (!match) {
    throw new Error("Enter a valid amount with up to two decimal places.");
  }

  const [, sign, wholeUnits, fraction = ""] = match;
  const minorUnits = BigInt(`${wholeUnits}${fraction.padEnd(2, "0")}`);

  return `${sign === "-" && minorUnits !== 0n ? "-" : ""}${minorUnits}`;
}

export function minorToMajorUnits(value: string): string {
  if (!/^-?\d+$/.test(value)) {
    throw new Error("Minor units must be an integer.");
  }

  const amount = BigInt(value);
  const absoluteAmount = amount < 0n ? -amount : amount;
  const wholeUnits = absoluteAmount / 100n;
  const fraction = (absoluteAmount % 100n).toString().padStart(2, "0");

  return `${amount < 0n ? "-" : ""}${wholeUnits}.${fraction}`;
}

export function formatMinorUnits(value: string, currencyCode: string): string {
  return `${currencyCode} ${minorToMajorUnits(value)}`;
}
