import { useToast } from '../context/ToastContext';
import { usePortfolio } from '../hooks/usePortfolio';
import { vibrate } from '../lib/haptics';

export function useTradeFeedback() {
  const { showToast } = useToast();
  const { revertLastTransaction } = usePortfolio();

  return function onTradeResult(result) {
    if (!result?.ok) return result;

    vibrate(12);

    if (result.pending) {
      showToast(result.message);
      return result;
    }

    showToast(result.message, () => {
      revertLastTransaction();
    });

    return result;
  };
}
