export const formatCurrency = (value: number) =>
  `Rp${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(value)}`;