import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CallRoom from '@/components/CallRoom';
import { useCall } from '@/lib/useCall';
import { useFullscreen } from '@/lib/useFullscreen';

// The hook that talks to the camera and the room is replaced, so these tests check what the person sees.
vi.mock('@/lib/useCall', () => ({ useCall: vi.fn() }));
vi.mock('@/lib/useFullscreen', () => ({ useFullscreen: vi.fn() }));

function fakeCall(over = {}) {
  const { state, ...rest } = over;
  return {
    state: { phase: 'live', reconnecting: false, signalLost: false, peer: { mic: true, cam: true }, peerLeft: false, reason: null, error: null, ...state },
    local: { id: 'local' },
    remote: null,
    mic: true,
    cam: true,
    notice: null,
    canFlip: false,
    facing: 'user',
    admit: vi.fn(),
    deny: vi.fn(),
    toggleMic: vi.fn(),
    toggleCam: vi.fn(),
    switchCamera: vi.fn(),
    leave: vi.fn(),
    ...rest,
  };
}

const user = () => userEvent.setup({ delay: null });

function show({ role = 'guest', call = fakeCall() } = {}) {
  useCall.mockReturnValue(call);
  const onLeft = vi.fn();
  const onRetry = vi.fn();
  render(<CallRoom reply={{ role }} audioOnly={false} startMuted={false} onLeft={onLeft} onRetry={onRetry} />);
  return { call, onLeft, onRetry };
}

beforeEach(() => {
  vi.clearAllMocks();
  useFullscreen.mockReturnValue({ full: false, pageFill: false, toggle: vi.fn() });
});

describe('when the lawyer is not ready', () => {
  it('tells a refused guest they can ask to join again and offers the button', async () => {
    const { onRetry } = show({ role: 'guest', call: fakeCall({ state: { phase: 'denied' } }) });
    expect(screen.getByRole('status')).toHaveTextContent('The lawyer is not ready yet. You can ask to join again.');
    await user().click(screen.getByRole('button', { name: 'Join again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('says the room is full when the service cannot take another connection', () => {
    show({ role: 'guest', call: fakeCall({ state: { phase: 'failed', error: 'room_full' } }) });
    expect(screen.getByRole('status')).toHaveTextContent('already has everyone it can hold');
  });

  it('says the lawyer lost their connection while the guest keeps the call', () => {
    show({ role: 'guest', call: fakeCall({ state: { phase: 'live', peerAway: true } }) });
    expect(screen.getByRole('status')).toHaveTextContent('The lawyer lost their connection');
  });
});

describe('waiting to be let in', () => {
  it('tells the guest to wait and shows no call controls yet', () => {
    show({ role: 'guest', call: fakeCall({ state: { phase: 'waiting' } }) });
    expect(screen.getByRole('status')).toHaveTextContent('Your lawyer will let you in. Please wait.');
    expect(screen.queryByRole('button', { name: /microphone/ })).toBeNull();
  });

  it('lets the lawyer admit or turn away someone at the door', async () => {
    const { call } = show({ role: 'host', call: fakeCall({ state: { phase: 'knock' } }) });
    await user().click(screen.getByRole('button', { name: 'Let them in' }));
    await user().click(screen.getByRole('button', { name: 'Not now' }));
    expect(call.admit).toHaveBeenCalledTimes(1);
    expect(call.deny).toHaveBeenCalledTimes(1);
  });

  it('never shows the admit buttons to the guest', () => {
    show({ role: 'guest', call: fakeCall({ state: { phase: 'knock' } }) });
    expect(screen.queryByRole('button', { name: 'Let them in' })).toBeNull();
  });
});

describe('during the call', () => {
  it('has microphone, camera, full screen and leave controls, and passes the presses on', async () => {
    const { call } = show();
    await user().click(screen.getByRole('button', { name: 'Mute microphone' }));
    await user().click(screen.getByRole('button', { name: 'Turn off camera' }));
    expect(call.toggleMic).toHaveBeenCalledTimes(1);
    expect(call.toggleCam).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Full screen' })).toBeInTheDocument();
  });

  it('offers Flip camera only when the device has a second camera', () => {
    show({ call: fakeCall({ canFlip: true }) });
    expect(screen.getByRole('button', { name: 'Flip camera' })).toBeInTheDocument();
  });

  it('hides Flip camera when there is one camera', () => {
    show({ call: fakeCall({ canFlip: false }) });
    expect(screen.queryByRole('button', { name: 'Flip camera' })).toBeNull();
  });

  it('says so when the other person turns their camera off', () => {
    show({ call: fakeCall({ state: { peer: { mic: true, cam: false } } }) });
    expect(screen.getByText('The other person has turned their camera off.')).toBeInTheDocument();
  });
});

describe('leaving and ending', () => {
  it('calls the lawyer’s button End call for everyone', () => {
    show({ role: 'host' });
    expect(screen.getByRole('button', { name: 'End call for everyone' })).toBeInTheDocument();
  });

  it('lets the guest leave, which closes their side and goes back', async () => {
    const { call, onLeft } = show({ role: 'guest' });
    await user().click(screen.getByRole('button', { name: 'Leave the call' }));
    expect(call.leave).toHaveBeenCalledTimes(1);
    expect(onLeft).toHaveBeenCalledTimes(1);
  });

  it('says the lawyer ended the call and offers to join again', async () => {
    const { onRetry } = show({ call: fakeCall({ state: { phase: 'ended', reason: 'host-ended' } }) });
    expect(screen.getByRole('status')).toHaveTextContent('The lawyer ended the call.');
    await user().click(screen.getByRole('button', { name: 'Join again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('offers no way to rejoin straight after a deliberate leave', () => {
    show({ call: fakeCall({ state: { phase: 'ended', reason: 'left' } }) });
    expect(screen.queryByRole('button', { name: 'Join again' })).toBeNull();
  });
});
