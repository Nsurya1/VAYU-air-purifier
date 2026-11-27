import { DeviceFleetResponse, DeviceListItem, SystemDiagnostics } from '../types/device';

const BASE_URL = '/api/v1';

export async function fetchFleet(): Promise<DeviceFleetResponse> {
  const response = await fetch(`${BASE_URL}/devices`, {
    headers: { 'Accept': 'application/json' }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch fleet: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export async function fetchDeviceDetail(deviceId: string): Promise<DeviceListItem> {
  const response = await fetch(`${BASE_URL}/devices/${encodeURIComponent(deviceId)}`, {
    headers: { 'Accept': 'application/json' }
  });
  if (!response.ok) {
    throw new Error(`Device ${deviceId} not found or unreachable.`);
  }
  return response.json();
}

export async function fetchDiagnostics(): Promise<SystemDiagnostics> {
  const response = await fetch(`${BASE_URL}/system/diagnostics`, {
    headers: { 'Accept': 'application/json' }
  });
  if (!response.ok) {
    throw new Error('Diagnostics endpoint failed');
  }
  return response.json();
}

export function subscribeToFleetStream(
  onData: (data: DeviceFleetResponse) => void,
  onError: (err: Event) => void
): () => void {
  const eventSource = new EventSource(`${BASE_URL}/devices/stream`);

  eventSource.addEventListener('fleet-update', (event: MessageEvent) => {
    try {
      const data: DeviceFleetResponse = JSON.parse(event.data);
      onData(data);
    } catch (e) {
      console.error('Failed to parse fleet SSE event data', e);
    }
  });

  eventSource.onerror = (err) => {
    onError(err);
  };

  return () => {
    eventSource.close();
  };
}
