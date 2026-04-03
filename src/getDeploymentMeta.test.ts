'use strict';

import getDeploymentMeta from './getDeploymentMeta';
import { DEFAULT_ENV, DEFAULT_SERVICE } from './constants';

describe('getDeploymentMeta()', () => {
  beforeEach(() => {
    delete process.env.NODE_APP_INSTANCE;
    delete process.env.GITHUB_ACTIONS;
  });

  it('uses DEFAULT_ENV when NODE_APP_INSTANCE is missing and sets profile when required', () => {
    const meta = getDeploymentMeta({
      aws: { region: 'us-east-1', profile: 'profile-1' },
      serverless: { service: 'dos' },
    });

    expect(meta.stackName).toBe(`dos-${DEFAULT_ENV}`);
    expect(meta.region).toBe('us-east-1');
    expect(meta.profile).toBe('profile-1');
  });

  it('does not set profile when running in GitHub Actions', () => {
    process.env.GITHUB_ACTIONS = '1';

    const meta = getDeploymentMeta({
      aws: { region: 'us-east-1', profile: 'profile-1' },
      serverless: { service: 'dos' },
    });

    expect(meta.stackName).toBe(`dos-${DEFAULT_ENV}`);
    expect(meta.region).toBe('us-east-1');
    expect(meta.profile).toBeUndefined();
  });

  it('defaults aws/serverless when config is missing', () => {
    process.env.NODE_APP_INSTANCE = 'stg';

    const meta = getDeploymentMeta({});

    expect(meta.stackName).toBe(`${DEFAULT_SERVICE}-stg`);
    expect(meta.region).toBeUndefined();
    expect(meta.profile).toBeUndefined();
  });
});
