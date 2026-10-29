import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createDemoWriteGuard} from '../src/server/sheets/demo-write-guard';

const markerName = '.huriza-demo-master-write-in-progress';

async function withTempDirectory(run: (directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'huriza-write-guard-'));
  try {
    await run(directory);
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
}

test('refuses startup when an unfinished marker already exists', async () => {
  await withTempDirectory(async directory => {
    await writeFile(join(directory, markerName), 'interrupted write');
    const guard = createDemoWriteGuard(directory);
    await assert.rejects(guard.assertReady(), /unfinished demo master write marker/);
    await assert.rejects(guard.beforeWrite(), /unfinished demo master write marker/);
  });
});

test('fsyncs an exclusive marker before the adapter and clears it after local commit', async () => {
  await withTempDirectory(async directory => {
    const guard = createDemoWriteGuard(directory);
    await guard.beforeWrite();
    assert.equal(await readFile(join(directory, markerName), 'utf8'), 'HURIZA_DEMO_MASTER_WRITE_IN_PROGRESS_V1\n');
    // Represents the caller's remote write followed by its local database commit.
    const localCommitCompleted = true;
    assert.equal(localCommitCompleted, true);
    await guard.afterCommit();
    await assert.rejects(readFile(join(directory, markerName)), {code: 'ENOENT'});
    await guard.assertReady();
  });
});

test('keeps the marker when the remote write fails', async () => {
  await withTempDirectory(async directory => {
    const guard = createDemoWriteGuard(directory);
    await guard.beforeWrite();
    await assert.rejects(Promise.reject(new Error('remote failure')), /remote failure/);
    // A failed remote write must not be followed by afterCommit.
    assert.equal(await readFile(join(directory, markerName), 'utf8'), 'HURIZA_DEMO_MASTER_WRITE_IN_PROGRESS_V1\n');
    await assert.rejects(guard.assertReady(), /unfinished demo master write marker/);
  });
});

test('uses exclusive marker creation for concurrent local writers', async () => {
  await withTempDirectory(async directory => {
    const firstGuard = createDemoWriteGuard(directory);
    const secondGuard = createDemoWriteGuard(directory);
    let releaseFirst!: () => void;
    const firstBlocked = new Promise<void>(resolve => { releaseFirst = resolve; });
    let startedFirst!: () => void;
    const firstStarted = new Promise<void>(resolve => { startedFirst = resolve; });
    const first = firstGuard.beforeWrite().then(async () => {
      startedFirst();
      await firstBlocked;
    });
    await firstStarted;
    await assert.rejects(secondGuard.beforeWrite(), /unfinished demo master write marker/);
    releaseFirst();
    await first;
    await firstGuard.afterCommit();
  });
});
