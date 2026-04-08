import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateManifestContent } from '../src/commands/validate.js';

describe('Manifest Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validManifest = {
    radzor: '1.0.0',
    name: '@radzor/test-component',
    version: '0.1.0',
    description: 'A valid component with a long enough description.',
    languages: ['typescript'],
    category: 'other',
    tags: ['test']
  };

  it('passes on a perfectly valid manifest', () => {
    const { errors } = validateManifestContent(validManifest, '/mock/dir');
    expect(errors.length).toBe(0);
  });

  it('detects missing required fields', () => {
    const invalid = { ...validManifest };
    delete (invalid as any).name;
    const { errors } = validateManifestContent(invalid, '/mock/dir');
    expect(errors).toContain('Missing required field: "name"');
  });

  it('detects invalid version format', () => {
    const invalid = { ...validManifest, version: 'v1.0' };
    const { errors } = validateManifestContent(invalid, '/mock/dir');
    expect(errors).toContain('"version" must be semver (e.g. "0.1.0"), got "v1.0"');
  });

  it('detects invalid component name format', () => {
    const invalid = { ...validManifest, name: 'myComponent' };
    const { errors } = validateManifestContent(invalid, '/mock/dir');
    expect(errors).toContain('"name" must be scoped (e.g. @radzor/my-component), got "myComponent"');
  });

  it('validates outputs and their types correctly', () => {
    const withOutputs = {
      ...validManifest,
      outputs: [
        { name: 'url', type: 'string', description: 'The URL' }
      ]
    };
    
    expect(validateManifestContent(withOutputs, '/mock/dir').errors.length).toBe(0);
    
    const invalidOutputs = {
      ...validManifest,
      outputs: [
        { name: 'url', description: 'The URL' } // missing type
      ]
    };
    
    const { errors } = validateManifestContent(invalidOutputs, '/mock/dir');
    expect(errors).toContain('outputs[0]: missing "type"');
  });
});
