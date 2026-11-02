import { describe, expect, it } from 'vitest';
import { analyzeOffer } from '../lib/analyzer';
import { analysisInsert, createSavedAnalysis, deleteSavedAnalysis, getSavedAnalysis, listSavedAnalyses } from '../lib/data/analyses';
import { clientSuppliedIdentity, profileInsert, profileUpdate, saveDisplayName } from '../lib/data/profiles';
import { createMemoryStore } from './memory-store';

const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';
const offer = 'HLTH Code asked for one Instagram Reel and two Story frames on an exclusive basis.';

describe('cross-user data access', () => {
  const analysis = analyzeOffer(offer);

  it('stores the session user id and drops a client-supplied user id', () => {
    const row = analysisInsert(userA, { offer, analysis, userId: userB, user_id: userB });
    expect(row.user_id).toBe(userA);
    expect(row).not.toHaveProperty('userId');
    expect(clientSuppliedIdentity({ displayName: 'Ada', id: userB, email: 'b@example.com' })).toBe(true);
    expect(clientSuppliedIdentity({ displayName: 'Ada' })).toBe(false);
  });

  it('rejects a save body that tries to name the owner', async () => {
    const store = createMemoryStore();
    const result = await createSavedAnalysis(
      { id: userA, email: 'a@example.com' },
      { offer, analysis, userId: userB },
      store.client,
    );
    expect(result.status).toBe(400);
    expect(store.rows('saved_analyses')).toHaveLength(0);
  });

  it('does not let one user list, read, or delete another user’s analysis', async () => {
    const store = createMemoryStore();
    const savedA = await createSavedAnalysis({ id: userA, email: 'a@example.com' }, { offer, analysis }, store.client);
    const savedB = await createSavedAnalysis({ id: userB, email: 'b@example.com' }, { offer, analysis }, store.client);
    expect(savedA.status).toBe(201);
    expect(savedB.status).toBe(201);

    const listed = await listSavedAnalyses(store.client, userA);
    expect(listed.items.map((item) => item.id)).toEqual([savedA.body.id]);

    const stolen = await getSavedAnalysis(store.client, userA, String(savedB.body.id));
    expect(stolen.row).toBeNull();

    const removed = await deleteSavedAnalysis(store.client, userA, String(savedB.body.id));
    expect(removed.data).toEqual([]);
    const stillThere = await getSavedAnalysis(store.client, userB, String(savedB.body.id));
    expect(stillThere.row?.id).toBe(savedB.body.id);
  });

  it('updates only the signed-in profile and ignores another account id', async () => {
    const update = profileUpdate(userA, 'Ada Lovelace');
    expect(update.match).toEqual({ id: userA });
    expect(update.values).toEqual({ display_name: 'Ada Lovelace', updated_at: update.values.updated_at });
    expect(update.values).not.toHaveProperty('id');
    expect(update.values).not.toHaveProperty('email');
    expect(profileInsert({ id: userA, email: 'a@example.com' }, 'Ada').id).toBe(userA);

    const store = createMemoryStore();
    await saveDisplayName(store.client, { id: userA, email: 'a@example.com' }, 'Ada');
    await saveDisplayName(store.client, { id: userB, email: 'b@example.com' }, 'Grace');
    await saveDisplayName(store.client, { id: userA, email: 'attacker@example.com' }, 'Changed');

    const profiles = store.rows('creator_profiles');
    expect(profiles.find((row) => row.id === userA)).toMatchObject({ display_name: 'Changed', email: 'a@example.com' });
    expect(profiles.find((row) => row.id === userB)).toMatchObject({ display_name: 'Grace', email: 'b@example.com' });
  });
});
