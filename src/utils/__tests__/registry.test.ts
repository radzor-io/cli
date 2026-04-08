import { describe, it, expect } from 'vitest';
// import { fetchRegistry } from '../registry'; // Example import if it exists

describe('CLI Utilities', () => {
  it('should have a working test environment', () => {
    expect(true).toBe(true);
  });

  // Example placeholder for registry fetching logic
  it('should parse component slug correctly', () => {
    const slug = 'radzor-io/auth-oauth@v1.0';
    const parsed = {
      owner: slug.split('/')[0],
      name: slug.split('/')[1].split('@')[0],
      version: slug.split('@')[1]
    };

    expect(parsed.owner).toBe('radzor-io');
    expect(parsed.name).toBe('auth-oauth');
    expect(parsed.version).toBe('v1.0');
  });
});
