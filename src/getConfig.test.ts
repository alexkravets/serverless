'use strict';

import getConfig from './getConfig';
import { DEFAULT_ENV, DEFAULT_NODE_ENV } from './constants';

describe('getConfig()', () => {
  beforeEach(() => {
    delete process.env.NODE_APP_INSTANCE;
    delete process.env.NODE_ENV;
  });

  it('uses DEFAULT_ENV when env is omitted', () => {
    const config = getConfig();

    expect(process.env.NODE_APP_INSTANCE).toBe(DEFAULT_ENV);
    expect(process.env.NODE_ENV).toBe(DEFAULT_NODE_ENV);
    expect(config).toEqual(expect.any(Object));
  });
});
