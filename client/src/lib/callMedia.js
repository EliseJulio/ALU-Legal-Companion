// True when a camera track is live and its frames are arriving.
// A track is muted when the camera is open but another app holds it or the system blocks it.
export function cameraSends(track) {
  return Boolean(track && track.readyState === 'live' && !track.muted);
}

// The id of the next camera in the list. Null when there is only one.
export function nextCamera(devices, currentId) {
  const ids = devices.filter((d) => d.kind === 'videoinput' && d.deviceId).map((d) => d.deviceId);
  if (ids.length < 2) return null;
  const at = ids.indexOf(currentId);
  return ids[(at + 1) % ids.length];
}
