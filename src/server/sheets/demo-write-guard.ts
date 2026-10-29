import {open, stat, unlink} from 'node:fs/promises';
import {join} from 'node:path';

const MARKER_NAME = '.huriza-demo-master-write-in-progress';
const MARKER_CONTENT = 'HURIZA_DEMO_MASTER_WRITE_IN_PROGRESS_V1\n';

/**
 * A local single-writer crash guard for remote demo-master writes.
 * The supplied directory must already exist and be private to the writer.
 * The marker file is fsynced, but parent-directory metadata is not; power-loss
 * durability of the directory entry therefore depends on the host filesystem.
 */
export function createDemoWriteGuard(directory: string) {
  const markerPath = join(directory, MARKER_NAME);
  let ownsMarker = false;

  async function assertReady(): Promise<void> {
    try {
      await stat(markerPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw new Error('Demo master write guard could not be checked.');
    }
    throw new Error('An unfinished demo master write marker exists; refusing startup.');
  }

  async function beforeWrite(): Promise<void> {
    await assertReady();
    let handle;
    try {
      // wx makes the marker creation exclusive across concurrent local writers.
      handle = await open(markerPath, 'wx', 0o600);
      await handle.writeFile(MARKER_CONTENT, 'utf8');
      await handle.sync();
    } catch (error) {
      // Never clear a marker after it has been created unless the remote commit succeeds.
      if (handle) await handle.close().catch(() => undefined);
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        throw new Error('Another or unfinished demo master write is present; refusing write.');
      }
      throw new Error('Demo master write marker could not be made durable.');
    }
    await handle.close();
    ownsMarker = true;
  }

  /** Call only after the local database transaction for the write has committed. */
  async function afterCommit(): Promise<void> {
    if (!ownsMarker) throw new Error('This process does not own an active demo master write marker.');
    await unlink(markerPath);
    ownsMarker = false;
  }

  return {assertReady, beforeWrite, afterCommit};
}
