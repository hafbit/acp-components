import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { acpStore, sessionStore } from '@hafbit/acp-components-core';
import type { AcpClient, AgentConnection, SessionMeta } from '@hafbit/acp-components-core';
import { AcpContext } from '../../context/AcpContext';
import type { AcpContextValue } from '../../context/AcpContext';
import { PlatformContext } from '../../context/PlatformContext';
import type { Platform } from '../../context/PlatformContext';
import { SessionList } from './SessionList';

vi.mock('../../i18n', () => ({
  useI18n: () => ({
    t: (key: string, values?: { message?: string }) =>
      values?.message ? `${key}: ${values.message}` : key,
  }),
}));

const cwd = '/workspace';
const session: SessionMeta = {
  id: 'session-1',
  title: 'Session one',
  cwd,
  agentId: 'agent-1',
  loaded: true,
};

const platform: Platform = {
  platform: 'web',
  os: undefined,
  storage: () => ({
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  }),
};

function createContext(client: AcpClient): AcpContextValue {
  return {
    getClient: () => client,
    agents: [],
    addAgent: async () => {},
    removeAgent: async () => {},
    builtinAgentIds: new Set(),
    isReady: true,
  };
}

function renderSessionList(client: AcpClient) {
  return render(
    <PlatformContext.Provider value={platform}>
      <AcpContext.Provider value={createContext(client)}>
        <SessionList />
      </AcpContext.Provider>
    </PlatformContext.Provider>,
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  acpStore.setState({
    agents: new Map(),
    workspaces: new Map(),
    activeSessionId: null,
    pendingAuth: null,
  });
  sessionStore.setState({ sessions: new Map() });
  const agent = {
    id: 'agent-1',
    name: 'Agent one',
    status: 'connected',
    agentInfo: null,
    capabilities: { sessionCapabilities: { delete: {} } },
    authMethods: [],
  } as AgentConnection;
  acpStore.getState().addAgent(agent);
  acpStore.getState().addWorkspace(cwd);
  acpStore.getState().addSession(session);
  acpStore.getState().setActiveSession(session.id);
});

describe('SessionList deletion', () => {
  it('removes the session after the agent archives it', async () => {
    const deleteSession = vi.fn().mockResolvedValue({});
    renderSessionList({ deleteSession } as unknown as AcpClient);

    fireEvent.click(screen.getByRole('button', { name: 'sessionList.deleteSession' }));

    await waitFor(() => expect(screen.queryByText('Session one')).toBeNull());
    expect(deleteSession).toHaveBeenCalledWith(session.id);
    expect(acpStore.getState().activeSessionId).toBeNull();
  });

  it('keeps the session visible after failure and allows a retry', async () => {
    const deleteSession = vi
      .fn()
      .mockRejectedValueOnce(new Error('Internal error'))
      .mockResolvedValueOnce({});
    renderSessionList({ deleteSession } as unknown as AcpClient);
    const button = screen.getByRole('button', { name: 'sessionList.deleteSession' });

    fireEvent.click(button);

    expect((await screen.findByRole('alert')).textContent).toBe(
      'sessionList.deleteError: Internal error',
    );
    expect(screen.getByText('Session one')).not.toBeNull();
    expect((button as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(button);
    await waitFor(() => expect(screen.queryByText('Session one')).toBeNull());
    expect(deleteSession).toHaveBeenCalledTimes(2);
  });

  it('ignores repeated clicks while deletion is pending', async () => {
    const pending = deferred<Record<string, never>>();
    const deleteSession = vi.fn().mockReturnValue(pending.promise);
    renderSessionList({ deleteSession } as unknown as AcpClient);
    const button = screen.getByRole('button', { name: 'sessionList.deleteSession' });

    fireEvent.click(button);
    fireEvent.click(button);

    expect(deleteSession).toHaveBeenCalledTimes(1);
    expect((button as HTMLButtonElement).disabled).toBe(true);

    await act(async () => pending.resolve({}));
    await waitFor(() => expect(screen.queryByText('Session one')).toBeNull());
  });
});
