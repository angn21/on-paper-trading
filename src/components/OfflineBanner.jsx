import { useOnlineStatus } from '../hooks/useOnlineStatus';

export default function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div className="banner banner-warning" style={{ marginBottom: 12 }}>
      You&apos;re offline — showing last cached prices where available.
    </div>
  );
}
