/**
 * No modelo atual, toda entrada de serviço nasce de forma atômica no checkout.
 * Lançamentos de entrada legados do antigo PDV não representam recebimento
 * confirmado e não podem alimentar Extrato, Relatórios ou saldo.
 */
export const isConfirmedCheckoutIncome = (transaction: { type?: string | null; id?: string | null }) => (
  transaction.type === 'income' && typeof transaction.id === 'string' && transaction.id.startsWith('receipt_')
);

export const isFinancialLedgerTransaction = (transaction: { type?: string | null; id?: string | null }) => (
  transaction.type === 'expense' || isConfirmedCheckoutIncome(transaction)
);

export const receiptIdFromLedgerTransaction = (transactionId: string) => (
  transactionId.startsWith('receipt_') ? transactionId.slice('receipt_'.length) : null
);
